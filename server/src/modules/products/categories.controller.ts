import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ProductsService } from './products.service.js';

@ApiTags('Categories (Danh mục sản phẩm - F06)')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Lấy danh sách danh mục sản phẩm (Có Caching Redis 1 giờ)
   * Đường dẫn đầy đủ: GET /api/v1/categories
   */
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách danh mục (Cache Redis 1 giờ)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách danh mục và số lượng sản phẩm',
  })
  async getCategories() {
    return this.productsService.getCategories();
  }
}
