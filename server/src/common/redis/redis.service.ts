import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = Number(this.configService.get<number>('REDIS_PORT')) || 6379;
    const password = this.configService.get<string>('REDIS_PASSWORD') || undefined;

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        retryStrategy(times) {
          if (times > 3) {
            return null; // Dừng retry nếu quá 3 lần, kích hoạt fallback
          }
          return Math.min(times * 1000, 3000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`✅ Kết nối Redis thành công tại ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`⚠️ [Graceful Degradation] Redis không sẵn sàng: ${err.message}. Hệ thống chuyển sang truy vấn trực tiếp PostgreSQL.`);
      });

      await this.client.connect().catch((err) => {
        this.isConnected = false;
        this.logger.warn(`⚠️ [Graceful Degradation] Không thể kết nối Redis: ${err.message}. Tiếp tục chạy không dùng cache.`);
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`⚠️ [Graceful Degradation] Lỗi khởi tạo Redis: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // Ignored on teardown
      }
    }
  }

  /**
   * Đọc dữ liệu từ Cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Lưu dữ liệu vào Cache kèm thời gian sống (TTL tính bằng giây)
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
    } catch {
      // Bỏ qua lỗi cache để không ảnh hưởng luồng chính
    }
  }

  /**
   * Xóa một key cache cụ thể
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // Ignored
    }
  }

  /**
   * Xóa hàng loạt cache theo mẫu (Cache Invalidation F04)
   * Ví dụ: delByPattern('products:*') sẽ xóa sạch toàn bộ cache sản phẩm khi có cập nhật giá hoặc kho
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch {
      // Ignored
    }
  }

  /**
   * Kiểm tra trạng thái sẵn sàng của Redis (phục vụ Healthcheck F07)
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
