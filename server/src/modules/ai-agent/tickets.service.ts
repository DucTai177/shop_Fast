import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  Prisma,
  SenderType,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { FilterTicketDto, UpdateTicketStatusDto } from './dto/ticket.dto.js';
import type { CurrentUserPayload } from '../orders/orders.service.js';

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lấy danh sách phiếu hỗ trợ (Khách chỉ xem của mình; CSKH/Admin xem toàn bộ)
   */
  async getTickets(currentUser: CurrentUserPayload, query: FilterTicketDto) {
    const { status, category, search, page = 1, limit = 10 } = query;

    const where: Prisma.TicketWhereInput = {};

    // Phân quyền RBAC: Khách chỉ xem vé của mình
    if (currentUser.role === UserRole.CUSTOMER) {
      where.userId = currentUser.id;
    }

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
          assignedTo: {
            select: { id: true, fullName: true, role: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Lấy tin nhắn mới nhất
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Xem chi tiết 1 phiếu hỗ trợ kèm toàn bộ lịch sử trao đổi
   */
  async getTicketDetail(currentUser: CurrentUserPayload, idOrNumber: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { ticketNumber: idOrNumber }],
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        assignedTo: {
          select: { id: true, fullName: true, role: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, fullName: true, role: true },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy phiếu hỗ trợ "${idOrNumber}".`);
    }

    // Bảo mật RBAC
    if (
      currentUser.role === UserRole.CUSTOMER &&
      ticket.userId !== currentUser.id
    ) {
      throw new ForbiddenException('Bạn không có quyền truy cập vào phiếu hỗ trợ này.');
    }

    return { data: ticket };
  }

  /**
   * Phản hồi vào phiếu hỗ trợ (Dành cho Khách hàng hoặc Nhân viên CSKH)
   */
  async replyTicket(
    currentUser: CurrentUserPayload,
    ticketId: string,
    content: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy phiếu hỗ trợ "${ticketId}".`);
    }

    if (
      currentUser.role === UserRole.CUSTOMER &&
      ticket.userId !== currentUser.id
    ) {
      throw new ForbiddenException('Bạn không thể phản hồi vào phiếu hỗ trợ của người khác.');
    }

    const senderType =
      currentUser.role === UserRole.CUSTOMER
        ? SenderType.CUSTOMER
        : SenderType.SUPPORT_AGENT;

    const message = await this.prisma.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderType,
        senderId: currentUser.id,
        content,
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    // Cập nhật updatedAt của Ticket
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    });

    return {
      message: 'Phản hồi phiếu hỗ trợ thành công.',
      data: message,
    };
  }

  /**
   * Cập nhật trạng thái phiếu hỗ trợ (Chỉ Nhân viên CSKH hoặc Admin)
   */
  async updateTicketStatus(
    currentUser: CurrentUserPayload,
    ticketId: string,
    dto: UpdateTicketStatusDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Không tìm thấy phiếu hỗ trợ "${ticketId}".`);
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: dto.status || ticket.status,
        priority: dto.priority || ticket.priority,
        assignedToId: currentUser.id,
      },
    });

    if (dto.note) {
      await this.prisma.ticketMessage.create({
        data: {
          ticketId,
          senderType: SenderType.SUPPORT_AGENT,
          senderId: currentUser.id,
          content: `[Cập nhật trạng thái]: ${dto.note}`,
        },
      });
    }

    return {
      message: 'Cập nhật phiếu hỗ trợ thành công.',
      data: updatedTicket,
    };
  }
}
