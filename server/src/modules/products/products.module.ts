import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { CategoriesController } from './categories.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
