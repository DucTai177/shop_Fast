import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  JOB_ORDER_CONFIRMATION_EMAIL,
  JOB_WELCOME_EMAIL,
  QUEUE_EMAIL,
} from '../queue.constants.js';
import { IdempotencyService } from '../services/idempotency.service.js';

@Processor(QUEUE_EMAIL)
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private idempotencyService: IdempotencyService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`[EmailWorker] Đang xử lý job "${job.name}" (Job ID: ${job.id})...`);

    switch (job.name) {
      case JOB_ORDER_CONFIRMATION_EMAIL:
        return this.handleOrderConfirmationEmail(job.data);

      case JOB_WELCOME_EMAIL:
        return this.handleWelcomeEmail(job.data);

      default:
        this.logger.warn(`[EmailWorker] Không nhận dạng được loại job: ${job.name}`);
        return { unhandled: true };
    }
  }

  /**
   * Xử lý gửi email xác nhận đặt hàng kèm Idempotency
   */
  private async handleOrderConfirmationEmail(data: {
    orderId: string;
    orderNumber: string;
    email: string;
    receiverName: string;
    totalAmount: number;
    shippingAddress: string;
    items: { productName: string; quantity: number; price: number }[];
  }) {
    const idempotencyKey = `email:order:${data.orderId}`;

    return this.idempotencyService.executeWithIdempotency(
      idempotencyKey,
      JOB_ORDER_CONFIRMATION_EMAIL,
      async () => {
        // Giả lập độ trễ gửi email qua SMTP mạng thực tế (300ms)
        await new Promise((r) => setTimeout(r, 300));

        const formattedAmount = new Intl.NumberFormat('vi-VN', {
          style: 'currency',
          currency: 'VND',
        }).format(data.totalAmount);

        this.logger.log(
          `\n========================================================` +
            `\n📧 [EMAIL XÁC NHẬN ĐƠN HÀNG - ĐÃ GỬI BẤT ĐỒNG BỘ QUA BULLMQ]` +
            `\n- Người nhận: ${data.receiverName} <${data.email}>` +
            `\n- Mã đơn hàng: ${data.orderNumber}` +
            `\n- Địa chỉ giao: ${data.shippingAddress}` +
            `\n- Tổng tiền: ${formattedAmount}` +
            `\n- Số lượng món: ${data.items?.length || 0} sản phẩm` +
            `\n- Thời gian gửi: ${new Date().toLocaleString('vi-VN')}` +
            `\n========================================================`,
        );

        return {
          sent: true,
          recipient: data.email,
          orderNumber: data.orderNumber,
          sentAt: new Date().toISOString(),
        };
      },
    );
  }

  /**
   * Xử lý gửi email chào mừng người dùng mới
   */
  private async handleWelcomeEmail(data: {
    userId: string;
    email: string;
    fullName: string;
  }) {
    const idempotencyKey = `email:welcome:${data.userId}`;

    return this.idempotencyService.executeWithIdempotency(
      idempotencyKey,
      JOB_WELCOME_EMAIL,
      async () => {
        await new Promise((r) => setTimeout(r, 200));

        this.logger.log(
          `\n========================================================` +
            `\n🎉 [EMAIL CHÀO MỪNG THÀNH VIÊN MỚI - GỬI QUA BULLMQ]` +
            `\n- Khách hàng: ${data.fullName} <${data.email}>` +
            `\n- Lời chào: Chào mừng bạn gia nhập nền tảng ShopFast!` +
            `\n========================================================`,
        );

        return {
          sent: true,
          recipient: data.email,
          sentAt: new Date().toISOString(),
        };
      },
    );
  }
}

