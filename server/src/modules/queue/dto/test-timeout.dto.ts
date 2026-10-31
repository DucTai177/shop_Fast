import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TestTimeoutDto {
  @ApiProperty({
    example: '58260f00-a2b7-4255-88a8-390c9ff07e74',
    description: 'ID đơn hàng (UUID lấy từ kết quả tạo đơn POST /api/v1/orders)',
  })
  @IsString()
  @IsNotEmpty({ message: 'orderId không được để trống' })
  orderId: string;

  @ApiProperty({
    example: 'SF202610305184',
    description: 'Mã đơn hàng thân thiện (SF...)',
  })
  @IsString()
  @IsNotEmpty({ message: 'orderNumber không được để trống' })
  orderNumber: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Số giây hẹn giờ hủy đơn tự động để demo (mặc định 5 giây)',
    default: 5,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  delaySeconds?: number = 5;
}

