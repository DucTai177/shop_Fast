import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProductsService } from './products.service.js';
import { FilterProductDto } from './dto/filter-product.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '@prisma/client';

@ApiTags('Products (Sản phẩm - F06, F04)')
@Controller('products') // Chuẩn kiến trúc NestJS: Quản lý nhóm tài nguyên /products (Prefix chung /api/v1 được cấu hình tại main.ts)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Lấy danh sách sản phẩm có bộ lọc (Cache Redis <20ms F04)
   * Đường dẫn đầy đủ: GET /api/v1/products
   */
  @Get()
  @ApiOperation({
    summary:
      'Lấy danh sách sản phẩm kèm bộ lọc đa năng (Tích hợp Redis Caching <20ms)',
  })
  @ApiResponse({
    status: 200,
    description: 'Danh sách sản phẩm kèm phân trang và responseTimeMs',
  })
  async getProducts(@Query() query: FilterProductDto) {
    return this.productsService.getProducts(query);
  }

  /**
   * Xem chi tiết sản phẩm theo ID, Slug hoặc SKU (Chống Cache Penetration F04)
   * Đường dẫn đầy đủ: GET /api/v1/products/:idOrSlug
   */
  @Get(':idOrSlug')
  @ApiOperation({
    summary:
      'Xem chi tiết sản phẩm theo ID, Slug hoặc SKU (Chống Cache Penetration)',
  })
  @ApiParam({
    name: 'idOrSlug',
    description: 'ID số (1, 2), Slug hoặc SKU sản phẩm',
  })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết sản phẩm' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sản phẩm' })
  async getProductDetail(@Param('idOrSlug') idOrSlug: string) {
    return this.productsService.getProductByIdOrSlug(idOrSlug);
  }

  /**
   * Thêm sản phẩm mới (Chỉ Admin và Kho)
   * Đường dẫn đầy đủ: POST /api/v1/products
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm sản phẩm mới (Chỉ Admin và Nhân viên Kho)' })
  @ApiResponse({
    status: 201,
    description: 'Tạo sản phẩm thành công, đã làm mới cache',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  async createProduct(@Body() dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  /**
   * Cập nhật thông tin, giá bán hoặc số lượng tồn kho (Cache Invalidation F04)
   * Đường dẫn đầy đủ: PATCH /api/v1/products/:id
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_STAFF)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cập nhật giá hoặc tồn kho (Tự động xóa sạch Cache cũ F04)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID sản phẩm dạng số cần sửa (ví dụ: 1)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật thành công, bộ đệm cache đã làm mới',
  })
  @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sản phẩm' })
  async updateProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.updateProduct(id, dto);
  }

  /**
   * Ẩn sản phẩm khỏi hệ thống (Soft delete)
   * Đường dẫn đầy đủ: DELETE /api/v1/products/:id
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_STAFF)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ẩn sản phẩm (Chỉ Admin và Nhân viên Kho)' })
  @ApiParam({
    name: 'id',
    description: 'ID sản phẩm dạng số cần ẩn (ví dụ: 1)',
  })
  @ApiResponse({ status: 200, description: 'Đã ẩn sản phẩm và làm mới cache' })
  async deleteProduct(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.deleteProduct(id);
  }
}
