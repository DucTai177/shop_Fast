import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: 'SF-IP16PM-256', description: 'Mã định danh sản phẩm (SKU) duy nhất' })
  @IsString()
  @IsNotEmpty({ message: 'SKU không được để trống' })
  sku: string;

  @ApiProperty({ example: 'iPhone 16 Pro Max 256GB', description: 'Tên sản phẩm' })
  @IsString()
  @IsNotEmpty({ message: 'Tên sản phẩm không được để trống' })
  name: string;

  @ApiPropertyOptional({ example: 'iphone-16-pro-max-256gb', description: 'Slug đường dẫn (nếu để trống tự sinh)' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Điện thoại thông minh cao cấp nhất của Apple với Apple Intelligence.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 34990000, description: 'Giá bán hiện tại (VNĐ)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'Giá bán không được âm' })
  price: number;

  @ApiPropertyOptional({ example: 38990000, description: 'Giá niêm yết ban đầu (VNĐ)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  originalPrice?: number;

  @ApiProperty({ example: 50, description: 'Số lượng tồn kho thực tế' })
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: 'Số lượng tồn kho không được âm' })
  stock: number;

  @ApiPropertyOptional({ example: 'Apple', description: 'Thương hiệu/Hãng sản xuất' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiProperty({ example: 'uuid-danh-muc', description: 'ID danh mục sản phẩm' })
  @IsString()
  @IsNotEmpty({ message: 'Danh mục không được để trống' })
  categoryId: string;

  @ApiPropertyOptional({
    example: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569'],
    description: 'Danh sách URL ảnh sản phẩm',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
