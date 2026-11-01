import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AI_SYSTEM_INSTRUCTION,
  AI_TOOLS_DECLARATIONS,
  GEMINI_MODEL,
} from './ai-agent.constants.js';
import { AiToolsService } from './tools/ai-tools.service.js';
import { ChatMessageDto } from './dto/chat-message.dto.js';
import type { ChatResponsePayload } from './ai-agent.types.js';

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private readonly apiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly toolsService: AiToolsService,
  ) {
    this.apiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      process.env.GEMINI_API_KEY ||
      '';

    if (this.apiKey && this.apiKey !== 'your_gemini_api_key_here') {
      try {
        this.genAI = new GoogleGenerativeAI(this.apiKey);
        this.logger.log('🤖 Google Gemini AI Service khởi tạo thành công (F01 AI CSKH)');
      } catch (err: any) {
        this.logger.warn(`Lỗi khởi tạo Gemini SDK: ${err.message}`);
      }
    } else {
      this.logger.warn('Chưa cấu hình GEMINI_API_KEY hợp lệ. Hệ thống sẽ chạy ở chế độ Fallback AI Agent.');
    }
  }

  /**
   * Xử lý tin nhắn hội thoại với Trợ lý AI CSKH kèm Function Calling (F01)
   */
  async processChatMessage(
    userId: string | null,
    dto: ChatMessageDto,
  ): Promise<ChatResponsePayload> {
    const userPrompt = dto.message.trim();
    this.logger.log(`[AI CSKH] Nhận tin nhắn từ khách (User: ${userId || 'Khách vãng lai'}): "${userPrompt}"`);

    // 1. Nếu có Gemini AI -> Sử dụng mô hình AI và Function Calling thực tế
    if (this.genAI) {
      try {
        return await this.callGeminiWithTools(userId, dto);
      } catch (err: any) {
        this.logger.warn(
          `[AI CSKH] Google Gemini API gặp lỗi hoặc quá tải: ${err.message}. Đang kích hoạt Fallback Agent thông minh...`,
        );
      }
    }

    // 2. Chế độ Fallback thông minh (Chống rớt mạng khi bảo vệ đồ án)
    return this.executeFallbackAgent(userId, userPrompt);
  }

  /**
   * Gọi mô hình Gemini kèm khai báo Functions (Tools)
   */
  private async callGeminiWithTools(
    userId: string | null,
    dto: ChatMessageDto,
  ): Promise<ChatResponsePayload> {
    if (!this.genAI) throw new Error('Gemini SDK chưa khởi tạo');

    const model = this.genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: AI_SYSTEM_INSTRUCTION,
      tools: [
        {
          functionDeclarations: AI_TOOLS_DECLARATIONS as any,
        },
      ],
    });

    // Chuẩn bị lịch sử trò chuyện
    const contents: any[] = [];
    if (dto.history && dto.history.length > 0) {
      for (const h of dto.history.slice(-6)) {
        contents.push({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.content }],
        });
      }
    }
    contents.push({
      role: 'user',
      parts: [{ text: dto.message }],
    });

    // Bước 1: Gửi tin nhắn đến Gemini để mô hình quyết định gọi Function nào
    const response = await model.generateContent({ contents });
    const functionCalls = response.response.functionCalls();

    const toolCallsExecuted: any[] = [];
    let ticketCreated: any = null;

    // Nếu Gemini KHÔNG yêu cầu gọi Tool nào -> Trả về câu trả lời tự nhiên
    if (!functionCalls || functionCalls.length === 0) {
      return {
        reply: response.response.text(),
        toolCalls: [],
      };
    }

    // Bước 2: Có yêu cầu Function Calling -> Thực thi các Tool tương ứng trong Database
    const toolResultsParts: any[] = [];

    for (const call of functionCalls) {
      this.logger.log(`⚡ [Function Calling] Gemini kích hoạt Tool "${call.name}" với tham số: ${JSON.stringify(call.args)}`);

      let toolOutput: any = null;

      if (call.name === 'checkOrderStatus') {
        toolOutput = await this.toolsService.checkOrderStatus(call.args as any);
      } else if (call.name === 'checkProductInventory') {
        toolOutput = await this.toolsService.checkProductInventory(call.args as any);
      } else if (call.name === 'createSupportTicket') {
        toolOutput = await this.toolsService.createSupportTicket(userId, call.args as any);
        if (toolOutput.success) {
          ticketCreated = {
            id: toolOutput.ticketId,
            ticketNumber: toolOutput.ticketNumber,
            title: toolOutput.title,
            status: toolOutput.status,
          };
        }
      }

      toolCallsExecuted.push({
        toolName: call.name,
        args: call.args,
        result: toolOutput,
      });

      toolResultsParts.push({
        functionResponse: {
          name: call.name,
          response: toolOutput,
        },
      });
    }

    // Bước 3: Gửi kết quả Tool về lại cho Gemini để sinh ra câu trả lời cuối cùng tự nhiên cho khách
    const followUpContents = [
      ...contents,
      {
        role: 'model',
        parts: functionCalls.map((fc) => ({ functionCall: fc })),
      },
      {
        role: 'user',
        parts: toolResultsParts,
      },
    ];

    const finalResponse = await model.generateContent({
      contents: followUpContents,
    });

    return {
      reply: finalResponse.response.text(),
      toolCalls: toolCallsExecuted,
      ticketCreated,
    };
  }

  /**
   * Fallback Agent thông minh: Sử dụng Regex & Quy tắc nghiệp vụ khi Google API nghẽn mạng
   */
  private async executeFallbackAgent(
    userId: string | null,
    userPrompt: string,
  ): Promise<ChatResponsePayload> {
    const lower = userPrompt.toLowerCase();
    const toolCallsExecuted: any[] = [];
    let ticketCreated: any = null;

    // 1. Kiểm tra khiếu nại, sự cố, đổi trả hàng -> Ưu tiên gọi createSupportTicket
    if (
      lower.includes('khiếu nại') ||
      lower.includes('đổi trả') ||
      lower.includes('hỏng') ||
      lower.includes('vỡ') ||
      lower.includes('sai hàng') ||
      lower.includes('hoàn tiền') ||
      lower.includes('bảo hành')
    ) {
      const orderMatch = userPrompt.match(/SF\d{8,14}/i);
      const ticketResult = await this.toolsService.createSupportTicket(userId, {
        title: 'Khiếu nại / Yêu cầu đổi trả từ khách hàng',
        category: 'RETURN_REFUND' as any,
        priority: 'HIGH' as any,
        description: userPrompt,
        orderNumber: orderMatch ? orderMatch[0].toUpperCase() : undefined,
      });

      ticketCreated = {
        id: ticketResult.ticketId,
        ticketNumber: ticketResult.ticketNumber,
        title: ticketResult.title,
        status: ticketResult.status,
      };

      toolCallsExecuted.push({
        toolName: 'createSupportTicket',
        args: { title: ticketResult.title, description: userPrompt },
        result: ticketResult,
      });

      return {
        reply: `Dạ ShopFast rất xin lỗi vì sự bất tiện mà bạn gặp phải! Em đã lập tức tạo một Phiếu yêu cầu đổi trả/hỗ trợ khẩn cấp mã **${ticketResult.ticketNumber}** gửi tới bộ phận Chăm sóc khách hàng. Nhân viên phụ trách sẽ kiểm tra và liên hệ trực tiếp với bạn sớm nhất có thể ạ!`,
        toolCalls: toolCallsExecuted,
        ticketCreated,
      };
    }

    // 2. Kiểm tra xem có mã đơn hàng dạng SF... không -> Gọi checkOrderStatus
    const orderMatch = userPrompt.match(/SF\d{8,14}/i);
    if (orderMatch || lower.includes('đơn hàng') || lower.includes('tra cứu đơn')) {
      const orderNumber = orderMatch ? orderMatch[0].toUpperCase() : 'SF202610319239';
      const orderData = await this.toolsService.checkOrderStatus({ orderNumber });

      toolCallsExecuted.push({
        toolName: 'checkOrderStatus',
        args: { orderNumber },
        result: orderData,
      });

      if (orderData.found && orderData.items) {
        const itemsStr = orderData.items.map((i: any) => `${i.productName} (x${i.quantity})`).join(', ');
        return {
          reply: `Dạ ShopFast đã kiểm tra đơn hàng **${orderData.orderNumber}** của bạn:\n- **Trạng thái:** ${orderData.status}\n- **Người nhận:** ${orderData.receiverName} (${orderData.shippingAddress})\n- **Tổng thanh toán:** ${orderData.totalAmount?.toLocaleString('vi-VN')} đ (${orderData.paymentMethod})\n- **Sản phẩm:** ${itemsStr}\n\nShopFast sẽ tiếp tục cập nhật tiến độ vận chuyển cho bạn qua hệ thống nhé!`,
          toolCalls: toolCallsExecuted,
        };
      } else {
        return {
          reply: `Dạ ${orderData.message}`,
          toolCalls: toolCallsExecuted,
        };
      }
    }

    // 3. Kiểm tra xem có hỏi mua sắm / tồn kho sản phẩm không -> Gọi checkProductInventory
    if (
      lower.includes('còn hàng') ||
      lower.includes('giá') ||
      lower.includes('iphone') ||
      lower.includes('samsung') ||
      lower.includes('macbook') ||
      lower.includes('sản phẩm')
    ) {
      let keyword = 'iPhone';
      if (lower.includes('samsung')) keyword = 'Samsung';
      if (lower.includes('macbook')) keyword = 'MacBook';
      if (lower.includes('tai nghe') || lower.includes('airpods')) keyword = 'Tai nghe';

      const invData = await this.toolsService.checkProductInventory({ keyword });
      toolCallsExecuted.push({
        toolName: 'checkProductInventory',
        args: { keyword },
        result: invData,
      });

      if (invData.found && invData.products) {
        const productListStr = invData.products
          .map(
            (p: any) =>
              `- **${p.name}**: ${p.price?.toLocaleString('vi-VN')} đ | *${p.statusText}*`,
          )
          .join('\n');
        return {
          reply: `Dạ ShopFast xin gửi bạn thông tin sản phẩm khớp với từ khóa "${keyword}":\n\n${productListStr}\n\nBạn có muốn đặt hàng ngay hay cần tư vấn thêm chi tiết nào không ạ?`,
          toolCalls: toolCallsExecuted,
        };
      } else {
        return {
          reply: `Dạ ${invData.message}`,
          toolCalls: toolCallsExecuted,
        };
      }
    }

    // 4. Lời chào mặc định
    return {
      reply:
        'Xin chào quý khách! Mình là ShopFast AI — Trợ lý ảo CSKH 24/7. Mình có thể giúp bạn:\n1. 📦 **Tra cứu đơn hàng:** Hãy gửi mã đơn dạng `SF2026...`\n2. 🔍 **Kiểm tra tồn kho & báo giá:** Hỏi về iPhone, MacBook, Samsung...\n3. 🛠️ **Hỗ trợ khiếu nại & Đổi trả hàng:** Tạo phiếu hỗ trợ chuyển tới nhân viên.\n\nBạn cần hỗ trợ điều gì hôm nay ạ?',
      toolCalls: [],
    };
  }
}
