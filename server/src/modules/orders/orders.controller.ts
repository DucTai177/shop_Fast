import {
  Body,
  Controller,
  Get,
  Param,
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
import { OrdersService } from './orders.service.js';
import type { CurrentUserPayload } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { FilterOrderDto } from './dto/filter-order.dto.js';
import { CancelOrderDto, UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '@prisma/client';

@ApiTags('Orders (Đơn hàng & Tồn kho - F06, F02, F05)')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Tạo đơn hàng mới (Chống bán âm kho với Prisma Transaction)
   * Đường dẫn: POST /api/v1/orders
   */
  @Post()
  @ApiOperation({
    summary: 'Đặt hàng mới (Kiểm tra và trừ kho an toàn chống Race Condition F06)',
  })
  @ApiResponse({ status: 201, description: 'Đặt hàng thành công, trừ tồn kho và dọn giỏ hàng' })
  @ApiResponse({ status: 400, description: 'Sản phẩm không đủ tồn kho hoặc giỏ hàng trống' })
  async createOrder(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(userId, dto);
  }

  /**
   * Lấy danh sách đơn hàng
   * Đường dẫn: GET /api/v1/orders
   */
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách đơn hàng (Khách hàng xem đơn của mình; Quản trị/Kho xem toàn bộ)',
  })
  @ApiResponse({ status: 200, description: 'Danh sách đơn hàng kèm phân trang' })
  async getOrders(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: FilterOrderDto,
  ) {
    return this.ordersService.getOrders(user, query);
  }

  /**
   * Xem chi tiết một đơn hàng theo ID hoặc Mã đơn hàng
   * Đường dẫn: GET /api/v1/orders/:idOrOrderNumber
   */
  @Get(':idOrOrderNumber')
  @ApiOperation({
    summary: 'Xem chi tiết đơn hàng kèm lịch sử trạng thái vận chuyển (OrderStatusHistory)',
  })
  @ApiParam({
    name: 'idOrOrderNumber',
    description: 'UUID đơn hàng hoặc Mã thân thiện (ví dụ: SF20261028001)',
  })
  @ApiResponse({ status: 200, description: 'Thông tin chi tiết đơn hàng và lịch sử' })
  @ApiResponse({ status: 403, description: 'Không có quyền xem đơn hàng của người khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  async getOrderDetail(
    @CurrentUser() user: CurrentUserPayload,
    @Param('idOrOrderNumber') idOrOrderNumber: string,
  ) {
    return this.ordersService.getOrderDetail(user, idOrOrderNumber);
  }

  /**
   * Cập nhật trạng thái đơn hàng (Dành riêng cho Admin, Nhân viên kho, Hỗ trợ)
   * Đường dẫn: PATCH /api/v1/orders/:id/status
   */
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.WAREHOUSE_STAFF, UserRole.SUPPORT_AGENT)
  @ApiOperation({
    summary: 'Cập nhật trạng thái đơn hàng (Nếu CANCELLED sẽ tự động hoàn kho)',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng (UUID)' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  @ApiResponse({ status: 403, description: 'Không có quyền thực hiện thao tác này' })
  async updateOrderStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(user, orderId, dto);
  }

  /**
   * Khách hàng tự hủy đơn hàng của mình khi đơn còn PENDING
   * Đường dẫn: POST /api/v1/orders/:id/cancel
   */
  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Khách hàng tự hủy đơn khi đơn còn PENDING (Tự động hoàn trả tồn kho)',
  })
  @ApiParam({ name: 'id', description: 'ID đơn hàng (UUID)' })
  @ApiResponse({ status: 200, description: 'Hủy đơn và hoàn tồn kho thành công' })
  @ApiResponse({ status: 400, description: 'Đơn hàng không ở trạng thái PENDING' })
  async cancelOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrderByCustomer(user, orderId, dto);
  }
}
