import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdateCartItemDto {
  @ApiProperty({
    example: 2,
    description: 'Số lượng mới của sản phẩm trong giỏ (nếu truyền 0 sẽ xóa món khỏi giỏ)',
  })
  @Type(() => Number)
  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(0, { message: 'Số lượng không được âm' })
  quantity: number;
}
