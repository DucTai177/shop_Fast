import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class FilterProductDto {
  @ApiPropertyOptional({ description: 'Tìm kiếm theo tên sản phẩm, mã SKU, slug hoặc ID sản phẩm', example: 'iphone' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Lọc chính xác theo ID sản phẩm (số nguyên, ví dụ: 9)', example: 9 })
  @Type(() => Number)
  @IsInt({ message: 'id sản phẩm phải là số nguyên' })
  @IsOptional()
  id?: number;

  @ApiPropertyOptional({ description: 'Lọc theo ID danh mục (1: Điện Thoại, 2: Laptop, 3: Âm Thanh, 4: Phụ Kiện)', example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'categoryId phải là số nguyên' })
  @IsOptional()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo slug danh mục (ví dụ: dien-thoai-tablet)' })
  @IsString()
  @IsOptional()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Lọc theo hãng/thương hiệu (ví dụ: Apple, Samsung, Sony)' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ description: 'Giá thấp nhất', example: 1000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Giá cao nhất', example: 35000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Số trang (mặc định 1)', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Số lượng sản phẩm mỗi trang (mặc định 10)', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sắp xếp theo trường (createdAt, price, name)',
    default: 'createdAt',
  })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Chiều sắp xếp (asc, desc)',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
