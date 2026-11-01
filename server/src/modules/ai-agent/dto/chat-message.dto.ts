import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({
    example: 'Đơn hàng SF202610319239 của tôi tới đâu rồi?',
    description: 'Tin nhắn gửi tới Trợ lý ảo CSKH ShopFast',
  })
  @IsString({ message: 'Tin nhắn phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tin nhắn không được để trống' })
  message: string;

  @ApiPropertyOptional({
    description: 'Lịch sử hội thoại trước đó để AI hiểu ngữ cảnh liên tục',
    example: [
      { role: 'user', content: 'Xin chào ShopFast' },
      { role: 'model', content: 'Dạ ShopFast xin chào bạn! Mình có thể hỗ trợ gì cho bạn hôm nay ạ?' },
    ],
  })
  @IsArray()
  @IsOptional()
  history?: { role: 'user' | 'model'; content: string }[];
}

export class ReplyTicketDto {
  @ApiProperty({
    example: 'Nhân viên CSKH đã tiếp nhận đơn và sẽ gửi sản phẩm mới thay thế trong chiều nay.',
    description: 'Nội dung phản hồi phiếu hỗ trợ',
  })
  @IsString({ message: 'Nội dung phản hồi không hợp lệ' })
  @IsNotEmpty({ message: 'Nội dung không được để trống' })
  content: string;
}
