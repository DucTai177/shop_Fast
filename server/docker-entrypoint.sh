#!/bin/sh
set -e

echo "=================================================="
echo "🚀 ShopFast Server Container Starting..."
echo "=================================================="

# Đồng bộ database schema (tự động tạo bảng nếu chưa có)
echo "📦 Synchronizing Prisma schema with PostgreSQL..."
npx prisma db push --skip-generate

# Nạp dữ liệu mẫu ban đầu (admin, cskh, khách hàng, sản phẩm, voucher)
echo "🌱 Checking & Seeding initial catalog data..."
node --experimental-strip-types prisma/seed.ts || echo "⚠️ Seed notice: Database already contains data or seed completed."

echo "✅ Database ready! Starting ShopFast NestJS Server..."
echo "=================================================="

# Chạy ứng dụng production
exec node dist/main.js

