import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemInputDto {
  @ApiProperty({ example: 1, description: 'ID sản phẩm' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ example: 1, description: 'Số lượng mua' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'Nguyễn Văn An', description: 'Họ tên người nhận hàng' })
  @IsString()
  @IsNotEmpty({ message: 'Tên người nhận không được để trống' })
  receiverName: string;

  @ApiProperty({ example: '0901234567', description: 'Số điện thoại nhận hàng' })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại nhận hàng không được để trống' })
  receiverPhone: string;

  @ApiProperty({
    example: '123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    description: 'Địa chỉ nhận hàng chi tiết',
  })
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ giao hàng không được để trống' })
  shippingAddress: string;

  @ApiPropertyOptional({
    example: 'COD',
    enum: ['COD', 'BANK_TRANSFER'],
    description: 'Phương thức thanh toán (COD: Thanh toán khi nhận hàng, BANK_TRANSFER: Chuyển khoản)',
    default: 'COD',
  })
  @IsString()
  @IsIn(['COD', 'BANK_TRANSFER'], { message: 'Phương thức thanh toán phải là COD hoặc BANK_TRANSFER' })
  @IsOptional()
  paymentMethod?: string = 'COD';

  @ApiPropertyOptional({
    example: 'Giao giờ hành chính, gọi trước khi đến',
    description: 'Ghi chú cho shipper hoặc cửa hàng',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    type: [OrderItemInputDto],
    description:
      'Danh sách sản phẩm mua ngay (Nếu để trống, hệ thống sẽ tự động đặt toàn bộ món trong giỏ hàng hiện tại)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  @IsOptional()
  items?: OrderItemInputDto[];
}
