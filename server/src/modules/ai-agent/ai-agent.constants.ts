export const GEMINI_MODEL = 'gemini-flash-lite-latest';

export const AI_SYSTEM_INSTRUCTION = `
Bạn là ShopFast AI — Trợ lý ảo chăm sóc khách hàng (CSKH) thông minh và tận tâm của sàn thương mại điện tử ShopFast (Hệ thống Defense Case Study 6).
Nhiệm vụ của bạn:
1. Hỗ trợ khách hàng tra cứu trạng thái đơn hàng và lịch sử vận chuyển.
2. Kiểm tra tồn kho, giá bán và thông tin sản phẩm theo thời gian thực.
3. Khi khách hàng gặp sự cố phức tạp (hàng lỗi, vỡ, đổi trả, khiếu nại gay gắt), hãy chủ động dùng công cụ createSupportTicket để tạo phiếu hỗ trợ vào hệ thống cho nhân viên người thật tiếp quản.

Quy tắc ứng xử:
- Xưng hô lịch sự: xưng là "ShopFast" hoặc "mình", gọi khách hàng là "bạn" hoặc "quý khách".
- Giọng văn thân thiện, hỗ trợ tận tình, rõ ràng, định dạng câu trả lời đẹp mắt bằng Markdown (dùng danh sách, in đậm trạng thái).
- Luôn sử dụng đúng các công cụ (Tools/Function Calling) được cung cấp khi khách hỏi thông tin cụ thể, không tự bịa đặt mã đơn hay số lượng tồn kho.
`.trim();

export const AI_TOOLS_DECLARATIONS = [
  {
    name: 'checkOrderStatus',
    description:
      'Tra cứu thông tin chi tiết và tiến độ vận chuyển của đơn hàng theo mã đơn (ví dụ: SF202610311234).',
    parameters: {
      type: 'OBJECT',
      properties: {
        orderNumber: {
          type: 'STRING',
          description: 'Mã đơn hàng cần tra cứu (bắt đầu bằng SF, ví dụ: SF202610319239).',
        },
      },
      required: ['orderNumber'],
    },
  },
  {
    name: 'checkProductInventory',
    description:
      'Kiểm tra tình trạng còn hàng trong kho, số lượng tồn và giá bán của sản phẩm theo từ khóa tên hoặc SKU (ví dụ: "iPhone 15", "MacBook", "Tai nghe").',
    parameters: {
      type: 'OBJECT',
      properties: {
        keyword: {
          type: 'STRING',
          description: 'Tên hoặc từ khóa sản phẩm muốn tìm kiếm.',
        },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'createSupportTicket',
    description:
      'Tự động tạo phiếu yêu cầu hỗ trợ (Support Ticket) khi khách hàng khiếu nại, yêu cầu đổi trả, giao sai hàng, hoặc muốn nhân viên CSKH hỗ trợ trực tiếp.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Tiêu đề ngắn gọn tóm tắt vấn đề của khách hàng (ví dụ: "Yêu cầu đổi hàng do vỡ kính").',
        },
        category: {
          type: 'STRING',
          enum: ['ORDER_INQUIRY', 'INVENTORY_CHECK', 'RETURN_REFUND', 'COMPLAINT', 'OTHER'],
          description: 'Phân loại vấn đề: ORDER_INQUIRY, INVENTORY_CHECK, RETURN_REFUND, COMPLAINT, OTHER.',
        },
        priority: {
          type: 'STRING',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          description: 'Mức độ ưu tiên của yêu cầu: LOW, MEDIUM, HIGH, URGENT.',
        },
        description: {
          type: 'STRING',
          description: 'Nội dung chi tiết khiếu nại hoặc yêu cầu hỗ trợ của khách.',
        },
        orderNumber: {
          type: 'STRING',
          description: 'Mã đơn hàng liên quan nếu khách có cung cấp (tùy chọn).',
        },
      },
      required: ['title', 'category', 'description'],
    },
  },
];

