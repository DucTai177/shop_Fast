import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { QueueModule } from '../queue/queue.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [QueueModule, RealtimeModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

