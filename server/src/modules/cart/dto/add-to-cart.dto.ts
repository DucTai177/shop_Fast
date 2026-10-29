import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class AddToCartDto {
  @ApiProperty({
    example: 1,
    description: 'ID sản phẩm (Số nguyên tăng dần, lấy từ GET /api/v1/products)',
  })
  @Type(() => Number)
  @IsInt({ message: 'productId phải là số nguyên hợp lệ' })
  @IsNotEmpty({ message: 'productId không được để trống' })
  productId: number;

  @ApiProperty({
    example: 1,
    description: 'Số lượng sản phẩm muốn thêm vào giỏ (tối thiểu 1)',
    default: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'Số lượng phải lớn hơn hoặc bằng 1' })
  quantity: number = 1;
}
