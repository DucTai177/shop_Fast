import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { FilterOrderDto } from './dto/filter-order.dto.js';
import { CancelOrderDto, UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { OrderStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { QueueService } from '../queue/services/queue.service.js';

export interface CurrentUserPayload {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private queueService: QueueService,
  ) {}

  /**
   * Tạo đơn hàng mới với Thuật toán chống bán âm kho (Concurrency Transaction F06)
   */
  async createOrder(userId: string, dto: CreateOrderDto) {
    // 1. Xác định danh sách sản phẩm cần mua (từ giỏ hàng hoặc mua ngay)
    let itemsToProcess: { productId: number; quantity: number }[] = [];
    let isFromCart = false;

    if (dto.items && dto.items.length > 0) {
      itemsToProcess = dto.items;
    } else {
      // Lấy từ giỏ hàng hiện tại
      const cart = await this.prisma.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException(
          'Giỏ hàng của bạn đang trống. Vui lòng thêm sản phẩm vào giỏ trước khi đặt hàng.',
        );
      }

      itemsToProcess = cart.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
      }));
      isFromCart = true;
    }

    // 2. Thực thi toàn bộ quá trình đặt hàng trong một Database Transaction duy nhất
    const createdOrder = await this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const orderItemsData: {
        productId: number;
        productName: string;
        sku: string;
        price: number;
        quantity: number;
        totalPrice: number;
      }[] = [];

      // Duyệt qua từng sản phẩm để kiểm tra và trừ tồn kho (Chống Overselling)
      for (const reqItem of itemsToProcess) {
        const product = await tx.product.findUnique({
          where: { id: reqItem.productId },
        });

        if (!product || !product.isActive) {
          throw new NotFoundException(
            `Sản phẩm ID ${reqItem.productId} không tồn tại hoặc đã ngừng kinh doanh.`,
          );
        }

        // KIỂM TRA TỒN KHO THỰC TẾ
        if (product.stock < reqItem.quantity) {
          throw new BadRequestException(
            `Sản phẩm "${product.name}" không đủ số lượng trong kho (Hiện còn ${product.stock}, yêu cầu ${reqItem.quantity}). Vui lòng điều chỉnh số lượng.`,
          );
        }

        // TRỪ TỒN KHO NGAY LẬP TỨC TRONG GIAO DỊCH
        await tx.product.update({
          where: { id: product.id },
          data: {
            stock: { decrement: reqItem.quantity },
          },
        });

        const itemPrice = Number(product.price);
        const itemTotal = itemPrice * reqItem.quantity;
        subtotal += itemTotal;

        orderItemsData.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          price: itemPrice,
          quantity: reqItem.quantity,
          totalPrice: itemTotal,
        });
      }

      // 3. Tính phí giao hàng (Đơn từ 500,000đ trở lên được miễn phí ship, ngược lại 30,000đ)
      const shippingFee = subtotal >= 500000 ? 0 : 30000;
      const totalAmount = subtotal + shippingFee;

      // 4. Sinh mã đơn hàng chuẩn đẹp: SF + YYYYMMDD + 4 chữ số ngẫu nhiên
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
      const orderNumber = `SF${dateStr}${randomStr}`;

      // 5. Tạo đơn hàng và chi tiết món
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          status: OrderStatus.PENDING,
          paymentStatus:
            dto.paymentMethod === 'BANK_TRANSFER'
              ? PaymentStatus.UNPAID
              : PaymentStatus.UNPAID,
          paymentMethod: dto.paymentMethod || 'COD',
          subtotal,
          shippingFee,
          totalAmount,
          receiverName: dto.receiverName,
          receiverPhone: dto.receiverPhone,
          shippingAddress: dto.shippingAddress,
          notes: dto.notes,
          items: {
            create: orderItemsData.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              price: item.price,
              quantity: item.quantity,
              totalPrice: item.totalPrice,
            })),
          },
          statusHistories: {
            create: {
              fromStatus: null,
              toStatus: OrderStatus.PENDING,
              note: 'Đơn hàng được khởi tạo thành công trên hệ thống',
              updatedById: userId,
            },
          },
        },
        include: {
          items: true,
          statusHistories: true,
        },
      });

      // 6. Nếu đặt từ giỏ hàng -> Xóa các sản phẩm đã mua khỏi giỏ
      if (isFromCart) {
        await tx.cartItem.deleteMany({
          where: { cart: { userId } },
        });
      }

      return order;
    });

    // 7. Xóa cache Redis của các sản phẩm vừa mua để người dùng khác thấy số tồn kho mới nhất
    try {
      await this.redisService.delByPattern('products:list:*');
      for (const item of itemsToProcess) {
        await this.redisService.del(`products:detail:${item.productId}`);
      }
    } catch (err) {
      this.logger.warn('Lỗi làm mới cache sau khi tạo đơn:', err);
    }

    // 8. Đẩy tác vụ ngầm vào hàng đợi BullMQ (F05)
    try {
      // 8.1. Đẩy job gửi email xác nhận đặt hàng
      const customer = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true },
      });

      await this.queueService.addOrderConfirmationEmailJob({
        ...createdOrder,
        user: customer || undefined,
      });

      // 8.2. Nếu phương thức thanh toán là chuyển khoản (BANK_TRANSFER) -> Hẹn giờ tự động hủy nếu quá hạn 15 phút
      if (dto.paymentMethod === 'BANK_TRANSFER') {
        await this.queueService.addOrderTimeoutJob(
          createdOrder.id,
          createdOrder.orderNumber,
          15 * 60 * 1000, // 15 phút
        );
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi khi đẩy job vào BullMQ: ${err.message}`);
    }

    return {
      message: 'Đặt hàng thành công!',
      data: createdOrder,
    };
  }

  /**
   * Lấy danh sách đơn hàng có phân trang & lọc (Hỗ trợ phân quyền RBAC)
   */
  async getOrders(currentUser: CurrentUserPayload, query: FilterOrderDto) {
    const { status, search, page = 1, limit = 10 } = query;

    const where: Prisma.OrderWhereInput = {};

    // Khách hàng thường CHỈ xem được đơn của chính họ
    if (currentUser.role === UserRole.CUSTOMER) {
      where.userId = currentUser.id;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { receiverName: { contains: search, mode: 'insensitive' } },
        { receiverPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          items: true,
          statusHistories: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Lấy trạng thái gần nhất
          },
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Xem chi tiết 1 đơn hàng (kèm lộ trình lịch sử trạng thái)
   */
  async getOrderDetail(currentUser: CurrentUserPayload, idOrOrderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: idOrOrderNumber },
          { orderNumber: idOrOrderNumber },
        ],
      },
      include: {
        items: true,
        statusHistories: {
          orderBy: { createdAt: 'asc' },
          include: {
            updatedBy: {
              select: { id: true, fullName: true, role: true },
            },
          },
        },
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng "${idOrOrderNumber}".`);
    }

    // Bảo mật: Khách hàng không thể xem trộm đơn của người khác
    if (
      currentUser.role === UserRole.CUSTOMER &&
      order.userId !== currentUser.id
    ) {
      throw new ForbiddenException('Bạn không có quyền truy cập vào thông tin đơn hàng này.');
    }

    return { data: order };
  }

  /**
   * Cập nhật trạng thái đơn hàng (Dành cho Admin, Thủ kho, CSKH)
   */
  async updateOrderStatus(
    currentUser: CurrentUserPayload,
    orderId: string,
    dto: UpdateOrderStatusDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ID "${orderId}".`);
    }

    const fromStatus = order.status;
    const toStatus = dto.status;

    if (fromStatus === toStatus) {
      return {
        message: `Đơn hàng hiện tại đã ở trạng thái ${toStatus}.`,
        data: order,
      };
    }

    // Thực hiện trong Transaction để đảm bảo tính toàn vẹn tồn kho
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // NẾU HỦY ĐƠN HÀNG (CANCELLED) VÀ TRƯỚC ĐÓ CHƯA HỦY -> HOÀN TRẢ LẠI SỐ LƯỢNG TỒN KHO
      if (
        toStatus === OrderStatus.CANCELLED &&
        fromStatus !== OrderStatus.CANCELLED
      ) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity },
            },
          });
        }
      }

      // Nếu đơn hàng giao thành công và thanh toán COD -> Đánh dấu đã thanh toán
      let paymentStatus = order.paymentStatus;
      if (toStatus === OrderStatus.DELIVERED && order.paymentMethod === 'COD') {
        paymentStatus = PaymentStatus.PAID;
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: toStatus,
          paymentStatus,
        },
        include: {
          items: true,
          statusHistories: true,
        },
      });

      // Ghi nhận sự kiện vào lịch sử trạng thái
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus,
          toStatus,
          note: dto.note || `Trạng thái đơn hàng cập nhật từ ${fromStatus} sang ${toStatus}`,
          updatedById: currentUser.id,
        },
      });

      return updated;
    });

    // Nếu có hoàn kho do hủy đơn -> Xóa cache sản phẩm trong Redis
    if (toStatus === OrderStatus.CANCELLED) {
      try {
        await this.redisService.delByPattern('products:list:*');
        for (const item of order.items) {
          await this.redisService.del(`products:detail:${item.productId}`);
        }
      } catch (err) {
        this.logger.warn('Lỗi làm mới cache sau khi hủy đơn:', err);
      }
    }

    // Nếu đơn hàng đã được duyệt, thanh toán hoặc hủy -> Gỡ bỏ job hẹn giờ tự động hủy trong BullMQ
    if (toStatus !== OrderStatus.PENDING) {
      await this.queueService.removeOrderTimeoutJob(orderId);
    }

    return {
      message: `Cập nhật trạng thái đơn hàng sang ${toStatus} thành công.`,
      data: updatedOrder,
    };
  }

  /**
   * Khách hàng tự hủy đơn hàng khi đơn còn ở trạng thái PENDING
   */
  async cancelOrderByCustomer(
    currentUser: CurrentUserPayload,
    orderId: string,
    dto: CancelOrderDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng "${orderId}".`);
    }

    if (order.userId !== currentUser.id) {
      throw new ForbiddenException('Bạn chỉ có thể thao tác với đơn hàng của chính mình.');
    }

    // Chỉ cho phép khách hủy khi đơn còn đang chờ xử lý (PENDING)
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        `Đơn hàng đang ở trạng thái "${order.status}". Bạn không thể tự hủy lúc này. Vui lòng liên hệ nhân viên hỗ trợ.`,
      );
    }

    return this.updateOrderStatus(currentUser, orderId, {
      status: OrderStatus.CANCELLED,
      note: dto.reason ? `Khách hàng hủy đơn: ${dto.reason}` : 'Khách hàng tự hủy đơn hàng trực tuyến',
    });
  }
}

