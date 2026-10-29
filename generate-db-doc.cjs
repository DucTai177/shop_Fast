const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} = require('docx');

// Helper to create table cell
function createCell(text, options = {}) {
  const isHeader = options.isHeader || false;
  const widthPercent = options.width || 25;
  const bold = options.bold || isHeader;
  const color = isHeader ? 'FFFFFF' : options.color || '1E293B';
  const bgColor = isHeader ? '1E40AF' : options.bgColor || (options.isEven ? 'F8FAFC' : 'FFFFFF');

  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: bgColor },
    margins: { top: 120, bottom: 120, left: 150, right: 150 },
    children: [
      new Paragraph({
        alignment: options.align || AlignmentType.LEFT,
        children: [
          new TextRun({
            text: text,
            bold: bold,
            color: color,
            size: isHeader ? 21 : 19, // half-points (10.5pt and 9.5pt)
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

// Helper to create a complete database table specification
function createDbTable(title, description, columns) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createCell('Tên Cột (Column)', { isHeader: true, width: 22 }),
      createCell('Kiểu Dữ Liệu', { isHeader: true, width: 20 }),
      createCell('Ràng Buộc (Constraints)', { isHeader: true, width: 22 }),
      createCell('Mô Tả & Ý Nghĩa Nghiệp Vụ', { isHeader: true, width: 36 }),
    ],
  });

  const dataRows = columns.map((col, index) => {
    const isEven = index % 2 === 1;
    return new TableRow({
      children: [
        createCell(col.name, { bold: true, width: 22, isEven }),
        createCell(col.type, { color: '4338CA', width: 20, isEven }),
        createCell(col.constraints, { color: 'B91C1C', width: 22, isEven }),
        createCell(col.description, { width: 36, isEven }),
      ],
    });
  });

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          color: '1E3A8A',
          size: 26,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 150 },
      children: [
        new TextRun({
          text: description,
          italics: true,
          color: '475569',
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows],
    }),
    new Paragraph({ spacing: { after: 200 } }),
  ];
}

