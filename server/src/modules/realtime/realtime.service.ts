import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway.js';
import type {
  OrderCreatedPayload,
  OrderStatusUpdatedPayload,
} from './realtime.types.js';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly gateway: RealtimeGateway) {}

  /**
   * Phát thông báo cập nhật trạng thái đơn hàng (F02)
   */
  notifyOrderStatusChanged(payload: OrderStatusUpdatedPayload) {
    try {
      this.gateway.emitOrderStatusUpdated(payload);
    } catch (err: any) {
      this.logger.error(
        `Lỗi khi broadcast order:statusUpdated đơn ${payload.orderNumber}: ${err.message}`,
      );
    }
  }

  /**
   * Phát thông báo khi có đơn hàng mới (F02)
   */
  notifyNewOrder(payload: OrderCreatedPayload) {
    try {
      this.gateway.emitOrderCreated(payload);
    } catch (err: any) {
      this.logger.error(
        `Lỗi khi broadcast order:created đơn ${payload.orderNumber}: ${err.message}`,
      );
    }
  }
}
