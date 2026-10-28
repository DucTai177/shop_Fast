import { useState } from 'react';
import { ShoppingCart, MessageSquareText, Activity, ShieldCheck, Box } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'shop' | 'tracking' | 'chat' | 'warehouse'>('shop');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-blue-500/20">
              SF
            </div>
            <div>
              <span className="text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                ShopFast
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                Module 6
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('shop')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'shop'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              Sản phẩm & Đơn hàng
            </button>
            <button
              onClick={() => setActiveTab('tracking')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'tracking'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Activity className="w-4 h-4" />
              Theo dõi Realtime
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MessageSquareText className="w-4 h-4" />
              Trợ lý AI CSKH
            </button>
            <button
              onClick={() => setActiveTab('warehouse')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'warehouse'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Box className="w-4 h-4" />
              Kho vận hành
            </button>
          </nav>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Redis Cache & Rate Limit Active</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Hệ thống ShopFast đã sẵn sàng</h2>
          <p className="text-slate-500 mb-6">
            Khung dự án (Monorepo Backend NestJS 10 + Frontend React Vite + Docker Compose PostgreSQL/Redis) đã được khởi tạo thành công.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Hạ Tầng</span>
              <h3 className="font-semibold text-slate-800 mt-1">PostgreSQL 16 & Redis 7</h3>
              <p className="text-sm text-slate-500 mt-1">Chạy qua Docker Compose, tích hợp bộ đệm và hàng đợi BullMQ.</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Thời Gian Thực</span>
              <h3 className="font-semibold text-slate-800 mt-1">Socket.io Gateway</h3>
              <p className="text-sm text-slate-500 mt-1">Theo dõi đơn hàng phân quyền theo room, cập nhật tức thời &lt;1s.</p>
            </div>
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Trí Tuệ Nhân Tạo</span>
              <h3 className="font-semibold text-slate-800 mt-1">AI CSKH Agent</h3>
              <p className="text-sm text-slate-500 mt-1">Tra cứu tồn kho & trạng thái đơn hàng tự động qua Function Calling.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        ShopFast Platform © 2026 - Defense Case Study 6 Module 6
      </footer>
    </div>
  );
}
