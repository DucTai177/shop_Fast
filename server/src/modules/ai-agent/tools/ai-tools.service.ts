import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { TicketCategory, TicketPriority, TicketStatus, SenderType } from '@prisma/client';
import type {
  CheckOrderStatusArgs,
  CheckProductInventoryArgs,
  CreateSupportTicketArgs,
} from '../ai-agent.types.js';

@Injectable()
export class AiToolsService {
  private readonly logger = new Logger(AiToolsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tool 1: Tra cứu đơn hàng theo mã đơn (F01)
   */
  async checkOrderStatus(args: CheckOrderStatusArgs) {
    const { orderNumber } = args;
    this.logger.log(`[Tool: checkOrderStatus] Đang tra cứu đơn hàng: ${orderNumber}`);

    const cleanOrderNumber = orderNumber?.trim().toUpperCase();

    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: cleanOrderNumber },
          { id: cleanOrderNumber },
        ],
      },
      include: {
        items: true,
        statusHistories: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    });

    if (!order) {
      return {
        found: false,
        message: `Không tìm thấy đơn hàng "${cleanOrderNumber}" trong cơ sở dữ liệu. Quý khách vui lòng kiểm tra lại mã đơn hàng chính xác (thường bắt đầu bằng SF).`,
      };
    }

    return {
      found: true,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      receiverName: order.receiverName,
      shippingAddress: order.shippingAddress,
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: Number(item.price),
      })),
      recentHistories: order.statusHistories.map((h) => ({
        status: h.toStatus,
        note: h.note,
        time: h.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Tool 2: Tra cứu tồn kho và thông tin sản phẩm (F01)
   */
  async checkProductInventory(args: CheckProductInventoryArgs) {
    const { keyword } = args;
    this.logger.log(`[Tool: checkProductInventory] Đang tìm kiếm sản phẩm: "${keyword}"`);

    const cleanKeyword = keyword?.trim();

    // Hỗ trợ tìm theo số ID hoặc chuỗi tên
    const numericId = parseInt(cleanKeyword, 10);
    const whereConditions: any[] = [
      { name: { contains: cleanKeyword, mode: 'insensitive' } },
      { sku: { contains: cleanKeyword, mode: 'insensitive' } },
      { brand: { contains: cleanKeyword, mode: 'insensitive' } },
    ];

    if (!isNaN(numericId)) {
      whereConditions.push({ id: numericId });
    }

    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: whereConditions,
      },
      take: 5,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stock: true,
        brand: true,
        description: true,
      },
    });

    if (products.length === 0) {
      return {
        found: false,
        message: `Hiện tại ShopFast chưa tìm thấy sản phẩm nào khớp với từ khóa "${cleanKeyword}".`,
      };
    }

    return {
      found: true,
      totalFound: products.length,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: Number(p.price),
        stock: p.stock,
        inStock: p.stock > 0,
        statusText: p.stock > 0 ? `Còn hàng (${p.stock} sản phẩm)` : 'Tạm hết hàng',
      })),
    };
  }

  /**
   * Tool 3: Tự động tạo phiếu hỗ trợ (Ticket) vào Database (F01)
   */
  async createSupportTicket(
    currentUserId: string | null,
    args: CreateSupportTicketArgs,
  ) {
    this.logger.log(`[Tool: createSupportTicket] Tạo phiếu hỗ trợ: "${args.title}"`);

    // 1. Xác định User liên kết (Nếu chưa đăng nhập, gán cho khách hàng mặc định trong seed)
    let targetUserId = currentUserId;
    if (!targetUserId) {
      const defaultCustomer = await this.prisma.user.findFirst({
        where: { role: 'CUSTOMER' },
      });
      targetUserId = defaultCustomer?.id || '';
    }

    // 2. Sinh mã vé chuẩn: TK + YYYYMMDD + 4 số ngẫu nhiên
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    const ticketNumber = `TK${dateStr}${randomStr}`;

    // 3. Chuẩn hóa Category và Priority
    const validCategories = Object.values(TicketCategory);
    const category = validCategories.includes(args.category)
      ? args.category
      : TicketCategory.OTHER;

    const validPriorities = Object.values(TicketPriority);
    const priority = args.priority && validPriorities.includes(args.priority)
      ? args.priority
      : TicketPriority.MEDIUM;

    // 4. Lưu Ticket và tin nhắn mở đầu vào Database
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber,
        userId: targetUserId,
        title: args.title,
        category,
        priority,
        status: TicketStatus.OPEN,
        messages: {
          create: [
            {
              senderType: SenderType.CUSTOMER,
              senderId: targetUserId,
              content: args.description + (args.orderNumber ? ` (Đơn liên quan: ${args.orderNumber})` : ''),
            },
            {
              senderType: SenderType.AI_AGENT,
              content: `ShopFast AI đã tiếp nhận khiếu nại/yêu cầu hỗ trợ "${args.title}" và chuyển trạng thái sang OPEN. Nhân viên CSKH sẽ xử lý trong thời gian sớm nhất.`,
            },
          ],
        },
      },
    });

    return {
      success: true,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      message: `Đã tạo thành công Phiếu yêu cầu hỗ trợ mã "${ticket.ticketNumber}". Đội ngũ Chăm sóc khách hàng ShopFast sẽ liên hệ xử lý ngay cho quý khách.`,
    };
  }
}

