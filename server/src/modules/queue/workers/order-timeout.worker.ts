import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  JOB_ORDER_TIMEOUT_CHECK,
  QUEUE_ORDER_TIMEOUT,
} from '../queue.constants.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { RedisService } from '../../../common/redis/redis.service.js';
import { IdempotencyService } from '../services/idempotency.service.js';
import { RealtimeService } from '../../realtime/realtime.service.js';
import { OrderStatus, PaymentStatus } from '@prisma/client';

@Processor(QUEUE_ORDER_TIMEOUT)
export class OrderTimeoutWorker extends WorkerHost {
  private readonly logger = new Logger(OrderTimeoutWorker.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private idempotencyService: IdempotencyService,
    private realtimeService: RealtimeService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(
      `[OrderTimeoutWorker] Kiểm tra hạn thanh toán đơn hàng "${job.data.orderNumber}" (Job ID: ${job.id})...`,
    );

    if (job.name === JOB_ORDER_TIMEOUT_CHECK) {
      return this.handleOrderTimeout(job.data);
    }

    return { unhandled: true };
  }

  /**
   * Tự động kiểm tra và hủy đơn hàng quá hạn thanh toán chuyển khoản, hoàn trả tồn kho
   */
  private async handleOrderTimeout(data: {
    orderId: string;
    orderNumber: string;
  }) {
    const idempotencyKey = `order:timeout:${data.orderId}`;

    return this.idempotencyService.executeWithIdempotency(
      idempotencyKey,
      JOB_ORDER_TIMEOUT_CHECK,
      async () => {
        // 1. Truy vấn đơn hàng từ CSDL
        const order = await this.prisma.order.findUnique({
          where: { id: data.orderId },
          include: { items: true },
        });

        if (!order) {
          this.logger.warn(`[OrderTimeoutWorker] Không tìm thấy đơn hàng ID: ${data.orderId}`);
          return { skipped: true, reason: 'Không tìm thấy đơn hàng' };
        }

        // 2. Nếu đơn hàng không còn ở trạng thái PENDING -> Không hủy
        if (order.status !== OrderStatus.PENDING) {
          this.logger.log(
            `[OrderTimeoutWorker] Đơn hàng "${order.orderNumber}" đã chuyển sang trạng thái "${order.status}". Bỏ qua việc tự động hủy.`,
          );
          return {
            skipped: true,
            status: order.status,
            reason: `Đơn hàng đang ở trạng thái ${order.status}`,
          };
        }

        // 3. Nếu khách đã thanh toán thành công -> Không hủy
        if (order.paymentStatus === PaymentStatus.PAID) {
          this.logger.log(
            `[OrderTimeoutWorker] Đơn hàng "${order.orderNumber}" đã được thanh toán thành công. Bỏ qua hủy đơn.`,
          );
          return { skipped: true, reason: 'Đơn hàng đã thanh toán' };
        }

        // 4. TIẾN HÀNH HỦY ĐƠN VÀ HOÀN TRẢ TỒN KHO TRONG TRANSACTION
        this.logger.warn(
          `[OrderTimeoutWorker] ⚠️ Đơn hàng "${order.orderNumber}" đã quá hạn thanh toán. Đang tự động hủy và hoàn trả tồn kho...`,
        );

        await this.prisma.$transaction(async (tx) => {
          // Hoàn kho cho từng món hàng trong đơn
          for (const item of order.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: { increment: item.quantity },
              },
            });
          }

          // Cập nhật trạng thái đơn sang CANCELLED
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.CANCELLED,
            },
          });

          // Ghi nhận mốc lịch sử hệ thống tự động hủy
          await tx.orderStatusHistory.create({
            data: {
              orderId: order.id,
              fromStatus: OrderStatus.PENDING,
              toStatus: OrderStatus.CANCELLED,
              note: 'Hệ thống tự động hủy đơn do quá hạn thời gian thanh toán (BullMQ Worker F05)',
              updatedById: null, // Do hệ thống tự động thực hiện
            },
          });
        });

        // 5. Làm mới bộ đệm Redis để khách hàng thấy lại số lượng tồn kho đã hoàn
        try {
          await this.redisService.delByPattern('products:list:*');
          for (const item of order.items) {
            await this.redisService.del(`products:detail:${item.productId}`);
          }
        } catch (err) {
          this.logger.warn('Lỗi xóa cache sau khi hoàn kho tự động:', err);
        }

        this.logger.log(
          `[OrderTimeoutWorker] ✅ Đã hủy thành công đơn hàng "${order.orderNumber}" và hoàn trả ${order.items.length} mặt hàng vào kho.`,
        );

        // Phát thông báo Realtime Socket.io cho khách hàng và Admin biết đơn đã bị tự động hủy (F02)
        this.realtimeService.notifyOrderStatusChanged({
          orderId: order.id,
          orderNumber: order.orderNumber,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CANCELLED,
          note: 'Hệ thống tự động hủy đơn do quá hạn thời gian thanh toán ',
          paymentStatus: order.paymentStatus,
          updatedAt: new Date().toISOString(),
          updatedBy: {
            fullName: 'Hệ thống tự động (BullMQ Worker)',
            role: 'SYSTEM',
          },
        });

        return {
          cancelled: true,
          orderNumber: order.orderNumber,
          restockedItemsCount: order.items.length,
          cancelledAt: new Date().toISOString(),
        };
      },
    );
  }
}

