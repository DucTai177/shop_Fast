import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED,
    description: 'Trạng thái mới của đơn hàng: PENDING, CONFIRMED, PACKING, SHIPPING, DELIVERED, CANCELLED',
  })
  @IsEnum(OrderStatus, { message: 'Trạng thái đơn hàng không hợp lệ' })
  @IsNotEmpty({ message: 'Trạng thái không được để trống' })
  status: OrderStatus;

  @ApiPropertyOptional({
    example: 'Đã hoàn tất đóng gói, bàn giao đơn vị Viettel Post. Mã bưu gửi VTP123456.',
    description: 'Ghi chú cho sự kiện thay đổi trạng thái này',
  })
  @IsString()
  @IsOptional()
  note?: string;
}

export class CancelOrderDto {
  @ApiPropertyOptional({
    example: 'Tôi đổi ý muốn mua màu khác',
    description: 'Lý do khách hàng hủy đơn hàng',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
