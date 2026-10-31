import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { REALTIME_EVENTS, REALTIME_ROOMS } from './realtime.constants.js';
import type {
  OrderCreatedPayload,
  OrderStatusUpdatedPayload,
} from './realtime.types.js';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('⚡ Socket.io Gateway đã sẵn sàng hoạt động (F02 Realtime)');
  }

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization;

      if (rawToken) {
        const token = rawToken.replace(/^Bearer\s+/i, '');
        const secret =
          this.configService.get<string>('JWT_SECRET') ||
          'shopfast_jwt_super_secret_key_2026_module6_defense';

        const payload = await this.jwtService.verifyAsync(token, { secret });
        client.data.user = payload;

        // Tự động tham gia phòng riêng của User
        if (payload.sub) {
          await client.join(REALTIME_ROOMS.USER(payload.sub));
        }

        // Nếu là Quản trị viên hoặc Nhân viên -> Tự động tham gia phòng Admin
        if (
          ['ADMIN', 'WAREHOUSE_STAFF', 'SUPPORT_AGENT'].includes(payload.role)
        ) {
          await client.join(REALTIME_ROOMS.ADMIN);
          this.logger.log(
            `[Socket.io] 👑 Quản trị/Nhân viên "${payload.email}" (${payload.role}) đã kết nối: ${client.id}`,
          );
        } else {
          this.logger.log(
            `[Socket.io] 👤 Khách hàng "${payload.email}" đã kết nối: ${client.id}`,
          );
        }

        client.emit(REALTIME_EVENTS.AUTHENTICATED, {
          success: true,
          user: { id: payload.sub, email: payload.email, role: payload.role },
        });
      } else {
        this.logger.log(
          `[Socket.io] 🌐 Client kết nối ở chế độ khách vãng lai: ${client.id}`,
        );
      }
    } catch {
      this.logger.debug(
        `[Socket.io] Client kết nối không token (chế độ khách): ${client.id}`,
      );
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[Socket.io] 🔌 Client đã ngắt kết nối: ${client.id}`);
  }

  @SubscribeMessage(REALTIME_EVENTS.JOIN_ORDER)
  async handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderNumber: string },
  ) {
    if (!data?.orderNumber) {
      return { success: false, message: 'Thiếu mã đơn hàng (orderNumber)' };
    }

    const room = REALTIME_ROOMS.ORDER(data.orderNumber);
    await client.join(room);
    this.logger.log(
      `[Socket.io] Client ${client.id} đã vào phòng theo dõi đơn: ${room}`,
    );

    return {
      event: REALTIME_EVENTS.ROOM_JOINED,
      room,
      orderNumber: data.orderNumber,
    };
  }

  @SubscribeMessage(REALTIME_EVENTS.LEAVE_ORDER)
  async handleLeaveOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { orderNumber: string },
  ) {
    if (!data?.orderNumber) {
      return { success: false, message: 'Thiếu mã đơn hàng (orderNumber)' };
    }

    const room = REALTIME_ROOMS.ORDER(data.orderNumber);
    await client.leave(room);
    this.logger.log(
      `[Socket.io] Client ${client.id} đã rời phòng theo dõi đơn: ${room}`,
    );

    return {
      event: REALTIME_EVENTS.ROOM_LEFT,
      room,
      orderNumber: data.orderNumber,
    };
  }

  @SubscribeMessage(REALTIME_EVENTS.JOIN_ADMIN)
  async handleJoinAdmin(@ConnectedSocket() client: Socket) {
    await client.join(REALTIME_ROOMS.ADMIN);
    this.logger.log(
      `[Socket.io] Client ${client.id} đã vào phòng quản trị (Admin Room)`,
    );
    return {
      event: REALTIME_EVENTS.ROOM_JOINED,
      room: REALTIME_ROOMS.ADMIN,
    };
  }

  @SubscribeMessage(REALTIME_EVENTS.LEAVE_ADMIN)
  async handleLeaveAdmin(@ConnectedSocket() client: Socket) {
    await client.leave(REALTIME_ROOMS.ADMIN);
    return {
      event: REALTIME_EVENTS.ROOM_LEFT,
      room: REALTIME_ROOMS.ADMIN,
    };
  }

  /**
   * Phát thông báo cập nhật trạng thái đơn hàng đến phòng của đơn và phòng quản trị
   */
  emitOrderStatusUpdated(payload: OrderStatusUpdatedPayload) {
    if (!this.server) return;

    const room = REALTIME_ROOMS.ORDER(payload.orderNumber);
    // 1. Gửi cho khách đang mở trang theo dõi đơn hàng này
    this.server.to(room).emit(REALTIME_EVENTS.ORDER_STATUS_UPDATED, payload);

    // 2. Gửi cho quản trị viên/nhân viên đang mở dashboard
    this.server
      .to(REALTIME_ROOMS.ADMIN)
      .emit(REALTIME_EVENTS.ORDER_STATUS_UPDATED, payload);

    this.logger.log(
      `📢 [Socket.io Realtime F02] Đã broadcast sự kiện "${REALTIME_EVENTS.ORDER_STATUS_UPDATED}" cho đơn "${payload.orderNumber}" -> Trạng thái mới: ${payload.toStatus}`,
    );
  }

  /**
   * Phát thông báo khi có đơn hàng mới vừa được tạo
   */
  emitOrderCreated(payload: OrderCreatedPayload) {
    if (!this.server) return;

    // 1. Gửi cho toàn bộ Admin/Staff
    this.server
      .to(REALTIME_ROOMS.ADMIN)
      .emit(REALTIME_EVENTS.ORDER_CREATED, payload);

    // 2. Gửi cho phòng riêng của khách hàng đó (nếu đang online)
    this.server
      .to(REALTIME_ROOMS.USER(payload.userId))
      .emit(REALTIME_EVENTS.ORDER_CREATED, payload);

    this.logger.log(
      `🎉 [Socket.io Realtime F02] Đã broadcast sự kiện "${REALTIME_EVENTS.ORDER_CREATED}" đơn "${payload.orderNumber}" (${payload.receiverName} - ${payload.totalAmount.toLocaleString('vi-VN')} đ)`,
    );
  }
}
