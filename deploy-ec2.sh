#!/usr/bin/env bash
# ==============================================================================
# ShopFast - Script Tự Động Triển Khai Lên AWS EC2 (Ubuntu 22.04 / 24.04 LTS)
# ==============================================================================
set -e

echo "🚀 [1/5] Bắt đầu kiểm tra hệ thống và cấu hình Swap Memory..."

# Tạo 2GB Swap Memory (Cực kỳ quan trọng cho EC2 t2.micro / t3.micro chỉ có 1GB RAM)
# Giúp quá trình build Docker NestJS và React không bị OOM (tràn RAM làm treo máy)
SWAP_EXISTS=$(swapon --show | wc -l)
if [ "$SWAP_EXISTS" -le 1 ]; then
    echo "⚙️ Đang cấp phát 2GB Swap Memory cho EC2..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Đã tạo thành công 2GB Swap Memory."
else
    echo "✅ Swap Memory đã được thiết lập từ trước."
fi

echo "🐳 [2/5] Kiểm tra và cài đặt Docker & Docker Compose..."
if ! command -v docker &> /dev/null; then
    echo "📦 Đang cài đặt Docker chính hãng từ Docker Inc..."
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker đã được cài đặt thành công."
else
    echo "✅ Docker đã tồn tại trên máy."
fi

# Đảm bảo Docker service đang chạy
sudo systemctl enable docker
sudo systemctl start docker

echo "🔑 [3/5] Kiểm tra file cấu hình môi trường .env..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo "📋 Tạo file .env từ .env.example..."
        cp .env.example .env
    else
        echo "⚠️ Lưu ý: Chưa có file .env. Vui lòng cập nhật GEMINI_API_KEY vào .env!"
    fi
fi

echo "🏗️ [4/5] Khởi động toàn bộ cụm Container (PostgreSQL, Redis, NestJS, React + Nginx)..."
# Chạy Docker Compose Production
sudo docker compose -f docker-compose.prod.yml down || true
sudo docker compose -f docker-compose.prod.yml up -d --build

echo "⏳ Đang đợi các container khởi động và kiểm tra Healthcheck..."
sleep 10

echo "📋 [5/5] Trạng thái các container đang chạy:"
sudo docker compose -f docker-compose.prod.yml ps

PUBLIC_IP=$(curl -s http://checkip.amazonaws.com || curl -s https://ifconfig.me || echo "YOUR-EC2-PUBLIC-IP")

echo "=============================================================================="
echo "🎉 CHÚC MỪNG BẠN! HỆ THỐNG SHOPFAST ĐÃ ĐƯỢC TRIỂN KHAI THÀNH CÔNG LÊN AWS EC2!"
echo "=============================================================================="
echo "🌐 Trang chủ Web (Khách hàng & Bán hàng): http://$PUBLIC_IP"
echo "📚 Tài liệu API Swagger (Dành cho Giám khảo): http://$PUBLIC_IP/api/docs"
echo "🔌 WebSocket Realtime Endpoint: ws://$PUBLIC_IP/socket.io"
echo "=============================================================================="
echo "Tài khoản đăng nhập hệ thống thử nghiệm:"
echo "👑 Quản trị viên (Admin): admin@shopfast.vn   | Mật khẩu: Admin@123456"
echo "🎧 Chăm sóc khách hàng:   support@shopfast.vn | Mật khẩu: Staff@123456"
echo "👤 Khách hàng mua sắm:    viet@gmail.com      | Mật khẩu: Customer@123456"
echo "=============================================================================="

