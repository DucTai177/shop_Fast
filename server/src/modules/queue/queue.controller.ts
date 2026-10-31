import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueueService } from './services/queue.service.js';
import { TestTimeoutDto } from './dto/test-timeout.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';

@ApiTags('Queue & Background Workers (Hàng đợi & Tác vụ nền - F05)')
@Controller('queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  /**
   * Lấy số liệu thống kê tình trạng các hàng đợi BullMQ
   * Đường dẫn: GET /api/v1/queue/metrics
   */
  @Get('metrics')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Xem tình trạng hoạt động và số lượng job trong hàng đợi BullMQ (Chỉ Admin)',
  })
  @ApiResponse({
    status: 200,
    description: 'Số lượng jobs (waiting, active, completed, failed, delayed)',
  })
  async getMetrics() {
    return this.queueService.getQueueMetrics();
  }

  /**
   * Kích hoạt thử nghiệm hẹn giờ hủy đơn quá hạn nhanh (Dành cho việc Demo bảo vệ đồ án)
   * Đường dẫn: POST /api/v1/queue/test-timeout
   */
  @Post('test-timeout')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Test nhanh tính năng hủy đơn hẹn giờ (chạy sau số giây tùy chọn, vd 5s để demo trước hội đồng)',
  })
  @ApiBody({ type: TestTimeoutDto })
  @ApiResponse({ status: 201, description: 'Lên lịch hẹn giờ hủy đơn thành công' })
  async testTimeout(@Body() dto: TestTimeoutDto) {
    const delayMs = (dto.delaySeconds || 5) * 1000;
    const job = await this.queueService.addOrderTimeoutJob(
      dto.orderId,
      dto.orderNumber,
      delayMs,
    );

    return {
      message: `Đã lên lịch hẹn giờ hủy đơn sau ${dto.delaySeconds || 5} giây để phục vụ demo.`,
      jobId: job.id,
      executeAt: new Date(Date.now() + delayMs).toISOString(),
    };
  }
}

