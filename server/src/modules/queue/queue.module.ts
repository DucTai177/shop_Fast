import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_EMAIL, QUEUE_ORDER_TIMEOUT } from './queue.constants.js';
import { EmailWorker } from './workers/email.worker.js';
import { OrderTimeoutWorker } from './workers/order-timeout.worker.js';
import { QueueService } from './services/queue.service.js';
import { IdempotencyService } from './services/idempotency.service.js';
import { QueueController } from './queue.controller.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_EMAIL },
      { name: QUEUE_ORDER_TIMEOUT },
    ),
  ],
  controllers: [QueueController],
  providers: [
    EmailWorker,
    OrderTimeoutWorker,
    QueueService,
    IdempotencyService,
  ],
  exports: [QueueService, IdempotencyService, BullModule],
})
export class QueueModule {}
