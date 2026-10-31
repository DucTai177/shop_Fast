import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';

export interface IdempotencyResult<T> {
  success: boolean;
  skipped: boolean;
  result?: T;
  message?: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Thực thi một tác vụ bất đồng bộ với cơ chế chống xử lý trùng lặp (Idempotency Key F05)
   */
  async executeWithIdempotency<T>(
    key: string,
    jobType: string,
    task: () => Promise<T>,
  ): Promise<IdempotencyResult<T>> {
    // 1. Kiểm tra xem khóa này đã được xử lý thành công trước đó chưa
    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existing) {
      if (existing.status === 'COMPLETED') {
        this.logger.log(
          `[Idempotency] Tác vụ "${jobType}" với khóa "${key}" đã hoàn thành trước đó. Bỏ qua xử lý trùng lặp.`,
        );
        return {
          success: true,
          skipped: true,
          result: existing.response as T,
          message: 'Tác vụ đã được thực thi trước đó (Idempotent Hit)',
        };
      }

      if (existing.status === 'PROCESSING') {
        this.logger.warn(
          `[Idempotency] Tác vụ "${jobType}" với khóa "${key}" đang được một worker khác xử lý.`,
        );
        return {
          success: true,
          skipped: true,
          message: 'Tác vụ đang trong tiến trình xử lý',
        };
      }
    }

    // 2. Ghi nhận khóa vào CSDL ở trạng thái PROCESSING
    await this.prisma.idempotencyKey.upsert({
      where: { key },
      create: {
        key,
        jobType,
        status: 'PROCESSING',
      },
      update: {
        status: 'PROCESSING',
      },
    });

    // 3. Thực thi tác vụ chính
    try {
      const result = await task();

      // 4. Đánh dấu COMPLETED và lưu trữ snapshot kết quả
      await this.prisma.idempotencyKey.update({
        where: { key },
        data: {
          status: 'COMPLETED',
          response: (result !== undefined ? result : { completed: true }) as any,
        },
      });

      return {
        success: true,
        skipped: false,
        result,
      };
    } catch (err: any) {
      this.logger.error(
        `[Idempotency] Tác vụ "${jobType}" với khóa "${key}" gặp lỗi: ${err.message}`,
        err.stack,
      );

      await this.prisma.idempotencyKey.update({
        where: { key },
        data: {
          status: 'FAILED',
          response: { error: err.message },
        },
      });

      throw err;
    }
  }
}

