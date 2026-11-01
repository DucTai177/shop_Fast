import { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Activity,
  MessageSquare,
  Clock,
  CheckCircle2,
  Truck,
  Package,
  XCircle,
  Send,
  AlertTriangle,
  RefreshCw,
  Zap,
  CreditCard,
  Building,
  Headphones,
  Sliders,
  LogIn,
  LogOut,
  User as UserIcon,
  Lock,
  Mail,
  Phone,
  ShieldAlert,
} from 'lucide-react';
import { apiClient, getSocket, setAuthToken } from './api';
import type { Order, Product, Ticket } from './types';

export default function App() {
  // Navigation & Role State
  const [activeTab, setActiveTab] = useState<'shop' | 'tracking' | 'chat' | 'admin'>('shop');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState<string>('customer@shopfast.vn');
  const [authPassword, setAuthPassword] = useState<string>('Customer@123456');
  const [authFullName, setAuthFullName] = useState<string>('Nguyễn Văn An');
  const [authPhone, setAuthPhone] = useState<string>('0988112233');
  const [authError, setAuthError] = useState<string>('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState<boolean>(false);

  // Shop state
  const [products, setProducts] = useState<Product[]>([]);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState<boolean>(false);
  const [checkoutQuantity, setCheckoutQuantity] = useState<number>(1);
  const [receiverName, setReceiverName] = useState<string>('Nguyễn Văn An');
  const [receiverPhone, setReceiverPhone] = useState<string>('0988112233');
  const [shippingAddress, setShippingAddress] = useState<string>('123 Đường Nguyễn Trãi, Quận 1, TP.HCM');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BANK_TRANSFER'>('COD');
  const [orderNotes, setOrderNotes] = useState<string>('Giao hàng giờ hành chính');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);

  // Tracking state
  const [trackingOrderNumber, setTrackingOrderNumber] = useState<string>('');
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<boolean>(false);
  const [trackingAlert, setTrackingAlert] = useState<string>('');

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'model'; content: string; toolCalls?: any[]; ticketCreated?: any }[]
  >([
    {
      role: 'model',
      content:
        'Xin chào quý khách! Mình là **ShopFast AI** — Trợ lý ảo CSKH 24/7. Mình có thể giúp bạn tra cứu đơn hàng, kiểm tra kho sản phẩm hoặc tiếp nhận yêu cầu đổi trả bảo hành. Bạn cần hỗ trợ điều gì hôm nay ạ?',
    },
  ]);
  const [inputChat, setInputChat] = useState<string>('');
  const [isAiTyping, setIsAiTyping] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Admin state
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminTickets, setAdminTickets] = useState<Ticket[]>([]);
  const [loadingAdminData, setLoadingAdminData] = useState<boolean>(false);
  const [adminActiveSubTab, setAdminActiveSubTab] = useState<'orders' | 'tickets'>('orders');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState<string>('');

  // 1. Kiểm tra tài khoản đã đăng nhập từ localStorage khi load trang
  useEffect(() => {
    fetchProducts();
    checkCurrentUser();

    // Kết nối Socket.io
    const socket = getSocket();
    socket.on('connect', () => {
      setSocketConnected(true);
      console.log('🟢 Socket.io connected:', socket.id);
    });
    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    // Lắng nghe sự kiện Realtime cập nhật đơn hàng
    socket.on('order:statusUpdated', (payload: any) => {
      console.log('📢 Realtime order:statusUpdated received:', payload);
      setCurrentOrder((prev) => {
        if (prev && prev.orderNumber === payload.orderNumber) {
          return {
            ...prev,
            status: payload.toStatus,
            paymentStatus: payload.paymentStatus || prev.paymentStatus,
            statusHistories: [
              ...(prev.statusHistories || []),
              {
                id: Date.now().toString(),
                fromStatus: payload.fromStatus,
                toStatus: payload.toStatus,
                note: payload.note,
                createdAt: payload.updatedAt,
                updatedBy: payload.updatedBy,
              },
            ],
          };
        }
        return prev;
      });

      setTrackingAlert(`⚡ [Realtime] Đơn hàng ${payload.orderNumber} vừa đổi trạng thái sang "${payload.toStatus}"!`);
      setTimeout(() => setTrackingAlert(''), 6000);

      // Cập nhật bảng Admin nếu có
      setAdminOrders((prev) =>
        prev.map((o) =>
          o.orderNumber === payload.orderNumber ? { ...o, status: payload.toStatus } : o,
        ),
      );
    });

    // Lắng nghe đơn hàng mới (Dành cho Admin)
    socket.on('order:created', (payload: any) => {
      console.log('🎉 Realtime order:created received:', payload);
      setAdminOrders((prev) => [payload as any, ...prev]);
    });

    return () => {
      socket.off('order:statusUpdated');
      socket.off('order:created');
    };
  }, []);

  // Lấy thông tin user hiện tại nếu có token
  const checkCurrentUser = async () => {
    const token = localStorage.getItem('shopfast_token');
    if (!token) {
      // Mặc định đăng nhập tài khoản Khách hàng để người dùng vào web có thể xem và đặt ngay
      handleAutoLoginDefault();
      return;
    }
    try {
      const res = await apiClient.get('/auth/me');
      setCurrentUser(res.data.data || res.data.user || res.data);
      if (res.data.data?.fullName) {
        setReceiverName(res.data.data.fullName);
        setReceiverPhone(res.data.data.phone || '0988112233');
      }
    } catch {
      handleAutoLoginDefault();
    }
  };

  const handleAutoLoginDefault = async () => {
    try {
      const res = await apiClient.post('/auth/login', {
        email: 'customer@shopfast.vn',
        password: 'Customer@123456',
      });
      const token = res.data.tokens?.accessToken || res.data.data?.accessToken;
      setAuthToken(token);
      setCurrentUser(res.data.user);
      const socket = getSocket(token);
      setSocketConnected(socket.connected);
    } catch (err) {
      console.log('Chưa đăng nhập');
    }
  };

  // Xử lý Đăng Nhập
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);
    try {
      const res = await apiClient.post('/auth/login', {
        email: authEmail.trim(),
        password: authPassword,
      });

      const token = res.data.tokens?.accessToken || res.data.data?.accessToken;
      setAuthToken(token);
      setCurrentUser(res.data.user);

      // Cập nhật tên người nhận mặc định
      setReceiverName(res.data.user.fullName);
      setReceiverPhone(res.data.user.phone || '0988112233');

      // Tái kết nối socket với token mới
      const socket = getSocket(token);
      setSocketConnected(socket.connected);

      setAuthModalOpen(false);
      alert(`Xin chào ${res.data.user.fullName}! Đăng nhập thành công với vai trò ${res.data.user.role}.`);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setAuthError(Array.isArray(msg) ? msg.join(', ') : msg || 'Đăng nhập thất bại. Vui lòng kiểm tra lại email/mật khẩu.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Xử lý Đăng Ký
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);
    try {
      const res = await apiClient.post('/auth/register', {
        fullName: authFullName.trim(),
        email: authEmail.trim(),
        password: authPassword,
        phone: authPhone.trim(),
      });

      const token = res.data.tokens?.accessToken || res.data.data?.accessToken;
      setAuthToken(token);
      setCurrentUser(res.data.user);
      setReceiverName(res.data.user.fullName);
      setReceiverPhone(res.data.user.phone || authPhone);

      const socket = getSocket(token);
      setSocketConnected(socket.connected);

      setAuthModalOpen(false);
      alert(`Đăng ký tài khoản thành công! Xin chào ${res.data.user.fullName}.`);
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setAuthError(Array.isArray(msg) ? msg.join(', ') : msg || 'Đăng ký thất bại. Email có thể đã tồn tại.');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Xử lý Đăng Xuất
  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setActiveTab('shop');
    alert('Đã đăng xuất tài khoản.');
  };

  // Cuộn xuống tin nhắn AI mới nhất
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiTyping]);

  // Lấy danh sách sản phẩm
  const fetchProducts = async (kw?: string) => {
    setLoadingProducts(true);
    try {
      const res = await apiClient.get('/products', {
        params: { search: kw || undefined, limit: 12 },
      });
      setProducts(res.data.data || []);
    } catch (err) {
      console.error('Lỗi tải sản phẩm:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Tra cứu đơn hàng theo mã
  const fetchOrderDetail = async (orderNum: string) => {
    if (!orderNum) return;
    setLoadingOrder(true);
    try {
      const res = await apiClient.get(`/orders/${orderNum.trim()}`);
      setCurrentOrder(res.data.data);
      const socket = getSocket();
      socket.emit('joinOrder', { orderNumber: res.data.data.orderNumber });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không tìm thấy đơn hàng!');
      setCurrentOrder(null);
    } finally {
      setLoadingOrder(false);
    }
  };

  // Đặt hàng nhanh (Checkout)
  const handleCreateOrder = async () => {
    if (!selectedProduct) return;
    if (!currentUser) {
      setAuthModalOpen(true);
      return;
    }
    setIsSubmittingOrder(true);
    try {
      const res = await apiClient.post('/orders', {
        paymentMethod,
        receiverName,
        receiverPhone,
        shippingAddress,
        notes: orderNotes,
        items: [{ productId: selectedProduct.id, quantity: checkoutQuantity }],
      });

      const newOrder: Order = res.data.data;
      setOrderModalOpen(false);
      alert(`🎉 Đặt hàng thành công! Mã đơn: ${newOrder.orderNumber}`);

      setTrackingOrderNumber(newOrder.orderNumber);
      setCurrentOrder(newOrder);
      setActiveTab('tracking');

      const socket = getSocket();
      socket.emit('joinOrder', { orderNumber: newOrder.orderNumber });

      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi đặt hàng!');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Khách tự hủy đơn PENDING
  const handleCustomerCancel = async () => {
    if (!currentOrder) return;
    if (!confirm('Bạn có chắc chắn muốn hủy đơn hàng này?')) return;
    try {
      await apiClient.post(`/orders/${currentOrder.id}/cancel`, {
        reason: 'Khách hàng đổi ý muốn đổi sản phẩm khác',
      });
      alert('Đã gửi yêu cầu hủy đơn thành công!');
      fetchOrderDetail(currentOrder.orderNumber);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể hủy đơn hàng này!');
    }
  };

  // Gửi tin nhắn tới AI Chatbot
  const handleSendChat = async (presetText?: string) => {
    const textToSend = presetText || inputChat;
    if (!textToSend.trim() || isAiTyping) return;

    const newHistory = [
      ...chatMessages,
      { role: 'user' as const, content: textToSend },
    ];
    setChatMessages(newHistory);
    setInputChat('');
    setIsAiTyping(true);

    try {
      const res = await apiClient.post('/ai/chat', {
        message: textToSend,
        history: newHistory.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      });

      setChatMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: res.data.reply,
          toolCalls: res.data.toolCalls,
          ticketCreated: res.data.ticketCreated,
        },
      ]);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: 'Xin lỗi bạn, kết nối tới dịch vụ AI đang bị gián đoạn. Vui lòng thử lại sau giây lát!',
        },
      ]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Tải dữ liệu trang Admin
  const fetchAdminData = async () => {
    setLoadingAdminData(true);
    try {
      const [ordersRes, ticketsRes] = await Promise.all([
        apiClient.get('/orders', { params: { limit: 20 } }),
        apiClient.get('/ai/tickets', { params: { limit: 20 } }),
      ]);
      setAdminOrders(ordersRes.data.data || []);
      setAdminTickets(ticketsRes.data.data || []);
    } catch (err) {
      console.error('Lỗi tải dữ liệu Admin:', err);
    } finally {
      setLoadingAdminData(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && currentUser && ['ADMIN', 'WAREHOUSE_STAFF', 'SUPPORT_AGENT'].includes(currentUser.role)) {
      fetchAdminData();
    }
  }, [activeTab, currentUser]);

  // Admin cập nhật trạng thái đơn
  const handleAdminUpdateStatus = async (orderId: string, status: string) => {
    try {
      await apiClient.patch(`/orders/${orderId}/status`, {
        status,
        note: `Cập nhật trạng thái thủ công từ Dashboard sang ${status}`,
      });
      fetchAdminData();
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cập nhật trạng thái đơn!');
    }
  };

  // Admin test tự động hủy đơn sau 5 giây (BullMQ Timeout Demo)
  const handleAdminTestTimeout = async (order: Order) => {
    if (!confirm(`Kích hoạt BullMQ hẹn giờ tự động hủy đơn ${order.orderNumber} sau 5 giây để demo trước Hội đồng?`)) return;
    try {
      await apiClient.post('/queue/test-timeout', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        delaySeconds: 5,
      });
      alert(`⏱️ Đã đẩy job vào hàng đợi BullMQ! Đơn ${order.orderNumber} sẽ tự động hủy và hoàn kho sau 5 giây.`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi kích hoạt test timeout!');
    }
  };

  // CSKH phản hồi Ticket
  const handleReplyTicket = async () => {
    if (!selectedTicket || !ticketReplyText.trim()) return;
    try {
      await apiClient.post(`/ai/tickets/${selectedTicket.id}/reply`, {
        content: ticketReplyText,
      });
      alert('Đã gửi phản hồi thành công!');
      setTicketReplyText('');
      const res = await apiClient.get(`/ai/tickets/${selectedTicket.id}`);
      setSelectedTicket(res.data.data);
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi phản hồi vé!');
    }
  };

  // CSKH đổi trạng thái Ticket
  const handleUpdateTicketStatus = async (status: string) => {
    if (!selectedTicket) return;
    try {
      await apiClient.patch(`/ai/tickets/${selectedTicket.id}/status`, {
        status,
        note: `Nhân viên chuyển trạng thái vé sang ${status}`,
      });
      const res = await apiClient.get(`/ai/tickets/${selectedTicket.id}`);
      setSelectedTicket(res.data.data);
      fetchAdminData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi cập nhật vé!');
    }
  };

  const isStaffOrAdmin = currentUser && ['ADMIN', 'WAREHOUSE_STAFF', 'SUPPORT_AGENT'].includes(currentUser.role);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* 🟢 TOP BAR: Giao diện chuẩn mực với Đăng Nhập / Đăng Xuất thông thường */}
      <header className="bg-emerald-700 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo & Tên Dự Án */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-emerald-700 font-extrabold text-xl flex items-center justify-center shadow-sm">
              SF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">ShopFast</span>
                <span className="text-xs bg-emerald-800 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-600 font-semibold">
                  Module 6
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 hidden sm:block">
                Hệ thống E-Commerce NestJS + PostgreSQL + Redis + Gemini AI
              </p>
            </div>
          </div>

          {/* User Account / Login Area */}
          <div className="flex items-center gap-3">
            {/* Realtime Status Indicator */}
            <div className="hidden md:flex items-center gap-2 text-xs bg-emerald-800 px-3 py-1.5 rounded-full border border-emerald-600">
              <span
                className={`w-2 h-2 rounded-full ${
                  socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                }`}
              />
              <span className="text-emerald-100 font-medium">
                {socketConnected ? 'Socket.io: Online' : 'Socket.io: Offline'}
              </span>
            </div>

            {/* Profile or Login Button */}
            {currentUser ? (
              <div className="flex items-center gap-2 bg-emerald-800/90 pl-3 pr-1.5 py-1 rounded-xl border border-emerald-600">
                <div className="text-right">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5 justify-end">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-300" />
                    <span>{currentUser.fullName}</span>
                  </div>
                  <div className="text-[10px] text-emerald-200 font-medium">
                    {currentUser.role === 'ADMIN'
                      ? '👑 Quản Trị Viên'
                      : currentUser.role === 'SUPPORT_AGENT'
                      ? '🎧 CSKH'
                      : '👤 Khách Hàng'}
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  title="Đăng xuất"
                  className="bg-emerald-900/80 hover:bg-red-600 text-white p-1.5 rounded-lg transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthError('');
                  setAuthMode('login');
                  setAuthModalOpen(true);
                }}
                className="bg-white hover:bg-emerald-50 text-emerald-800 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <LogIn className="w-4 h-4 text-emerald-700" />
                Đăng Nhập
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="bg-emerald-800/90 border-t border-emerald-600/40 px-4">
          <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-1.5">
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'shop'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-emerald-100 hover:bg-emerald-700/60'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              1. Mua Sắm (F06)
            </button>

            <button
              onClick={() => setActiveTab('tracking')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'tracking'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-emerald-100 hover:bg-emerald-700/60'
              }`}
            >
              <Activity className="w-4 h-4" />
              2. Theo Dõi Realtime (F02)
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'chat'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-emerald-100 hover:bg-emerald-700/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              3. Trợ Lý AI Gemini (F01)
            </button>

            {/* Chỉ hiện Tab Quản trị nếu có quyền Admin hoặc CSKH */}
            {isStaffOrAdmin && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'admin'
                    ? 'bg-white text-emerald-800 shadow-sm'
                    : 'text-emerald-100 hover:bg-emerald-700/60'
                }`}
              >
                <Sliders className="w-4 h-4" />
                4. Quản Trị & Kho (F03, F05)
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Thông báo Realtime nổi trên cùng */}
      {trackingAlert && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-center text-sm font-bold shadow-md animate-bounce">
          {trackingAlert}
        </div>
      )}

      {/* 🟢 MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* ========================================================= */}
        {/* TAB 1: MUA SẮM VÀ ĐẶT HÀNG (F06, F04)                     */}
        {/* ========================================================= */}
        {activeTab === 'shop' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <ShoppingBag className="w-6 h-6 text-emerald-600" />
                  Danh Sách Sản Phẩm Công Nghệ
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Dữ liệu tải từ PostgreSQL có Redis Caching &lt;2ms (F04). Đặt hàng áp dụng Transaction chống âm kho (F06).
                </p>
              </div>

              {/* Tìm kiếm */}
              <div className="flex items-center gap-2 w-full md:w-80">
                <input
                  type="text"
                  placeholder="Tìm iPhone, MacBook..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchProducts(searchKeyword)}
                  className="w-full text-sm px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={() => fetchProducts(searchKeyword)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                >
                  Tìm
                </button>
              </div>
            </div>

            {/* Grid sản phẩm */}
            {loadingProducts ? (
              <div className="text-center py-16 text-slate-400 font-medium">Đang tải sản phẩm từ máy chủ...</div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 text-slate-400">Không tìm thấy sản phẩm nào!</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl border border-emerald-100/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {p.brand}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            p.stock > 0
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-red-50 text-red-600 border border-red-200'
                          }`}
                        >
                          {p.stock > 0 ? `Còn ${p.stock} cái` : 'Hết hàng'}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-800 text-sm line-clamp-2 hover:text-emerald-600 cursor-pointer">
                        {p.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400 font-medium">Giá bán niêm yết</div>
                        <div className="text-base font-black text-emerald-600">
                          {Number(p.price).toLocaleString('vi-VN')} đ
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setCheckoutQuantity(1);
                          setOrderModalOpen(true);
                        }}
                        disabled={p.stock <= 0}
                        className={`text-xs px-3.5 py-2 rounded-xl font-bold transition shadow-sm ${
                          p.stock > 0
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Mua Ngay
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: THEO DÕI ĐƠN HÀNG REALTIME (F02)                    */}
        {/* ========================================================= */}
        {activeTab === 'tracking' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Activity className="w-6 h-6 text-emerald-600" />
                Theo Dõi Đơn Hàng Realtime (Socket.io - F02)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Nhập mã đơn hàng (ví dụ: SF20261101xxxx) để quan sát sự kiện đổi trạng thái theo thời gian thực mà không cần F5 lại trang!
              </p>

              <div className="flex gap-2 mt-4 max-w-md">
                <input
                  type="text"
                  placeholder="Nhập mã đơn (VD: SF20261101xxxx)..."
                  value={trackingOrderNumber}
                  onChange={(e) => setTrackingOrderNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchOrderDetail(trackingOrderNumber)}
                  className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                />
                <button
                  onClick={() => fetchOrderDetail(trackingOrderNumber)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrder ? 'animate-spin' : ''}`} />
                  Xem Đơn
                </button>
              </div>
            </div>

            {/* Chi tiết đơn & Timeline */}
            {currentOrder ? (
              <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-slate-800">
                        Đơn Hàng #{currentOrder.orderNumber}
                      </span>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full ${
                          currentOrder.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : currentOrder.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse'
                        }`}
                      >
                        {currentOrder.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Đặt lúc: {new Date(currentOrder.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>

                  {currentOrder.status === 'PENDING' && (
                    <button
                      onClick={handleCustomerCancel}
                      className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start"
                    >
                      <XCircle className="w-4 h-4" />
                      Khách Tự Hủy Đơn
                    </button>
                  )}
                </div>

                {/* Stepper Timeline */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6">
                    Tiến Độ Vận Chuyển Realtime
                  </h3>

                  {currentOrder.status === 'CANCELLED' ? (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 font-semibold flex flex-col items-center gap-2">
                      <XCircle className="w-10 h-10 text-red-500" />
                      <div className="text-base font-bold">Đơn hàng này đã bị HỦY (CANCELLED)</div>
                      <div className="text-xs text-red-600">
                        Hệ thống đã tự động hoàn trả số lượng tồn kho của sản phẩm về cơ sở dữ liệu.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 text-center relative">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 shadow-sm ${
                            ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED'].includes(currentOrder.status)
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Clock className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Chờ Xử Lý</span>
                        <span className="text-[10px] text-slate-400">PENDING</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 shadow-sm ${
                            ['CONFIRMED', 'SHIPPING', 'DELIVERED'].includes(currentOrder.status)
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Đã Xác Nhận</span>
                        <span className="text-[10px] text-slate-400">CONFIRMED</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 shadow-sm ${
                            ['SHIPPING', 'DELIVERED'].includes(currentOrder.status)
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Truck className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Đang Giao</span>
                        <span className="text-[10px] text-slate-400">SHIPPING</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm mb-2 shadow-sm ${
                            currentOrder.status === 'DELIVERED'
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Package className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold text-slate-700">Hoàn Tất</span>
                        <span className="text-[10px] text-slate-400">DELIVERED</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Thông tin đơn và món */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs space-y-2">
                    <div className="font-bold text-slate-700 text-sm mb-1">Thông Tin Giao Hàng</div>
                    <div><span className="text-slate-400">Người nhận:</span> <strong className="text-slate-800">{currentOrder.receiverName}</strong> ({currentOrder.receiverPhone})</div>
                    <div><span className="text-slate-400">Địa chỉ:</span> <span className="text-slate-800">{currentOrder.shippingAddress}</span></div>
                    <div><span className="text-slate-400">Hình thức:</span> <span className="font-semibold text-emerald-700">{currentOrder.paymentMethod}</span> ({currentOrder.paymentStatus})</div>
                    {currentOrder.notes && <div><span className="text-slate-400">Ghi chú:</span> <em>{currentOrder.notes}</em></div>}
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs space-y-2">
                    <div className="font-bold text-slate-700 text-sm mb-1">Sản Phẩm Trong Đơn</div>
                    {currentOrder.items?.map((it) => (
                      <div key={it.id} className="flex justify-between items-center py-1 border-b border-slate-200/40">
                        <div>
                          <div className="font-semibold text-slate-800">{it.productName}</div>
                          <div className="text-[10px] text-slate-400">SL: x{it.quantity} | SKU: {it.sku}</div>
                        </div>
                        <div className="font-bold text-emerald-700">
                          {Number(it.totalPrice).toLocaleString('vi-VN')} đ
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 flex justify-between font-black text-sm text-slate-800">
                      <span>Tổng thanh toán:</span>
                      <span className="text-emerald-700">{Number(currentOrder.totalAmount).toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>
                </div>

                {/* Lịch sử trạng thái */}
                {currentOrder.statusHistories && currentOrder.statusHistories.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Nhật Ký Trạng Thái (Status History)
                    </h4>
                    <div className="space-y-2">
                      {currentOrder.statusHistories.map((h) => (
                        <div key={h.id} className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl text-xs flex items-center justify-between">
                          <div>
                            <span className="font-bold text-emerald-800">[{h.toStatus}]</span>: {h.note || 'Không có ghi chú'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {new Date(h.createdAt).toLocaleTimeString('vi-VN')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-emerald-200 p-12 text-center text-slate-400">
                Chưa chọn đơn hàng nào. Hãy nhập mã đơn ở trên hoặc mua một sản phẩm ở Tab 1 để bắt đầu theo dõi.
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: TRỢ LÝ AI CSKH GOOGLE GEMINI (F01)                  */}
        {/* ========================================================= */}
        {activeTab === 'chat' && (
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm flex flex-col h-[680px]">
            <div className="p-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/60 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-sm">ShopFast AI Assistant (Google Gemini F01)</h3>
                  <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Tích hợp Function Calling tự động thao tác Database
                  </div>
                </div>
              </div>

              <button
                onClick={() =>
                  setChatMessages([
                    {
                      role: 'model',
                      content:
                        'Đã làm mới phiên hội thoại! Bạn có thể hỏi mình về giá sản phẩm, tra cứu đơn hàng hoặc tạo phiếu khiếu nại nhé.',
                    },
                  ])
                }
                className="text-xs text-slate-500 hover:text-emerald-700 bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-semibold transition"
              >
                Xóa Lịch Sử
              </button>
            </div>

            {/* Gợi ý câu hỏi nhanh */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-slate-400 font-bold shrink-0">Hỏi nhanh:</span>
              <button
                onClick={() => handleSendChat('Shop còn iPhone 15 Pro Max không, giá bao nhiêu?')}
                className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 px-3 py-1 rounded-full font-medium whitespace-nowrap transition shadow-2xs"
              >
                🔍 Còn iPhone 15 không?
              </button>
              {currentOrder && (
                <button
                  onClick={() => handleSendChat(`Kiểm tra đơn hàng ${currentOrder.orderNumber} giúp mình!`)}
                  className="bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 px-3 py-1 rounded-full font-medium whitespace-nowrap transition shadow-2xs"
                >
                  📦 Tra cứu đơn #{currentOrder.orderNumber}
                </button>
              )}
              <button
                onClick={() =>
                  handleSendChat(
                    'Hàng của tôi nhận bị vỡ nát màn hình rồi, đổi trả giúp tôi với!',
                  )
                }
                className="bg-white border border-red-200 text-red-700 hover:bg-red-50 px-3 py-1 rounded-full font-medium whitespace-nowrap transition shadow-2xs"
              >
                ⚠️ Báo hỏng hàng & Đổi trả
              </button>
            </div>

            {/* Khung tin nhắn */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {chatMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      AI
                    </div>
                  )}

                  <div
                    className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-none'
                        : 'bg-slate-100 text-slate-800 border border-slate-200/80 rounded-tl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {m.toolCalls && m.toolCalls.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 space-y-1">
                        <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          Function Calling Thực Thi Thành Công:
                        </div>
                        {m.toolCalls.map((tc, tidx) => (
                          <div key={tidx} className="bg-emerald-50 text-emerald-900 px-2 py-1 rounded text-[11px] font-mono border border-emerald-200/60">
                            <strong>{tc.toolName}</strong>({JSON.stringify(tc.args)})
                          </div>
                        ))}
                      </div>
                    )}

                    {m.ticketCreated && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                        <div className="font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Đã tự động khởi tạo Ticket #{m.ticketCreated.ticketNumber}
                        </div>
                        <div className="text-[11px] mt-0.5 text-amber-700">
                          {m.ticketCreated.title} — Trạng thái: <strong>{m.ticketCreated.status}</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      Bạn
                    </div>
                  )}
                </div>
              ))}

              {isAiTyping && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    AI
                  </div>
                  <div className="bg-slate-100 border border-slate-200/80 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Gemini AI đang suy nghĩ và kiểm tra cơ sở dữ liệu...
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Chat */}
            <div className="p-3 border-t border-slate-200 flex gap-2">
              <input
                type="text"
                placeholder="Nhập câu hỏi (VD: Tra cứu đơn hàng, Hỏi giá sản phẩm, Khiếu nại vỡ màn hình)..."
                value={inputChat}
                onChange={(e) => setInputChat(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                className="flex-1 text-xs px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => handleSendChat()}
                disabled={isAiTyping}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
              >
                <Send className="w-4 h-4" />
                Gửi
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: QUẢN TRỊ & KHO (F03, F05 - RBAC)                    */}
        {/* ========================================================= */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            {!isStaffOrAdmin ? (
              <div className="bg-white rounded-2xl border border-emerald-100 p-12 text-center max-w-md mx-auto space-y-4 shadow-sm">
                <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
                <h3 className="text-lg font-bold text-slate-800">Quyền Truy Cập Bị Giới Hạn</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Khu vực Quản trị & Kho vận chỉ dành riêng cho <strong>Quản Trị Viên (ADMIN)</strong> và <strong>Nhân Viên Hỗ Trợ (SUPPORT_AGENT)</strong> theo phân quyền RBAC (F03).
                </p>
                <button
                  onClick={() => {
                    setAuthEmail('admin@shopfast.vn');
                    setAuthPassword('Admin@123456');
                    setAuthError('');
                    setAuthMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Đăng Nhập Tài Khoản Quản Trị
                </button>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                      <Sliders className="w-6 h-6 text-emerald-600" />
                      Trung Tâm Quản Trị & Kho Vận (Admin / CSKH)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Đổi trạng thái đơn hàng để kích hoạt Socket.io Realtime (F02) và kích hoạt BullMQ Timeout (F05).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setAdminActiveSubTab('orders')}
                      className={`text-xs px-4 py-2 rounded-lg font-bold transition ${
                        adminActiveSubTab === 'orders'
                          ? 'bg-white text-emerald-800 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📦 Quản Lý Đơn Hàng ({adminOrders.length})
                    </button>
                    <button
                      onClick={() => setAdminActiveSubTab('tickets')}
                      className={`text-xs px-4 py-2 rounded-lg font-bold transition ${
                        adminActiveSubTab === 'tickets'
                          ? 'bg-white text-emerald-800 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🎫 Phiếu Hỗ Trợ Ticket ({adminTickets.length})
                    </button>
                  </div>
                </div>

                {loadingAdminData && (
                  <div className="bg-white rounded-2xl border border-emerald-100 p-8 text-center text-slate-400 text-xs">
                    Đang tải dữ liệu quản trị từ máy chủ...
                  </div>
                )}

                {/* Sub-tab 1: Danh sách đơn hàng */}
                {!loadingAdminData && adminActiveSubTab === 'orders' && (
                  <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-emerald-50/70 text-emerald-900 uppercase font-black tracking-wider text-[11px] border-b border-emerald-100">
                          <tr>
                            <th className="py-3.5 px-4">Mã Đơn</th>
                            <th className="py-3.5 px-4">Khách Hàng</th>
                            <th className="py-3.5 px-4">Tổng Tiền</th>
                            <th className="py-3.5 px-4">Trạng Thái</th>
                            <th className="py-3.5 px-4">Hành Động Đổi Trạng Thái (F02 Realtime)</th>
                            <th className="py-3.5 px-4">Demo BullMQ (F05)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {adminOrders.map((o) => (
                            <tr key={o.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-3 px-4 font-mono font-bold text-slate-800">{o.orderNumber}</td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-slate-800">{o.receiverName}</div>
                                <div className="text-[10px] text-slate-400">{o.receiverPhone}</div>
                              </td>
                              <td className="py-3 px-4 font-bold text-emerald-700">
                                {Number(o.totalAmount).toLocaleString('vi-VN')} đ
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                    o.status === 'CANCELLED'
                                      ? 'bg-red-100 text-red-700'
                                      : o.status === 'DELIVERED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  {o.status}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    onClick={() => handleAdminUpdateStatus(o.id, 'CONFIRMED')}
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition"
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    onClick={() => handleAdminUpdateStatus(o.id, 'SHIPPING')}
                                    className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition"
                                  >
                                    Giao hàng
                                  </button>
                                  <button
                                    onClick={() => handleAdminUpdateStatus(o.id, 'DELIVERED')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[11px] font-semibold transition"
                                  >
                                    Hoàn tất
                                  </button>
                                  <button
                                    onClick={() => handleAdminUpdateStatus(o.id, 'CANCELLED')}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition"
                                  >
                                    Hủy đơn
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {o.status === 'PENDING' ? (
                                  <button
                                    onClick={() => handleAdminTestTimeout(o)}
                                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shadow-2xs"
                                  >
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Hủy sau 5s
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">Không khả dụng</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Sub-tab 2: Danh sách Ticket CSKH */}
                {!loadingAdminData && adminActiveSubTab === 'tickets' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm lg:col-span-1 space-y-3">
                      <h3 className="font-bold text-slate-800 text-sm">Danh Sách Phiếu Hỗ Trợ</h3>
                      <div className="space-y-2 max-h-[600px] overflow-y-auto">
                        {adminTickets.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTicket(t)}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                              selectedTicket?.id === t.id
                                ? 'bg-emerald-50 border-emerald-400 shadow-xs'
                                : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono font-bold text-slate-700">
                              <span>{t.ticketNumber}</span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] ${
                                  t.status === 'OPEN'
                                    ? 'bg-red-100 text-red-700 font-bold'
                                    : t.status === 'IN_PROGRESS'
                                    ? 'bg-amber-100 text-amber-800 font-bold'
                                    : 'bg-emerald-100 text-emerald-800 font-bold'
                                }`}
                              >
                                {t.status}
                              </span>
                            </div>
                            <div className="font-semibold text-slate-800 mt-1 line-clamp-1">{t.title}</div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Ưu tiên: <strong className="text-slate-600">{t.priority}</strong> | Loại: {t.category}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm lg:col-span-2">
                      {selectedTicket ? (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                              <div className="text-base font-black text-slate-800">
                                [{selectedTicket.ticketNumber}] {selectedTicket.title}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                Phân loại: {selectedTicket.category} | Mức độ: {selectedTicket.priority}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleUpdateTicketStatus('IN_PROGRESS')}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                              >
                                Tiếp nhận (IN_PROGRESS)
                              </button>
                              <button
                                onClick={() => handleUpdateTicketStatus('RESOLVED')}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-xs"
                              >
                                Giải quyết (RESOLVED)
                              </button>
                            </div>
                          </div>

                          <div className="space-y-3 max-h-[360px] overflow-y-auto p-2">
                            {selectedTicket.messages?.map((m) => (
                              <div
                                key={m.id}
                                className={`p-3 rounded-xl text-xs space-y-1 ${
                                  m.senderType === 'CUSTOMER'
                                    ? 'bg-slate-100 border border-slate-200'
                                    : m.senderType === 'AI_AGENT'
                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                                    : 'bg-sky-50 border border-sky-200 text-sky-900'
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold text-[11px]">
                                  <span>
                                    {m.senderType === 'CUSTOMER'
                                      ? '👤 Khách Hàng'
                                      : m.senderType === 'AI_AGENT'
                                      ? '🤖 ShopFast AI'
                                      : '👨‍💼 Nhân Viên CSKH'}
                                  </span>
                                  <span className="text-slate-400 font-normal">
                                    {new Date(m.createdAt).toLocaleTimeString('vi-VN')}
                                  </span>
                                </div>
                                <div className="whitespace-pre-wrap">{m.content}</div>
                              </div>
                            ))}
                          </div>

                          <div className="pt-4 border-t border-slate-100 flex gap-2">
                            <input
                              type="text"
                              placeholder="Nhập nội dung phản hồi tới khách hàng..."
                              value={ticketReplyText}
                              onChange={(e) => setTicketReplyText(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleReplyTicket()}
                              className="flex-1 text-xs px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button
                              onClick={handleReplyTicket}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Phản Hồi
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-xs py-20">
                          Chọn một phiếu hỗ trợ ở danh sách bên trái để xem nội dung và trả lời.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL ĐĂNG NHẬP / ĐĂNG KÝ (CHUẨN CHỈNH)                    */}
      {/* ========================================================= */}
      {authModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  {authMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                </div>
                <h3 className="text-lg font-black text-slate-800">
                  {authMode === 'login' ? 'Đăng Nhập Tài Khoản' : 'Đăng Ký Tài Khoản'}
                </h3>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {/* Error alert */}
            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>{authError}</div>
              </div>
            )}

            {/* Switch Mode Tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthError('');
                }}
                className={`py-2 rounded-lg transition ${
                  authMode === 'login' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Đăng Nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setAuthError('');
                }}
                className={`py-2 rounded-lg transition ${
                  authMode === 'register' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Đăng Ký Mới
              </button>
            </div>

            {/* Form */}
            <form onSubmit={authMode === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-3.5 text-xs">
              {authMode === 'register' && (
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Họ và tên:</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={authFullName}
                      onChange={(e) => setAuthFullName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-bold mb-1">Địa chỉ Email:</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="email@shopfast.vn"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-slate-600 font-bold mb-1">Số điện thoại:</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                    <input
                      type="tel"
                      required
                      placeholder="0901234567"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-600 font-bold mb-1">Mật khẩu:</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu..."
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingAuth}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl transition shadow-md shadow-emerald-600/20 text-xs mt-2"
              >
                {isSubmittingAuth ? 'Đang xử lý...' : authMode === 'login' ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
              </button>
            </form>

            {/* Gợi ý tài khoản demo */}
            {authMode === 'login' && (
              <div className="pt-3 border-t border-slate-100">
                <div className="text-[11px] font-bold text-slate-400 mb-2">Tài khoản demo sẵn (Bấm để điền nhanh):</div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEmail('admin@shopfast.vn');
                      setAuthPassword('Admin@123456');
                    }}
                    className="bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 p-1.5 rounded-lg text-slate-600 font-semibold text-center transition"
                  >
                    👑 Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEmail('support@shopfast.vn');
                      setAuthPassword('Staff@123456');
                    }}
                    className="bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 p-1.5 rounded-lg text-slate-600 font-semibold text-center transition"
                  >
                    🎧 CSKH
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthEmail('customer@shopfast.vn');
                      setAuthPassword('Customer@123456');
                    }}
                    className="bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 p-1.5 rounded-lg text-slate-600 font-semibold text-center transition"
                  >
                    👤 Khách Hàng
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL MUA HÀNG NHANH (CHECKOUT FORM)                      */}
      {/* ========================================================= */}
      {orderModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-emerald-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                Xác Nhận Đặt Hàng
              </h3>
              <button
                onClick={() => setOrderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-sm">{selectedProduct.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Giá: <strong className="text-emerald-700">{Number(selectedProduct.price).toLocaleString('vi-VN')} đ</strong>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Số lượng:</span>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.stock}
                  value={checkoutQuantity}
                  onChange={(e) => setCheckoutQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-center font-bold text-sm py-1 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-bold mb-1">Họ tên người nhận:</label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Số điện thoại:</label>
                <input
                  type="text"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Địa chỉ nhận hàng:</label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Phương thức thanh toán:</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('COD')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      paymentMethod === 'COD'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Building className="w-4 h-4" />
                    Thanh toán khi nhận (COD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('BANK_TRANSFER')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 ${
                      paymentMethod === 'BANK_TRANSFER'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Chuyển khoản (15p hủy)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">Ghi chú đơn hàng:</label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Giao hàng giờ hành chính..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Tổng thanh toán:</div>
                <div className="text-lg font-black text-emerald-700">
                  {(Number(selectedProduct.price) * checkoutQuantity).toLocaleString('vi-VN')} đ
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={isSubmittingOrder}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
                >
                  {isSubmittingOrder ? 'Đang tạo đơn...' : 'Xác Nhận Đặt Hàng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        ShopFast E-Commerce Platform — Module 6 Thesis Defense Project.
      </footer>
    </div>
  );
}
