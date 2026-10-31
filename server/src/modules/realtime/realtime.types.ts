import type { OrderStatus, PaymentStatus } from '@prisma/client';

export interface OrderStatusUpdatedPayload {
  orderId: string;
  orderNumber: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note?: string;
  paymentStatus?: PaymentStatus;
  updatedAt: string;
  updatedBy?: {
    id?: string;
    fullName?: string;
    role?: string;
  } | null;
}

export interface OrderCreatedPayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  receiverName: string;
  totalAmount: number;
  paymentMethod: string;
  status: OrderStatus;
  createdAt: string;
  itemsCount: number;
}

