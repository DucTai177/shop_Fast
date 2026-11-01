import type { TicketCategory, TicketPriority } from '@prisma/client';

export interface ChatMessageItem {
  role: 'user' | 'model';
  content: string;
}

export interface ChatResponsePayload {
  reply: string;
  toolCalls?: {
    toolName: string;
    args: any;
    result: any;
  }[];
  ticketCreated?: {
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
  } | null;
}

export interface CheckOrderStatusArgs {
  orderNumber: string;
}

export interface CheckProductInventoryArgs {
  keyword: string;
}

export interface CreateSupportTicketArgs {
  title: string;
  category: TicketCategory;
  priority?: TicketPriority;
  description: string;
  orderNumber?: string;
}
