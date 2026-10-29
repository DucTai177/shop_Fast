import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AddToCartDto } from './dto/add-to-cart.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lấy hoặc tự động tạo giỏ hàng cho tài khoản người dùng
   */
  private async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    return cart;
  }

  /**
   * Lấy chi tiết giỏ hàng của người dùng đang đăng nhập
   */
  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const fullCart = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                originalPrice: true,
                stock: true,
                images: true,
                isActive: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    // Tính toán tổng tiền, kiểm tra cảnh báo tồn kho
    let totalItems = 0;
    let subtotal = 0;
    let hasOutOfStockItem = false;

    const formattedItems = (fullCart?.items || []).map((item) => {
      const price = Number(item.product.price);
      const itemTotal = price * item.quantity;
      const isOutOfStock = item.product.stock < item.quantity || !item.product.isActive;

      if (isOutOfStock) {
        hasOutOfStockItem = true;
      }

      totalItems += item.quantity;
      subtotal += itemTotal;

      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        sku: item.product.sku,
        price,
        originalPrice: item.product.originalPrice ? Number(item.product.originalPrice) : null,
        stock: item.product.stock,
        images: item.product.images,
        quantity: item.quantity,
        itemTotal,
        isOutOfStock,
        isActive: item.product.isActive,
      };
    });

    return {
      data: {
        cartId: cart.id,
        totalItems,
        subtotal,
        hasOutOfStockItem,
        items: formattedItems,
      },
    };
  }

  /**
   * Thêm sản phẩm vào giỏ hàng
   */
  async addToCart(userId: string, dto: AddToCartDto) {
    // 1. Kiểm tra sản phẩm có tồn tại và đang kinh doanh không
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException(`Sản phẩm có ID "${dto.productId}" không tồn tại hoặc đã ngừng kinh doanh.`);
    }

    // 2. Kiểm tra tồn kho có đủ số lượng yêu cầu không
    if (product.stock < dto.quantity) {
      throw new BadRequestException(
        `Sản phẩm "${product.name}" hiện chỉ còn ${product.stock} chiếc trong kho. Bạn không thể thêm ${dto.quantity} chiếc.`,
      );
    }

    const cart = await this.getOrCreateCart(userId);

    // 3. Kiểm tra xem sản phẩm đã có sẵn trong giỏ chưa
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: dto.productId,
        },
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + dto.quantity;
      if (newQuantity > product.stock) {
        throw new BadRequestException(
          `Bạn đã có ${existingItem.quantity} sản phẩm trong giỏ. Tồn kho chỉ còn ${product.stock}, không thể thêm tiếp ${dto.quantity} chiếc.`,
        );
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  /**
   * Cập nhật số lượng của một món trong giỏ hàng
   */
  async updateCartItem(userId: string, cartItemId: string, dto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
      include: { product: true },
    });

    if (!item) {
      throw new NotFoundException(`Không tìm thấy món hàng có mã "${cartItemId}" trong giỏ của bạn.`);
    }

    // Nếu số lượng = 0 thì tiến hành xóa món khỏi giỏ
    if (dto.quantity <= 0) {
      await this.prisma.cartItem.delete({
        where: { id: cartItemId },
      });
      return this.getCart(userId);
    }

    // Kiểm tra tồn kho
    if (item.product.stock < dto.quantity) {
      throw new BadRequestException(
        `Sản phẩm "${item.product.name}" hiện chỉ còn ${item.product.stock} chiếc trong kho.`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: dto.quantity },
    });

    return this.getCart(userId);
  }

  /**
   * Xóa 1 món khỏi giỏ hàng
   */
  async removeCartItem(userId: string, cartItemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: cartItemId,
        cartId: cart.id,
      },
    });

    if (!item) {
      throw new NotFoundException(`Không tìm thấy món hàng có mã "${cartItemId}" trong giỏ của bạn.`);
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    return {
      message: 'Đã xóa sản phẩm khỏi giỏ hàng thành công.',
    };
  }

  /**
   * Xóa sạch toàn bộ giỏ hàng
   */
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return {
      message: 'Đã dọn sạch toàn bộ giỏ hàng.',
    };
  }
}
