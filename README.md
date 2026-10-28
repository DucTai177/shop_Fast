# ShopFast - E-Commerce High Performance & Scalable Platform
> **Defense Case Study 6 - Module 6 Final Project**

ShopFast là sàn thương mại điện tử phục vụ quy mô ~200.000 người dùng với kiến trúc Backend tối ưu (NestJS 10, PostgreSQL 16, Redis 7, Docker, AWS EC2, Nginx, CI/CD).

---

## 🏗️ Kiến Trúc Hệ Thống (System Architecture)

- **Backend**: NestJS 10 (TypeScript, Clean Architecture)
- **Database**: PostgreSQL 16
- **Caching & Key-Value Store**: Redis 7
- **Message Queue & Background Jobs**: BullMQ
- **Realtime**: WebSockets (Socket.io Gateway)
- **AI Agent**: Gemini API (Function Calling / Tool Use)
- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **DevOps & Cloud**: Docker, Docker Compose, Nginx Reverse Proxy, AWS EC2, GitHub Actions CI/CD (Zero-downtime & Auto Rollback)

---

## 📁 Cấu Trúc Dự Án (Monorepo Directory)

```
web-final/
├── .env.example              # Biến môi trường mẫu
├── docker-compose.yml        # Docker Compose (PostgreSQL 16, Redis 7)
├── server/                   # Backend NestJS
│   ├── src/
│   │   ├── common/           # Guards, Interceptors, Filters, Decorators
│   │   ├── config/           # App, Database, Redis, JWT config
│   │   ├── modules/
│   │   │   ├── auth/         # JWT, RBAC (Customer, Agent, Warehouse, Admin)
│   │   │   ├── users/        # Quản lý người dùng
│   │   │   ├── products/     # Danh mục sản phẩm, bộ lọc, Redis caching
│   │   │   ├── orders/       # Giỏ hàng, tạo đơn, kiểm tra tồn kho chống oversell
│   │   │   ├── realtime/     # WebSocket Gateway theo dõi đơn hàng thời gian thực
│   │   │   ├── queue/        # BullMQ gửi email, xuất hoá đơn, sync kho
│   │   │   ├── ai-agent/     # Trợ lý AI CSKH tra cứu trạng thái đơn & tồn kho
│   │   │   └── health/       # Healthcheck (DB + Redis)
│   │   ├── main.ts
│   │   └── app.module.ts
│   └── package.json
├── client/                   # Frontend Web UI (React + Vite)
└── docs/                     # Tài liệu đặc tả, sơ đồ kiến trúc, biên bản test
```

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh (Local Development)

### 1. Khởi động PostgreSQL và Redis
```bash
docker compose up -d
```

### 2. Khởi chạy Backend (Server)
```bash
cd server
npm install
npm run start:dev
```
API Documentation (Swagger): `http://localhost:3000/api/docs`

### 3. Khởi chạy Frontend (Client)
```bash
cd client
npm install
npm run dev
```
Client URL: `http://localhost:5173`
