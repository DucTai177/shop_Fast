import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CartService } from './cart.service.js';
import { AddToCartDto } from './dto/add-to-cart.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Cart (Giỏ hàng - F06)')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * Lấy giỏ hàng của người dùng hiện tại
   * Đường dẫn: GET /api/v1/cart
   */
  @Get()
  @ApiOperation({ summary: 'Lấy thông tin giỏ hàng và danh sách sản phẩm' })
  @ApiResponse({ status: 200, description: 'Chi tiết giỏ hàng kèm tổng tiền và kiểm tra tồn kho' })
  async getCart(@CurrentUser('id') userId: string) {
    return this.cartService.getCart(userId);
  }

  /**
   * Thêm sản phẩm vào giỏ hàng
   * Đường dẫn: POST /api/v1/cart/items
   */
  @Post('items')
  @ApiOperation({ summary: 'Thêm sản phẩm vào giỏ hàng (Kiểm tra tồn kho thực tế)' })
  @ApiResponse({ status: 201, description: 'Thêm thành công, trả về giỏ hàng mới nhất' })
  @ApiResponse({ status: 400, description: 'Số lượng yêu cầu vượt quá tồn kho' })
  @ApiResponse({ status: 404, description: 'Sản phẩm không tồn tại hoặc đã ngừng bán' })
  async addToCart(
    @CurrentUser('id') userId: string,
    @Body() dto: AddToCartDto,
  ) {
    return this.cartService.addToCart(userId, dto);
  }

  /**
   * Cập nhật số lượng của món hàng trong giỏ
   * Đường dẫn: PATCH /api/v1/cart/items/:id
   */
  @Patch('items/:id')
  @ApiOperation({ summary: 'Cập nhật số lượng món trong giỏ (nếu truyền 0 sẽ xóa)' })
  @ApiParam({ name: 'id', description: 'ID của mục trong giỏ (CartItem ID)' })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 400, description: 'Số lượng vượt quá tồn kho' })
  @ApiResponse({ status: 404, description: 'Món hàng không tồn tại trong giỏ' })
  async updateCartItem(
    @CurrentUser('id') userId: string,
    @Param('id') cartItemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(userId, cartItemId, dto);
  }

  /**
   * Xóa 1 món khỏi giỏ hàng
   * Đường dẫn: DELETE /api/v1/cart/items/:id
   */
  @Delete('items/:id')
  @ApiOperation({ summary: 'Xóa một sản phẩm ra khỏi giỏ hàng' })
  @ApiParam({ name: 'id', description: 'ID của mục trong giỏ (CartItem ID)' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  async removeCartItem(
    @CurrentUser('id') userId: string,
    @Param('id') cartItemId: string,
  ) {
    return this.cartService.removeCartItem(userId, cartItemId);
  }

  /**
   * Xóa sạch toàn bộ giỏ hàng
   * Đường dẫn: DELETE /api/v1/cart
   */
  @Delete()
  @ApiOperation({ summary: 'Dọn sạch toàn bộ giỏ hàng' })
  @ApiResponse({ status: 200, description: 'Dọn sạch giỏ hàng thành công' })
  async clearCart(@CurrentUser('id') userId: string) {
    return this.cartService.clearCart(userId);
  }
}