async function generateDocx() {
  const tables = [
    {
      title: '1. Bảng users (Quản lý Người Dùng & Phân Quyền - F06, F03)',
      description: 'Lưu trữ tài khoản, mật khẩu băm, phân quyền 4 vai trò và hỗ trợ chặn dò mật khẩu Brute-Force.',
      columns: [
        { name: 'id', type: 'UUID (String)', constraints: 'PK, Default UUID', description: 'Mã định danh duy nhất của người dùng' },
        { name: 'email', type: 'VARCHAR(255)', constraints: 'UNIQUE, NOT NULL', description: 'Địa chỉ email dùng để đăng nhập' },
        { name: 'passwordHash', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Mật khẩu đã băm bằng thuật toán bcrypt (10 vòng)' },
        { name: 'fullName', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Họ và tên đầy đủ của người dùng' },
        { name: 'phone', type: 'VARCHAR(20)', constraints: 'NULLABLE', description: 'Số điện thoại liên hệ' },
        { name: 'role', type: 'ENUM (UserRole)', constraints: 'NOT NULL, Default CUSTOMER', description: '4 vai trò: CUSTOMER, SUPPORT_AGENT, WAREHOUSE_STAFF, ADMIN' },
        { name: 'isActive', type: 'BOOLEAN', constraints: 'NOT NULL, Default TRUE', description: 'Trạng thái hoạt động của tài khoản' },
        { name: 'failedLoginCount', type: 'INTEGER', constraints: 'NOT NULL, Default 0', description: 'Đếm số lần đăng nhập sai liên tiếp (Chống Brute-force F03)' },
        { name: 'lockedUntil', type: 'TIMESTAMP', constraints: 'NULLABLE', description: 'Mốc thời gian hết hạn khóa tài khoản (khóa 15 phút nếu sai 5 lần)' },
        { name: 'createdAt', type: 'TIMESTAMP', constraints: 'NOT NULL, Default NOW()', description: 'Thời điểm tạo tài khoản' },
        { name: 'updatedAt', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Thời điểm cập nhật tài khoản gần nhất' },
      ],
    },
    {
      title: '2. Bảng categories (Danh Mục Sản Phẩm - F06)',
      description: 'Phân loại các nhóm sản phẩm trong sàn thương mại điện tử, hỗ trợ phân cấp cây cha - con.',
      columns: [
        { name: 'id', type: 'UUID (String)', constraints: 'PK, Default UUID', description: 'Mã định danh duy nhất của danh mục' },
        { name: 'name', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Tên danh mục (ví dụ: Điện Thoại & Tablet)' },
        { name: 'slug', type: 'VARCHAR(120)', constraints: 'UNIQUE, NOT NULL', description: 'Đường dẫn URL thân thiện chuẩn SEO (dien-thoai-tablet)' },
        { name: 'description', type: 'TEXT', constraints: 'NULLABLE', description: 'Mô tả chi tiết danh mục' },
        { name: 'parentId', type: 'UUID', constraints: 'FK -> categories(id), NULLABLE', description: 'ID danh mục cha (nếu là danh mục con)' },
        { name: 'createdAt', type: 'TIMESTAMP', constraints: 'NOT NULL, Default NOW()', description: 'Thời điểm tạo danh mục' },
        { name: 'updatedAt', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Thời điểm cập nhật gần nhất' },
      ],
    },
    {
      title: '3. Bảng products (Sản Phẩm & Kho - F06, F04 Caching, F01 AI Check Stock)',
      description: 'Lưu trữ thông tin chi tiết từng sản phẩm, giá bán, số lượng tồn kho và mã SKU để AI tra cứu.',
      columns: [
        { name: 'id', type: 'UUID (String)', constraints: 'PK, Default UUID', description: 'Mã định danh duy nhất của sản phẩm' },
        { name: 'sku', type: 'VARCHAR(50)', constraints: 'UNIQUE, NOT NULL, INDEX', description: 'Mã kho (Stock Keeping Unit), dùng cho AI Agent tra tồn kho (F01)' },
        { name: 'name', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Tên sản phẩm hiển thị trên sàn' },
        { name: 'slug', type: 'VARCHAR(280)', constraints: 'UNIQUE, NOT NULL, INDEX', description: 'Đường dẫn URL chi tiết sản phẩm chuẩn SEO' },
        { name: 'description', type: 'TEXT', constraints: 'NULLABLE', description: 'Mô tả chi tiết tính năng sản phẩm' },
        { name: 'price', type: 'DECIMAL(12,2)', constraints: 'NOT NULL, INDEX', description: 'Giá bán hiện tại' },
        { name: 'originalPrice', type: 'DECIMAL(12,2)', constraints: 'NULLABLE', description: 'Giá niêm yết ban đầu (dùng tính % giảm giá)' },
        { name: 'stock', type: 'INTEGER', constraints: 'NOT NULL, Default 0, INDEX', description: 'Số lượng tồn kho thực tế (Kiểm tra chống oversell F06)' },
        { name: 'brand', type: 'VARCHAR(100)', constraints: 'NULLABLE, INDEX', description: 'Thương hiệu sản xuất (Apple, Samsung, Sony...)' },
        { name: 'images', type: 'TEXT[]', constraints: 'Default {}', description: 'Mảng danh sách các đường dẫn link ảnh sản phẩm' },
        { name: 'categoryId', type: 'UUID', constraints: 'FK -> categories(id), NOT NULL', description: 'Thuộc về danh mục nào' },
        { name: 'isActive', type: 'BOOLEAN', constraints: 'NOT NULL, Default TRUE, INDEX', description: 'Trạng thái đang mở bán (true) hoặc ẩn (false)' },
        { name: 'createdAt', type: 'TIMESTAMP', constraints: 'NOT NULL, Default NOW()', description: 'Thời điểm tạo sản phẩm' },
        { name: 'updatedAt', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Thời điểm cập nhật giá/kho gần nhất (kích hoạt xóa Cache F04)' },
      ],
    },
    {
      title: '4. Bảng carts & cart_items (Giỏ Hàng Người Dùng - F06)',
      description: 'Lưu trữ giỏ hàng và danh sách sản phẩm khách hàng đang chuẩn bị mua sắm.',
      columns: [
        { name: 'carts.id', type: 'UUID', constraints: 'PK', description: 'Mã định danh giỏ hàng' },
        { name: 'carts.userId', type: 'UUID', constraints: 'FK -> users(id), UNIQUE', description: 'Mỗi người dùng sở hữu duy nhất 1 giỏ hàng' },
        { name: 'cart_items.id', type: 'UUID', constraints: 'PK', description: 'Mã chi tiết từng mục trong giỏ' },
        { name: 'cart_items.cartId', type: 'UUID', constraints: 'FK -> carts(id)', description: 'Thuộc về giỏ hàng nào' },
        { name: 'cart_items.productId', type: 'UUID', constraints: 'FK -> products(id)', description: 'Sản phẩm được chọn mua' },
        { name: 'cart_items.quantity', type: 'INTEGER', constraints: 'NOT NULL, Default 1', description: 'Số lượng chọn mua' },
      ],
    },
    {
      title: '5. Bảng orders (Đơn Hàng Tổng - F06, F02 Realtime, F05 Background Job)',
      description: 'Bảng trung tâm lưu trữ thông tin đơn hàng, trạng thái thanh toán, địa chỉ nhận và tổng tiền.',
      columns: [
        { name: 'id', type: 'UUID (String)', constraints: 'PK, Default UUID', description: 'Mã định danh đơn hàng' },
        { name: 'orderNumber', type: 'VARCHAR(30)', constraints: 'UNIQUE, NOT NULL, INDEX', description: 'Mã đơn thân thiện (SF20261028001) để khách & AI tra cứu (F01)' },
        { name: 'userId', type: 'UUID', constraints: 'FK -> users(id), NOT NULL, INDEX', description: 'Khách hàng đặt đơn hàng này' },
        { name: 'status', type: 'ENUM (OrderStatus)', constraints: 'NOT NULL, Default PENDING, INDEX', description: 'PENDING, CONFIRMED, PACKING, SHIPPING, DELIVERED, CANCELLED' },
        { name: 'paymentStatus', type: 'ENUM (PaymentStatus)', constraints: 'NOT NULL, Default UNPAID', description: 'UNPAID, PAID, REFUNDED' },
        { name: 'paymentMethod', type: 'VARCHAR(30)', constraints: 'NOT NULL, Default COD', description: 'Phương thức thanh toán: COD, BANK_TRANSFER...' },
        { name: 'subtotal', type: 'DECIMAL(12,2)', constraints: 'NOT NULL', description: 'Tổng tiền hàng trước phí vận chuyển' },
        { name: 'shippingFee', type: 'DECIMAL(12,2)', constraints: 'NOT NULL, Default 0', description: 'Phí vận chuyển' },
        { name: 'totalAmount', type: 'DECIMAL(12,2)', constraints: 'NOT NULL', description: 'Tổng số tiền khách phải thanh toán' },
        { name: 'receiverName', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Họ tên người nhận hàng' },
        { name: 'receiverPhone', type: 'VARCHAR(20)', constraints: 'NOT NULL', description: 'Số điện thoại nhận hàng' },
        { name: 'shippingAddress', type: 'TEXT', constraints: 'NOT NULL', description: 'Địa chỉ giao hàng chi tiết' },
        { name: 'notes', type: 'TEXT', constraints: 'NULLABLE', description: 'Ghi chú đơn hàng của khách' },
        { name: 'createdAt', type: 'TIMESTAMP', constraints: 'NOT NULL, Default NOW(), INDEX', description: 'Thời điểm tạo đơn' },
        { name: 'updatedAt', type: 'TIMESTAMP', constraints: 'NOT NULL', description: 'Thời điểm cập nhật đơn' },
      ],
    },
    {
      title: '6. Bảng order_items (Chi Tiết Sản Phẩm Trong Đơn - F06)',
      description: 'Lưu trữ snapshot giá và thông tin sản phẩm tại thời điểm mua (không bị đổi khi sản phẩm đổi giá).',
      columns: [
        { name: 'id', type: 'UUID', constraints: 'PK, Default UUID', description: 'Mã dòng chi tiết đơn hàng' },
        { name: 'orderId', type: 'UUID', constraints: 'FK -> orders(id), NOT NULL, INDEX', description: 'Thuộc về đơn hàng nào' },
        { name: 'productId', type: 'UUID', constraints: 'FK -> products(id), NOT NULL', description: 'Mã sản phẩm tương ứng' },
        { name: 'productName', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Snapshot tên sản phẩm tại lúc đặt hàng' },
        { name: 'sku', type: 'VARCHAR(50)', constraints: 'NOT NULL', description: 'Snapshot mã SKU lúc đặt hàng' },
        { name: 'price', type: 'DECIMAL(12,2)', constraints: 'NOT NULL', description: 'Giá bán tại thời điểm đặt hàng' },
        { name: 'quantity', type: 'INTEGER', constraints: 'NOT NULL', description: 'Số lượng mua' },
        { name: 'totalPrice', type: 'DECIMAL(12,2)', constraints: 'NOT NULL', description: 'Thành tiền = price * quantity' },
      ],
    },
    {
      title: '7. Bảng order_status_histories (Lịch Sử Trạng Thái Đơn - F02 Realtime Tracking)',
      description: 'Lưu từng sự kiện thay đổi trạng thái đơn để hiển thị dòng thời gian Realtime và kiểm toán.',
      columns: [
        { name: 'id', type: 'UUID', constraints: 'PK, Default UUID', description: 'Mã sự kiện' },
        { name: 'orderId', type: 'UUID', constraints: 'FK -> orders(id), NOT NULL, INDEX', description: 'Đơn hàng xảy ra sự kiện' },
        { name: 'fromStatus', type: 'ENUM (OrderStatus)', constraints: 'NULLABLE', description: 'Trạng thái trước khi đổi' },
        { name: 'toStatus', type: 'ENUM (OrderStatus)', constraints: 'NOT NULL', description: 'Trạng thái mới chuyển sang' },
        { name: 'note', type: 'TEXT', constraints: 'NULLABLE', description: 'Ghi chú (ví dụ: "Giao bưu tá Viettel Post")' },
        { name: 'updatedById', type: 'UUID', constraints: 'FK -> users(id), NULLABLE', description: 'Nhân viên kho hoặc hệ thống thực hiện đổi' },
        { name: 'createdAt', type: 'TIMESTAMP', constraints: 'NOT NULL, Default NOW()', description: 'Thời gian chính xác sự kiện diễn ra' },
      ],
    },
    {
      title: '8. Bảng tickets & ticket_messages (Ticket Hỗ Trợ & Trợ Lý AI - F01)',
      description: 'Quản lý khiếu nại, phân loại tự động bởi AI và lưu vết lịch sử gọi Tool tra cứu của AI Agent.',
      columns: [
        { name: 'tickets.id', type: 'UUID', constraints: 'PK', description: 'Mã định danh ticket' },
        { name: 'tickets.ticketNumber', type: 'VARCHAR(30)', constraints: 'UNIQUE, INDEX', description: 'Mã ticket thân thiện (TK-20261028-01)' },
        { name: 'tickets.userId', type: 'UUID', constraints: 'FK -> users(id)', description: 'Khách hàng mở ticket yêu cầu hỗ trợ' },
        { name: 'tickets.title', type: 'VARCHAR(255)', constraints: 'NOT NULL', description: 'Tiêu đề vấn đề cần giải quyết' },
        { name: 'tickets.category', type: 'ENUM (TicketCategory)', constraints: 'NOT NULL, Default OTHER', description: 'AI tự động phân loại: ORDER_INQUIRY, INVENTORY_CHECK, COMPLAINT...' },
        { name: 'tickets.status', type: 'ENUM (TicketStatus)', constraints: 'Default OPEN', description: 'Trạng thái: OPEN, IN_PROGRESS, RESOLVED, CLOSED' },
        { name: 'tickets.priority', type: 'ENUM (TicketPriority)', constraints: 'Default MEDIUM', description: 'Mức độ ưu tiên: LOW, MEDIUM, HIGH, URGENT' },
        { name: 'tickets.assignedToId', type: 'UUID', constraints: 'FK -> users(id), NULLABLE', description: 'Nhân viên CSKH tiếp nhận (nếu chuyển từ AI sang người)' },
        { name: 'ticket_messages.id', type: 'UUID', constraints: 'PK', description: 'Mã tin nhắn chat' },
        { name: 'ticket_messages.senderType', type: 'ENUM (SenderType)', constraints: 'NOT NULL', description: 'Người gửi: CUSTOMER, AI_AGENT, SUPPORT_AGENT' },
        { name: 'ticket_messages.content', type: 'TEXT', constraints: 'NOT NULL', description: 'Nội dung tin nhắn trao đổi' },
        { name: 'ticket_messages.toolCalls', type: 'JSONB', constraints: 'NULLABLE', description: 'Lưu tham số và kết quả AI gọi Tool thật (F01 Tool Use)' },
        { name: 'ticket_messages.requiresHumanConfirm', type: 'BOOLEAN', constraints: 'Default FALSE', description: 'Cờ đánh dấu thao tác ghi cần xác nhận bởi con người (F01)' },
      ],
    },
    {
      title: '9. Bảng idempotency_keys (Bảo Vệ Tính Bất Biến Hàng Đợi - F05 Queue)',
      description: 'Ngăn chặn gửi trùng email hoặc nhân đôi tác vụ ngầm khi worker hàng đợi BullMQ retry nhiều lần.',
      columns: [
        { name: 'id', type: 'UUID', constraints: 'PK, Default UUID', description: 'Mã khóa định danh' },
        { name: 'key', type: 'VARCHAR(150)', constraints: 'UNIQUE, NOT NULL, INDEX', description: 'Chuỗi khóa duy nhất (ví dụ: email_order_SF20261028001)' },
        { name: 'jobType', type: 'VARCHAR(50)', constraints: 'NOT NULL', description: 'Loại tác vụ: SEND_EMAIL_CONFIRMATION, GENERATE_INVOICE...' },
        { name: 'status', type: 'VARCHAR(30)', constraints: 'NOT NULL', description: 'Trạng thái: PROCESSING, COMPLETED, FAILED' },
        { name: 'response', type: 'JSONB', constraints: 'NULLABLE', description: 'Kết quả xử lý thành công trả về của tác vụ' },
        { name: 'createdAt', type: 'TIMESTAMP', constraints: 'NOT NULL, Default NOW()', description: 'Thời điểm ghi nhận' },
      ],
    },
  ];

  const docSections = [];

  // Title section
  docSections.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: 'SHOPFAST E-COMMERCE PLATFORM',
          bold: true,
          size: 36,
          color: '1E3A8A',
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: 'TÀI LIỆU ĐẶC TẢ CƠ SỞ DỮ LIỆU CHI TIẾT (DATABASE SCHEMA SPECIFICATION)',
          bold: true,
          size: 24,
          color: '2563EB',
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: '• Dự án: ',
          bold: true,
          font: 'Arial',
        }),
        new TextRun({
          text: 'ShopFast - Sàn thương mại điện tử hiệu năng cao (Module 6 Defense Case Study)\n',
          font: 'Arial',
        }),
        new TextRun({
          text: '• Hệ quản trị CSDL: ',
          bold: true,
          font: 'Arial',
        }),
        new TextRun({
          text: 'PostgreSQL 16/17 (Chạy cục bộ qua Laragon / Docker)\n',
          font: 'Arial',
        }),
        new TextRun({
          text: '• Công nghệ ORM: ',
          bold: true,
          font: 'Arial',
        }),
        new TextRun({
          text: 'Prisma ORM 6.4 (Type-Safe, Tối ưu Index cho Caching & AI Tool Use)\n',
          font: 'Arial',
        }),
        new TextRun({
          text: '• Tổng số bảng: ',
          bold: true,
          font: 'Arial',
        }),
        new TextRun({
          text: '11 Bảng dữ liệu chuẩn hóa quan hệ thực thể (ERD)\n',
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      text: '_________________________________________________________________________________',
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  );

  // Add each table
  for (const t of tables) {
    const tableNodes = createDbTable(t.title, t.description, t.columns);
    docSections.push(...tableNodes);
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docSections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = path.join(__dirname, 'Tai_Lieu_Database_ShopFast.docx');
  fs.writeFileSync(outputPath, buffer);
  console.log(`✅ Xuất file Word thành công tại: ${outputPath}`);
}

generateDocx().catch(console.error);
