import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  JOB_ORDER_CONFIRMATION_EMAIL,
  JOB_ORDER_TIMEOUT_CHECK,
  JOB_WELCOME_EMAIL,
  QUEUE_EMAIL,
  QUEUE_ORDER_TIMEOUT,
} from '../queue.constants.js';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_EMAIL) private emailQueue: Queue,
    @InjectQueue(QUEUE_ORDER_TIMEOUT) private orderTimeoutQueue: Queue,
  ) {}

  /**
   * Đẩy tác vụ gửi email xác nhận đặt hàng vào hàng đợi
   */
  async addOrderConfirmationEmailJob(order: {
    id: string;
    orderNumber: string;
    user?: { email: string; fullName: string };
    receiverName: string;
    shippingAddress: string;
    totalAmount: any;
    items?: any[];
  }) {
    const email = order.user?.email || 'customer@shopfast.vn';

    const job = await this.emailQueue.add(
      JOB_ORDER_CONFIRMATION_EMAIL,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        email,
        receiverName: order.receiverName,
        shippingAddress: order.shippingAddress,
        totalAmount: Number(order.totalAmount),
        items: (order.items || []).map((it) => ({
          productName: it.productName,
          quantity: it.quantity,
          price: Number(it.price),
        })),
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(
      `[QueueService] Đã đẩy job gửi email xác nhận đơn hàng "${order.orderNumber}" vào hàng đợi (Job ID: ${job.id}).`,
    );
    return job;
  }

  /**
   * Đẩy tác vụ gửi email chào mừng vào hàng đợi
   */
  async addWelcomeEmailJob(user: { id: string; email: string; fullName: string }) {
    return this.emailQueue.add(
      JOB_WELCOME_EMAIL,
      {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      {
        attempts: 3,
        removeOnComplete: 50,
      },
    );
  }

  /**
   * Lên lịch hẹn giờ tự động kiểm tra và hủy đơn hàng nếu quá hạn thanh toán
   * @param delayMs Thời gian chờ (mặc định 15 phút = 900,000ms)
   */
  async addOrderTimeoutJob(
    orderId: string,
    orderNumber: string,
    delayMs: number = 15 * 60 * 1000,
  ) {
    const jobId = `timeout-${orderId}`;

    // Xóa job cũ nếu đã tồn tại để cập nhật lại thời gian hẹn giờ chính xác
    try {
      const existing = await this.orderTimeoutQueue.getJob(jobId);
      if (existing) {
        await existing.remove();
      }
    } catch {}

    const job = await this.orderTimeoutQueue.add(
      JOB_ORDER_TIMEOUT_CHECK,
      {
        orderId,
        orderNumber,
      },
      {
        jobId, // Dùng ID cố định không chứa dấu hai chấm
        delay: delayMs,
        attempts: 2,
        removeOnComplete: true,
      },
    );

    const minutes = Math.round(delayMs / 60000);
    this.logger.log(
      `[QueueService] Đã lên lịch hẹn giờ hủy đơn tự động sau ${minutes} phút cho đơn "${orderNumber}" (Job ID: ${job.id}).`,
    );
    return job;
  }

  /**
   * Hủy bỏ job hẹn giờ nếu khách hàng thanh toán sớm
   */
  async removeOrderTimeoutJob(orderId: string) {
    try {
      const jobId = `timeout-${orderId}`;
      const job = await this.orderTimeoutQueue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`[QueueService] Đã hủy job hẹn giờ timeout cho đơn hàng ID: ${orderId}`);
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi khi gỡ job timeout: ${err.message}`);
    }
  }

  /**
   * Lấy số liệu thống kê tình trạng các hàng đợi BullMQ (Metrics F05)
   */
  async getQueueMetrics() {
    const [emailCounts, timeoutCounts] = await Promise.all([
      this.emailQueue.getJobCounts(),
      this.orderTimeoutQueue.getJobCounts(),
    ]);

    return {
      status: 'healthy',
      queues: {
        emailQueue: {
          name: QUEUE_EMAIL,
          ...emailCounts,
        },
        orderTimeoutQueue: {
          name: QUEUE_ORDER_TIMEOUT,
          ...timeoutCounts,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
