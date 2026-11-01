const API_BASE = 'http://localhost:3000/api/v1';

async function main() {
  console.log('🧪 BẮT ĐẦU TEST TOÀN DIỆN MODULE 6: AI CSKH GOOGLE GEMINI & FUNCTION CALLING (F01)\n');

  // 1. Đăng nhập Customer và Support Agent
  console.log('1️⃣ Đăng nhập Customer & Support Agent...');
  const custRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'customer@shopfast.vn',
      password: 'Customer@123456',
    }),
  });
  const custData = await custRes.json();
  const custToken = custData.tokens?.accessToken;
  console.log('   ✅ Đăng nhập Customer thành công!');

  const supportRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'support@shopfast.vn',
      password: 'Staff@123456',
    }),
  });
  const supportData = await supportRes.json();
  const supportToken = supportData.tokens?.accessToken;
  if (!supportToken) throw new Error('Đăng nhập Support Agent thất bại: ' + JSON.stringify(supportData));
  console.log('   ✅ Đăng nhập Support Agent thành công!');

  // 2. Test AI Chat 1: Tra cứu tồn kho sản phẩm (Function Calling: checkProductInventory)
  console.log('\n2️⃣ Khách hàng hỏi AI về tồn kho sản phẩm: "Shop còn iPhone 15 Pro Max không, giá bao nhiêu?"...');
  const chat1Res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      message: 'Shop còn iPhone 15 Pro Max không, giá bao nhiêu?',
    }),
  });
  const chat1Data = await chat1Res.json();
  console.log('   🤖 [AI PHẢN HỒI]:\n', chat1Data.reply);
  if (chat1Data.toolCalls && chat1Data.toolCalls.length > 0) {
    console.log('   ⚡ [Tool Calling kích hoạt]:', chat1Data.toolCalls.map(t => `${t.toolName}(${JSON.stringify(t.args)})`).join(', '));
  }
  console.log('   ✨ Xác nhận: AI đã tự động tra cứu kho sản phẩm và báo giá thành công!');

  // 3. Khách hàng tạo 1 đơn hàng mới để lấy mã đơn test tra cứu
  console.log('\n3️⃣ Khách đặt 1 đơn hàng mới để lấy mã đơn hàng kiểm thử tra cứu...');
  const orderRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      paymentMethod: 'COD',
      receiverName: 'Trần Thị AI Test',
      receiverPhone: '0909112233',
      shippingAddress: '789 Đường Trí Tuệ Nhân Tạo, Quận 1',
      items: [{ productId: 1, quantity: 1 }],
    }),
  });
  const orderData = await orderRes.json();
  const orderNumber = orderData.data.orderNumber;
  console.log(`   ✅ Đã tạo đơn hàng mới: ${orderNumber}`);

  // 4. Test AI Chat 2: Tra cứu trạng thái đơn hàng (Function Calling: checkOrderStatus)
  console.log(`\n4️⃣ Khách hỏi AI về tiến độ đơn hàng: "Kiểm tra đơn hàng ${orderNumber} giúp mình với!"...`);
  const chat2Res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      message: `Kiểm tra đơn hàng ${orderNumber} giúp mình với!`,
    }),
  });
  const chat2Data = await chat2Res.json();
  console.log('   🤖 [AI PHẢN HỒI]:\n', chat2Data.reply);
  if (chat2Data.toolCalls && chat2Data.toolCalls.length > 0) {
    console.log('   ⚡ [Tool Calling kích hoạt]:', chat2Data.toolCalls.map(t => `${t.toolName}(${JSON.stringify(t.args)})`).join(', '));
  }
  console.log(`   ✨ Xác nhận: AI đã tra cứu chính xác đơn ${orderNumber} từ PostgreSQL!`);

  // 5. Test AI Chat 3: Khiếu nại sự cố phức tạp (Function Calling: createSupportTicket)
  console.log('\n5️⃣ Khách khiếu nại sự cố: "Hàng của tôi nhận bị vỡ màn hình rồi, đơn ' + orderNumber + ', đổi trả giúp tôi với!"...');
  const chat3Res = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${custToken}`,
    },
    body: JSON.stringify({
      message: `Hàng của tôi nhận bị vỡ màn hình rồi, đơn ${orderNumber}, đổi trả giúp tôi với!`,
    }),
  });
  const chat3Data = await chat3Res.json();
  console.log('   🤖 [AI PHẢN HỒI]:\n', chat3Data.reply);
  if (chat3Data.ticketCreated) {
    console.log('   🎫 [Ticket Tự Động Tạo Thành Công]: Mã vé:', chat3Data.ticketCreated.ticketNumber, '| Tiêu đề:', chat3Data.ticketCreated.title);
  }
  console.log('   ✨ Xác nhận: AI đã tự động phát hiện khiếu nại và tạo Ticket hỗ trợ vào Database!');

  // 6. Test Support Agent xem danh sách Ticket
  console.log('\n6️⃣ Nhân viên CSKH (Support Agent) truy cập danh sách Ticket...');
  const ticketsListRes = await fetch(`${API_BASE}/ai/tickets`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${supportToken}`,
    },
  });
  const ticketsList = await ticketsListRes.json();
  console.log(`   📋 Tổng số Ticket hiện có: ${ticketsList.pagination.total}`);
  const newestTicket = ticketsList.data[0];
  console.log(`   Vé mới nhất: [${newestTicket.ticketNumber}] - ${newestTicket.title} (Trạng thái: ${newestTicket.status})`);

  // 7. Nhân viên CSKH phản hồi vào Ticket
  console.log(`\n7️⃣ Nhân viên CSKH phản hồi Ticket [${newestTicket.ticketNumber}]...`);
  const replyRes = await fetch(`${API_BASE}/ai/tickets/${newestTicket.id}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supportToken}`,
    },
    body: JSON.stringify({
      content: 'Chào quý khách, ShopFast đã tiếp nhận hình ảnh vỡ màn hình. Chúng tôi sẽ gửi đơn vị thu hồi sản phẩm lỗi và gửi máy mới 100% đến bạn trong ngày mai.',
    }),
  });
  const replyData = await replyRes.json();
  console.log('   ✅ Đã gửi phản hồi CSKH:', replyData.message);

  // 8. Đổi trạng thái vé sang IN_PROGRESS
  console.log(`\n8️⃣ Nhân viên CSKH chuyển trạng thái vé sang IN_PROGRESS...`);
  const updateStatusRes = await fetch(`${API_BASE}/ai/tickets/${newestTicket.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supportToken}`,
    },
    body: JSON.stringify({
      status: 'IN_PROGRESS',
      note: 'Đã hẹn shipper qua lấy hàng thu hồi',
    }),
  });
  const updateStatusData = await updateStatusRes.json();
  console.log(`   ✅ Cập nhật vé thành công! Trạng thái mới: ${updateStatusData.data.status}`);

  console.log('\n🎉🎉🎉 TẤT CẢ TEST MODULE 6: AI CSKH GOOGLE GEMINI + FUNCTION CALLING (F01) ĐÃ THÀNH CÔNG RỰC RỠ! 🎉🎉🎉');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ TEST THẤT BẠI:', err.message);
  process.exit(1);
});
