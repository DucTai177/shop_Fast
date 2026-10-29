import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional({ description: 'Trạng thái kinh doanh sản phẩm (đang bán hoặc ẩn)' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
