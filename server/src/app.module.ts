import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { CartModule } from './modules/cart/cart.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { QueueModule } from './modules/queue/queue.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    QueueModule,
    RealtimeModule,
    AiAgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
