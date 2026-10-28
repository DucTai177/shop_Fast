import {
  PrismaClient,
  UserRole,
  OrderStatus,
  PaymentStatus,
  TicketCategory,
  TicketStatus,
  TicketPriority,
  SenderType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for ShopFast...');

  // 1. Clean existing records (in reverse relation order)
  await prisma.idempotencyKey.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned old records.');

  // 2. Hash default passwords
  const passwordAdmin = await bcrypt.hash('Admin@123456', 10);
  const passwordStaff = await bcrypt.hash('Staff@123456', 10);
  const passwordCustomer = await bcrypt.hash('Customer@123456', 10);

  // 3. Seed Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@shopfast.vn',
      passwordHash: passwordAdmin,
      fullName: 'Quản Trị Viên ShopFast',
      phone: '0901000001',
      role: UserRole.ADMIN,
    },
  });

  const warehouseStaff = await prisma.user.create({
    data: {
      email: 'warehouse@shopfast.vn',
      passwordHash: passwordStaff,
      fullName: 'Nguyễn Văn Kho',
      phone: '0901000002',
      role: UserRole.WAREHOUSE_STAFF,
    },
  });

  const supportAgent = await prisma.user.create({
    data: {
      email: 'support@shopfast.vn',
      passwordHash: passwordStaff,
      fullName: 'Trần Thị Chăm Sóc',
      phone: '0901000003',
      role: UserRole.SUPPORT_AGENT,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      email: 'customer@shopfast.vn',
      passwordHash: passwordCustomer,
      fullName: 'Lê Hoàng Nam',
      phone: '0901000004',
      role: UserRole.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'viet@gmail.com',
      passwordHash: passwordCustomer,
      fullName: 'Đoàn Quốc Việt',
      phone: '0901000005',
      role: UserRole.CUSTOMER,
    },
  });

  console.log('✅ Users seeded (Admin, Warehouse, Support, 2 Customers).');

  // 4. Seed Categories
  const catPhone = await prisma.category.create({
    data: {
      name: 'Điện Thoại & Tablet',
      slug: 'dien-thoai-tablet',
      description: 'Smartphone và máy tính bảng thế hệ mới nhất',
    },
  });

  const catLaptop = await prisma.category.create({
    data: {
      name: 'Laptop & Thiết Bị IT',
      slug: 'laptop-it',
      description: 'Máy tính xách tay và linh kiện máy tính chuyên nghiệp',
    },
  });

  const catAudio = await prisma.category.create({
    data: {
      name: 'Âm Thanh & Tai Nghe',
      slug: 'am-thanh',
      description: 'Tai nghe chống ồn, loa bluetooth cao cấp',
    },
  });

  const catAccessory = await prisma.category.create({
    data: {
      name: 'Phụ Kiện Công Nghệ',
      slug: 'phu-kien',
      description: 'Củ sạc, cáp sạc, chuột, bàn phím cơ',
    },
  });

  console.log('✅ Categories seeded.');

  // 5. Seed Products
  const products = [
    {
      sku: 'SF-IP15PM-256',
      name: 'iPhone 15 Pro Max 256GB Titan Tự Nhiên',
      slug: 'iphone-15-pro-max-256gb',
      description:
        'Thiết kế Titan chuẩn hàng không vũ trụ, chip A17 Pro mạnh mẽ, camera tiềm vọng zoom 5x.',
      price: 29990000,
      originalPrice: 34990000,
      stock: 45,
      brand: 'Apple',
      categoryId: catPhone.id,
      images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569'],
    },
    {
      sku: 'SF-SGS24U-256',
      name: 'Samsung Galaxy S24 Ultra 256GB AI Phone',
      slug: 'samsung-galaxy-s24-ultra-256gb',
      description:
        'Quyền năng Galaxy AI, khung viền Titan và bút S-Pen tích hợp.',
      price: 27990000,
      originalPrice: 31990000,
      stock: 30,
      brand: 'Samsung',
      categoryId: catPhone.id,
      images: ['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c'],
    },
    {
      sku: 'SF-MBA-M3-16',
      name: 'MacBook Air M3 13 inch (16GB RAM / 512GB SSD)',
      slug: 'macbook-air-m3-16gb-512gb',
      description:
        'Siêu mỏng nhẹ, chip M3 đỉnh cao đồ hoạ, thời lượng pin lên đến 18 tiếng.',
      price: 32490000,
      originalPrice: 35990000,
      stock: 20,
      brand: 'Apple',
      categoryId: catLaptop.id,
      images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8'],
    },
    {
      sku: 'SF-SONY-XM5',
      name: 'Tai nghe chụp tai Sony WH-1000XM5 Chống Ồn',
      slug: 'tai-nghe-sony-wh-1000xm5',
      description:
        'Công nghệ chống ồn đỉnh cao hàng đầu thế giới với 2 bộ xử lý và 8 micro.',
      price: 7490000,
      originalPrice: 8490000,
      stock: 18,
      brand: 'Sony',
      categoryId: catAudio.id,
      images: ['https://images.unsplash.com/photo-1546435770-a3e426bf472b'],
    },
    {
      sku: 'SF-LOGI-MXM3S',
      name: 'Chuột Không Dây Logitech MX Master 3S',
      slug: 'chuot-logitech-mx-master-3s',
      description:
        'Cảm biến 8000 DPI Darkfield di chuyển mượt mà trên mọi bề mặt, con lăn MagSpeed siêu tốc.',
      price: 2190000,
      originalPrice: 2490000,
      stock: 65,
      brand: 'Logitech',
      categoryId: catAccessory.id,
      images: ['https://images.unsplash.com/photo-1527864550417-7fd91fc51a46'],
    },
    {
      sku: 'SF-LOGI-MXMECH',
      name: 'Bàn Phím Cơ Không Dây Logitech MX Mechanical Tactile',
      slug: 'ban-phim-logitech-mx-mechanical',
      description:
        'Phím cơ switch Low Profile êm ái, đèn nền thông minh tự điều chỉnh theo môi trường.',
      price: 3290000,
      originalPrice: 3890000,
      stock: 40,
      brand: 'Logitech',
      categoryId: catAccessory.id,
      images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3'],
    },
    {
      sku: 'SF-ANKER-65W',
      name: 'Củ Sạc Nhanh Anker 65W GaNPrime 3 Cổng (A2668)',
      slug: 'cu-sac-nhanh-anker-65w-gan',
      description:
        'Công nghệ GaNPrime độc quyền nhỏ gọn hơn 53%, công suất 65W sạc nhanh cùng lúc 3 thiết bị.',
      price: 850000,
      originalPrice: 1100000,
      stock: 150,
      brand: 'Anker',
      categoryId: catAccessory.id,
      images: ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0'],
    },
  ];

  for (const item of products) {
    await prisma.product.create({ data: item });
  }

  console.log(`✅ ${products.length} Products seeded.`);

  // 6. Seed Orders & Order Histories (for Realtime F02 & AI lookup F01)
  const productPhone = await prisma.product.findUnique({
    where: { sku: 'SF-IP15PM-256' },
  });
  const productCharger = await prisma.product.findUnique({
    where: { sku: 'SF-ANKER-65W' },
  });

  if (productPhone && productCharger) {
    // Order 1: Đang giao hàng (SHIPPING)
    const order1 = await prisma.order.create({
      data: {
        orderNumber: 'SF20261028001',
        userId: customer1.id,
        status: OrderStatus.SHIPPING,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: 'BANK_TRANSFER',
        subtotal: 30840000,
        shippingFee: 0,
        totalAmount: 30840000,
        receiverName: customer1.fullName,
        receiverPhone: customer1.phone || '0901000004',
        shippingAddress:
          'Tòa nhà Landmark 81, Phường 22, Quận Bình Thạnh, TP. Hồ Chí Minh',
        notes: 'Giao giờ hành chính, gọi trước 15 phút',
        items: {
          create: [
            {
              productId: productPhone.id,
              productName: productPhone.name,
              sku: productPhone.sku,
              price: productPhone.price,
              quantity: 1,
              totalPrice: productPhone.price,
            },
            {
              productId: productCharger.id,
              productName: productCharger.name,
              sku: productCharger.sku,
              price: productCharger.price,
              quantity: 1,
              totalPrice: productCharger.price,
            },
          ],
        },
      },
    });

    // Create history logs for order 1
    await prisma.orderStatusHistory.createMany({
      data: [
        {
          orderId: order1.id,
          fromStatus: null,
          toStatus: OrderStatus.PENDING,
          note: 'Khách hàng tạo đơn hàng qua cổng trực tuyến',
          updatedById: customer1.id,
        },
        {
          orderId: order1.id,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.CONFIRMED,
          note: 'Hệ thống tự động xác nhận sau khi nhận thanh toán chuyển khoản',
          updatedById: admin.id,
        },
        {
          orderId: order1.id,
          fromStatus: OrderStatus.CONFIRMED,
          toStatus: OrderStatus.PACKING,
          note: 'Kho đóng gói sản phẩm và dán mã vận đơn',
          updatedById: warehouseStaff.id,
        },
        {
          orderId: order1.id,
          fromStatus: OrderStatus.PACKING,
          toStatus: OrderStatus.SHIPPING,
          note: 'Bàn giao đơn vị vận chuyển Viettel Post. Mã bưu gửi: VTP889922',
          updatedById: warehouseStaff.id,
        },
      ],
    });

    console.log(
      `✅ Order 1 (SF20261028001) seeded with 4 status history events.`,
    );
  }

  // 7. Seed Support Ticket & Messages (for AI Agent F01)
  const ticket1 = await prisma.ticket.create({
    data: {
      ticketNumber: 'TK-20261028-01',
      userId: customer1.id,
      title: 'Hỏi tiến độ giao hàng cho đơn SF20261028001',
      category: TicketCategory.ORDER_INQUIRY,
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.MEDIUM,
      assignedToId: supportAgent.id,
      messages: {
        create: [
          {
            senderType: SenderType.CUSTOMER,
            senderId: customer1.id,
            content:
              'Chào ShopFast, đơn hàng SF20261028001 của tôi khi nào sẽ giao đến Landmark 81 vậy?',
          },
          {
            senderType: SenderType.AI_AGENT,
            content:
              'Xin chào anh Lê Hoàng Nam! Trợ lý AI ShopFast đã tra cứu đơn hàng SF20261028001 của anh: Đơn hàng hiện đang ở trạng thái Đang giao hàng (SHIPPING), bàn giao qua Viettel Post (Mã bưu gửi: VTP889922). Dự kiến bưu tá sẽ giao tới Landmark 81 trong ngày hôm nay!',
            toolCalls: {
              tool: 'checkOrderStatus',
              orderNumber: 'SF20261028001',
              result: { status: 'SHIPPING', trackingCode: 'VTP889922' },
            },
          },
        ],
      },
    },
  });

  console.log(`✅ Ticket (TK-20261028-01) seeded.`);
  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
