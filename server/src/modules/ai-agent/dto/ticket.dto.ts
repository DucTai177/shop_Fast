import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export class FilterTicketDto {
  @ApiPropertyOptional({
    enum: TicketStatus,
    description: 'Lọc theo trạng thái vé: OPEN, IN_PROGRESS, RESOLVED, CLOSED',
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({
    enum: TicketCategory,
    description: 'Lọc theo danh mục: ORDER_INQUIRY, INVENTORY_CHECK, RETURN_REFUND, COMPLAINT, OTHER',
  })
  @IsEnum(TicketCategory)
  @IsOptional()
  category?: TicketCategory;

  @ApiPropertyOptional({
    example: 'SF2026',
    description: 'Tìm kiếm theo mã vé hoặc tiêu đề',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1, example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}

export class UpdateTicketStatusDto {
  @ApiPropertyOptional({
    enum: TicketStatus,
    example: TicketStatus.IN_PROGRESS,
    description: 'Trạng thái mới: OPEN, IN_PROGRESS, RESOLVED, CLOSED',
  })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @ApiPropertyOptional({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
    description: 'Độ ưu tiên: LOW, MEDIUM, HIGH, URGENT',
  })
  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @ApiPropertyOptional({
    example: 'Nhân viên A đã tiếp nhận và đang liên hệ nhà vận chuyển.',
    description: 'Ghi chú hoặc tin nhắn phản hồi kèm theo',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
