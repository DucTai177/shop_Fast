import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AiAgentService } from './ai-agent.service.js';
import { TicketsService } from './tickets.service.js';
import { ChatMessageDto, ReplyTicketDto } from './dto/chat-message.dto.js';
import { FilterTicketDto, UpdateTicketStatusDto } from './dto/ticket.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { CurrentUserPayload } from '../orders/orders.service.js';

@ApiTags('AI Customer Support Agent (CSKH Google Gemini - F01)')
@Controller('ai')
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    private readonly ticketsService: TicketsService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('chat')
  @ApiOperation({
    summary:
      'Gửi tin nhắn tới Trợ lý AI CSKH ShopFast (Sử dụng Google Gemini + Function Calling F01)',
  })
  @ApiResponse({
    status: 200,
    description: 'Phản hồi từ AI CSKH kèm danh sách Tool đã kích hoạt',
  })
  async chat(@Body() dto: ChatMessageDto, @Req() req: Request) {
    let userId: string | null = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = this.jwtService.decode(token);
        if (decoded && decoded.sub) {
          userId = decoded.sub;
        }
      } catch {}
    }

    return this.aiAgentService.processChatMessage(userId, dto);
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Lấy danh sách phiếu hỗ trợ (Khách chỉ xem của mình; CSKH/Admin xem toàn bộ)',
  })
  async getTickets(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: FilterTicketDto,
  ) {
    return this.ticketsService.getTickets(user, query);
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Xem chi tiết 1 phiếu hỗ trợ kèm lịch sử tin nhắn trao đổi',
  })
  async getTicketDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.ticketsService.getTicketDetail(user, id);
  }

  @Post('tickets/:id/reply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Phản hồi tin nhắn vào phiếu hỗ trợ (Dành cho Khách hoặc CSKH)',
  })
  async replyTicket(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.ticketsService.replyTicket(user, id, dto.content);
  }

  @Patch('tickets/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPPORT_AGENT, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật trạng thái phiếu hỗ trợ (Chỉ Nhân viên CSKH hoặc Admin)',
  })
  async updateTicketStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.ticketsService.updateTicketStatus(user, id, dto);
  }
}

