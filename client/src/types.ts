export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number | string;
  stock: number;
  brand: string;
  sku: string;
  imageUrl?: string;
  isActive: boolean;
}

export interface OrderItem {
  id: string;
  productId: number;
  productName: string;
  sku: string;
  price: number | string;
  quantity: number;
  totalPrice: number | string;
}

export interface StatusHistory {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note?: string;
  createdAt: string;
  updatedBy?: {
    fullName: string;
    role: string;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: 'PENDING' | 'CONFIRMED' | 'PACKING' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  paymentMethod: 'COD' | 'BANK_TRANSFER';
  subtotal: number | string;
  shippingFee: number | string;
  totalAmount: number | string;
  receiverName: string;
  receiverPhone: string;
  shippingAddress: string;
  notes?: string;
  createdAt: string;
  items: OrderItem[];
  statusHistories?: StatusHistory[];
}

export interface TicketMessage {
  id: string;
  senderType: 'CUSTOMER' | 'AI_AGENT' | 'SUPPORT_AGENT';
  content: string;
  createdAt: string;
  sender?: {
    fullName: string;
    role: string;
  };
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  category: 'ORDER_INQUIRY' | 'INVENTORY_CHECK' | 'RETURN_REFUND' | 'COMPLAINT' | 'OTHER';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  user?: {
    fullName: string;
    email: string;
  };
  messages?: TicketMessage[];
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'WAREHOUSE_STAFF' | 'SUPPORT_AGENT' | 'CUSTOMER';
  token: string;
}

