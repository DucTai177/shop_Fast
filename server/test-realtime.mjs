import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3000/api/v1';
const WS_URL = 'http://localhost:3000';

async function main() {
  console.log('🧪 BẮT ĐẦU TEST TOÀN DIỆN MODULE 5: REALTIME SOCKET.IO (F02)\n');

  // 1. Đăng nhập Admin
  console.log('1️⃣ Đăng nhập Admin & Customer...');
  const adminRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@shopfast.vn',
      password: 'Admin@123456',
    }),
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.tokens?.accessToken || adminData.data?.accessToken;
  if (!adminToken) throw new Error('Đăng nhập Admin thất bại: ' + JSON.stringify(adminData));
  console.log('   ✅ Đăng nhập Admin thành công!');

  // 2. Đăng nhập Customer
  const custRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'customer@shopfast.vn',
      password: 'Customer@123456',
    }),
  });
  const custData = await custRes.json();
  const custToken = custData.tokens?.accessToken || custData.data?.accessToken;
  if (!custToken) throw new Error('Đăng nhập Customer thất bại: ' + JSON.stringify(custData));
  console.log('   ✅ Đăng nhập Customer thành công!');

  // 3. Kết nối Socket.io
  console.log('\n2️⃣ Kết nối 2 Socket Client (1 Tab Admin, 1 Tab Khách Hàng)...');
  const adminSocket = io(WS_URL, {
    auth: { token: adminToken },
    transports: ['websocket', 'polling'],
  });

  const customerSocket = io(WS_URL, {
    auth: { token: custToken },
    transports: ['websocket', 'polling'],
  });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve(true);
    };
    adminSocket.on('connect', () => {
      console.log('   🟢 Admin Socket connected! ID:', adminSocket.id);
      check();
    });
    customerSocket.on('connect', () => {
      console.log('   🟢 Customer Socket connected! ID:', customerSocket.id);
      check();
    });
  });

  // 4. Lắng nghe sự kiện "order:created" trên Admin Socket
  let newOrderReceived = null;
  adminSocket.on('order:created', (data) => {
    console.log('\n🔔 [ADMIN NHẬN REALTIME] Sự kiện "order:created":');
    console.log(`   Mã đơn: ${data.orderNumber} | Tổng tiền: ${data.totalAmount} đ | Khách: ${data.receiverName}`);
    newOrderReceived = data;
  });

  // 5. Khách hàng tạo đơn hàng mới
  console.log('\n3️⃣ Khách hàng tiến hành đặt đơn hàng mới qua API...');
  const createOrderRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      paymentMethod: 'BANK_TRANSFER',
      receiverName: 'Nguyễn Văn Test Realtime',
      receiverPhone: '0988776655',
      shippingAddress: '123 Đường Realtime, Quận 1, TP.HCM',
      notes: 'Giao hàng giờ hành chính',
      items: [{ productId: 1, quantity: 1 }],
    }),
  });
  const orderResData = await createOrderRes.json();
  const order = orderResData.data;
  console.log(`   ✅ Đặt hàng thành công! Mã đơn: ${order.orderNumber} (ID: ${order.id})`);

  // Chờ một chút để Admin nhận được realtime event
  await new Promise((r) => setTimeout(r, 1000));
  if (!newOrderReceived || newOrderReceived.orderNumber !== order.orderNumber) {
    throw new Error('Admin không nhận được realtime order:created!');
  }
  console.log('   ✨ Xác nhận: Admin đã nhận được thông báo đơn hàng mới qua Socket.io!');

  // 6. Khách hàng mở trang theo dõi đơn hàng -> Gửi lệnh joinOrder
  console.log('\n4️⃣ Khách hàng mở trang theo dõi đơn hàng -> Gửi "joinOrder" vào phòng riêng của đơn...');
  const joinAck = await new Promise((resolve) => {
    customerSocket.emit('joinOrder', { orderNumber: order.orderNumber }, (ack) => {
      resolve(ack);
    });
    setTimeout(() => resolve(null), 1000);
  });
  console.log('   ✅ Đã vào phòng theo dõi đơn hàng:', order.orderNumber);

  // 7. Lắng nghe "order:statusUpdated" ở cả 2 tab (Khách & Admin)
  let customerStatusUpdate = null;
  let adminStatusUpdate = null;

  customerSocket.on('order:statusUpdated', (data) => {
    console.log('\n📱 [KHÁCH HÀNG NHẬN REALTIME] Sự kiện "order:statusUpdated":');
    console.log(`   Đơn ${data.orderNumber}: Trạng thái đổi từ [${data.fromStatus}] -> [${data.toStatus}]`);
    console.log(`   Ghi chú: ${data.note}`);
    customerStatusUpdate = data;
  });

  adminSocket.on('order:statusUpdated', (data) => {
    console.log('\n💻 [ADMIN DASHBOARD NHẬN REALTIME] Sự kiện "order:statusUpdated":');
    console.log(`   Đơn ${data.orderNumber}: Trạng thái [${data.toStatus}] bởi ${data.updatedBy?.fullName || 'Hệ thống'}`);
    adminStatusUpdate = data;
  });

  // 8. Admin cập nhật trạng thái đơn hàng sang "CONFIRMED" (Đã xác nhận)
  console.log('\n5️⃣ Admin chuyển trạng thái đơn hàng sang CONFIRMED...');
  const updateRes = await fetch(`${API_BASE}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      status: 'CONFIRMED',
      note: 'Admin đã duyệt và xác nhận đơn hàng',
    }),
  });
  const updateData = await updateRes.json();
  console.log('   ✅ API cập nhật trạng thái trả về:', JSON.stringify(updateData));

  // Chờ nhận realtime
  await new Promise((r) => setTimeout(r, 1000));
  if (
    !customerStatusUpdate ||
    customerStatusUpdate.toStatus !== 'CONFIRMED' ||
    !adminStatusUpdate ||
    adminStatusUpdate.toStatus !== 'CONFIRMED'
  ) {
    throw new Error('Chưa nhận đủ realtime event order:statusUpdated!');
  }
  console.log('   ✨ Xác nhận: Cả Tab Khách hàng và Tab Admin đều nhận được cập nhật CONFIRMED theo thời gian thực!');

  // 9. Admin chuyển tiếp sang SHIPPING (Đang vận chuyển)
  console.log('\n6️⃣ Admin chuyển trạng thái tiếp sang SHIPPING...');
  customerStatusUpdate = null;
  adminStatusUpdate = null;

  await fetch(`${API_BASE}/orders/${order.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      status: 'SHIPPING',
      note: 'Đơn hàng đã bàn giao cho shipper GHTK',
    }),
  });

  await new Promise((r) => setTimeout(r, 1000));
  if (!customerStatusUpdate || customerStatusUpdate.toStatus !== 'SHIPPING') {
    throw new Error('Khách hàng không nhận được realtime SHIPPING!');
  }
  console.log('   ✨ Xác nhận: Khách hàng nhận được thông báo SHIPPING ngay lập tức không cần F5 tải lại trang!');

  // 10. TEST TÍNH NĂNG TỰ ĐỘNG HỦY ĐƠN HẾT HẠN (BullMQ Worker) VÀ NHẬN REALTIME
  console.log('\n7️⃣ Tạo đơn thứ 2 và test tự động hủy đơn sau 3 giây (BullMQ Timeout Worker -> Socket.io Realtime)...');
  const order2Res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      paymentMethod: 'BANK_TRANSFER',
      receiverName: 'Khách Test Timeout Realtime',
      receiverPhone: '0911223344',
      shippingAddress: '456 Đường Hẹn Giờ Hủy, Hà Nội',
      items: [{ productId: 2, quantity: 1 }],
    }),
  });
  const order2Data = await order2Res.json();
  const order2 = order2Data.data;
  console.log(`   ✅ Đã tạo đơn thứ 2: ${order2.orderNumber}`);

  // Khách join phòng của đơn thứ 2
  await new Promise((resolve) => {
    customerSocket.emit('joinOrder', { orderNumber: order2.orderNumber }, () => resolve(true));
    setTimeout(() => resolve(null), 500);
  });

  customerStatusUpdate = null;
  adminStatusUpdate = null;

  // Kích hoạt hẹn giờ hủy nhanh sau 3 giây
  console.log('   ⏱️ Đang kích hoạt job hẹn giờ hủy sau 3 giây qua BullMQ...');
  await fetch(`${API_BASE}/queue/test-timeout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      orderId: order2.id,
      orderNumber: order2.orderNumber,
      delaySeconds: 3,
    }),
  });

  console.log('   ⏳ Đang đợi BullMQ Worker kích hoạt sau 3 giây...');
  await new Promise((r) => setTimeout(r, 4500));

  if (!customerStatusUpdate || customerStatusUpdate.toStatus !== 'CANCELLED') {
    throw new Error('Khách hàng không nhận được realtime CANCELLED từ BullMQ Worker!');
  }
  console.log('   ✨ Xác nhận: Khi BullMQ tự hủy đơn, Socket.io Realtime lập tức đẩy trạng thái CANCELLED tới màn hình khách hàng!');

  // Dọn dẹp sockets
  adminSocket.disconnect();
  customerSocket.disconnect();

  console.log('\n🎉🎉🎉 TẤT CẢ TEST REALTIME SOCKET.IO + BULLMQ WORKER (MODULE 5 - F02) ĐÃ VƯỢT QUA XUẤT SẮC! 🎉🎉🎉');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ TEST THẤT BẠI:', err.message);
  process.exit(1);
});
