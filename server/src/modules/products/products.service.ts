import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { FilterProductDto } from './dto/filter-product.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  /**
   * Lấy danh sách danh mục (Có Caching Redis 1 giờ)
   */
  async getCategories() {
    const cacheKey = 'categories:all';
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return { data: cached, fromCache: true };
    }

    const categories = await this.prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    await this.redisService.set(cacheKey, categories, 3600);
    return { data: categories, fromCache: false };
  }

  /**
   * Lấy danh sách sản phẩm có bộ lọc nâng cao (Tích hợp Redis Caching F04)
   */
  async getProducts(query: FilterProductDto) {
    const startTime = Date.now();
    // Tạo khóa cache duy nhất theo đúng các tham số query
    const cacheKey = `products:list:${JSON.stringify(query)}`;

    // 1. Kiểm tra trong Redis trước (Mục tiêu phản hồi < 20ms)
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      const duration = Date.now() - startTime;
      return {
        ...cached,
        responseTimeMs: duration,
        fromCache: true,
      };
    }

    // 2. Cache miss -> Truy vấn PostgreSQL qua Prisma
    const {
      search,
      categoryId,
      categorySlug,
      brand,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    } else if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result = {
      data: items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };

    // 3. Lưu vào Redis Cache (Hạn sống 5 phút = 300s)
    await this.redisService.set(cacheKey, result, 300);

    const duration = Date.now() - startTime;
    return {
      ...result,
      responseTimeMs: duration,
      fromCache: false,
    };
  }

  /**
   * Xem chi tiết sản phẩm theo ID, Slug hoặc SKU (Chống Cache Penetration F04)
   */
  async getProductByIdOrSlug(idOrSlug: string) {
    const startTime = Date.now();
    const cacheKey = `products:detail:${idOrSlug}`;

    // 1. Kiểm tra cache Redis
    const cached = await this.redisService.get<any>(cacheKey);
    if (cached) {
      // Cơ chế chống Cache Penetration: Nếu trong cache ghi nhận ID không tồn tại
      if (cached === '__NOT_FOUND__') {
        throw new NotFoundException(`Không tìm thấy sản phẩm có mã "${idOrSlug}".`);
      }
      return {
        data: cached,
        responseTimeMs: Date.now() - startTime,
        fromCache: true,
      };
    }

    // 2. Truy vấn DB
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
          { sku: idOrSlug },
        ],
      },
      include: {
        category: true,
      },
    });

    // 3. Nếu KHÔNG tìm thấy -> Chống Cache Penetration bằng cách lưu cờ '__NOT_FOUND__' 60s
    if (!product) {
      await this.redisService.set(cacheKey, '__NOT_FOUND__', 60);
      throw new NotFoundException(`Không tìm thấy sản phẩm có mã "${idOrSlug}".`);
    }

    // 4. Nếu tìm thấy -> Lưu cache 10 phút (600s)
    await this.redisService.set(cacheKey, product, 600);

    return {
      data: product,
      responseTimeMs: Date.now() - startTime,
      fromCache: false,
    };
  }

  /**
   * Thêm sản phẩm mới (Kèm Cache Invalidation)
   */
  async createProduct(dto: CreateProductDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ sku: dto.sku }, { slug }],
      },
    });

    if (existing) {
      throw new ConflictException(`Sản phẩm với SKU "${dto.sku}" hoặc slug "${slug}" đã tồn tại.`);
    }

    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        slug,
        description: dto.description,
        price: dto.price,
        originalPrice: dto.originalPrice,
        stock: dto.stock,
        brand: dto.brand,
        categoryId: dto.categoryId,
        images: dto.images || [],
      },
      include: { category: true },
    });

    // Xóa cache danh sách sản phẩm và danh mục để khách thấy sản phẩm mới
    await this.clearProductCaches();

    return {
      message: 'Tạo sản phẩm mới thành công.',
      data: product,
    };
  }

  /**
   * Cập nhật thông tin sản phẩm, giá hoặc tồn kho (Cache Invalidation bắt buộc F04)
   */
  async updateProduct(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm có ID "${id}".`);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
      },
      include: { category: true },
    });

    // Cache Invalidation F04: Xóa sạch cache chi tiết và danh sách để không bao giờ thấy giá cũ
    await Promise.all([
      this.clearProductCaches(),
      this.redisService.del(`products:detail:${product.id}`),
      this.redisService.del(`products:detail:${product.slug}`),
      this.redisService.del(`products:detail:${product.sku}`),
    ]);

    if (dto.slug && dto.slug !== product.slug) {
      await this.redisService.del(`products:detail:${dto.slug}`);
    }

    return {
      message: 'Cập nhật sản phẩm thành công. Bộ nhớ đệm liên quan đã được làm mới.',
      data: updated,
    };
  }

  /**
   * Xóa sản phẩm (Soft delete)
   */
  async deleteProduct(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm có ID "${id}".`);
    }

    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await Promise.all([
      this.clearProductCaches(),
      this.redisService.del(`products:detail:${product.id}`),
      this.redisService.del(`products:detail:${product.slug}`),
      this.redisService.del(`products:detail:${product.sku}`),
    ]);

    return {
      message: 'Đã ẩn sản phẩm khỏi hệ thống và làm mới bộ đệm cache.',
    };
  }

  /**
   * Hàm xóa toàn bộ cache danh sách sản phẩm
   */
  private async clearProductCaches() {
    await Promise.all([
      this.redisService.delByPattern('products:list:*'),
      this.redisService.del('categories:all'),
    ]);
  }

  /**
   * Hàm hỗ trợ tạo slug chuẩn SEO từ tên sản phẩm tiếng Việt
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
