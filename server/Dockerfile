FROM node:22-slim

WORKDIR /app

# Cài đặt OpenSSL cho Prisma Engine trên Linux
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Copy package descriptors
COPY package*.json ./
COPY prisma ./prisma/

# Cài đặt toàn bộ dependencies (bao gồm Prisma CLI)
RUN npm ci

# Sinh Prisma Client
RUN npx prisma generate

# Copy toàn bộ mã nguồn
COPY . .

# Build mã nguồn TypeScript thành dist
RUN npm run build

# Phân quyền thực thi cho entrypoint script
RUN chmod +x docker-entrypoint.sh

# Chuyển đổi định dạng line-ending LF cho Linux (đề phòng Windows CRLF)
RUN sed -i 's/\r$//' docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
