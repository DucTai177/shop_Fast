import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Authentication (Xác thực & Phân quyền)')
@Controller() // Để trống để viết tường minh toàn bộ đường dẫn link bên dưới như Express
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Đăng ký tài khoản
   * Đường dẫn: POST /api/v1/auth/register
   */
  @Post('/api/v1/auth/register')
  @ApiOperation({ summary: 'Đăng ký tài khoản khách hàng mới' })
  @ApiResponse({
    status: 201,
    description: 'Đăng ký thành công, trả về thông tin user và cặp token',
  })
  @ApiResponse({ status: 409, description: 'Email đã tồn tại' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Đăng nhập (Chống dò mật khẩu Brute-force F03)
   * Đường dẫn: POST /api/v1/auth/login
   */
  @Post('/api/v1/auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Đăng nhập hệ thống (Có cơ chế chống Brute-Force F03)',
  })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  @ApiResponse({ status: 401, description: 'Sai email hoặc mật khẩu' })
  @ApiResponse({
    status: 429,
    description: 'Tài khoản bị tạm khóa do nhập sai quá 5 lần',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * Cấp lại token khi token cũ hết hạn
   * Đường dẫn: POST /api/v1/auth/refresh
   */
  @Post('/api/v1/auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới Access Token bằng Refresh Token' })
  @ApiResponse({ status: 200, description: 'Cấp mới token thành công' })
  @ApiResponse({
    status: 401,
    description: 'Refresh token không hợp lệ hoặc đã hết hạn',
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  /**
   * Lấy thông tin tài khoản hiện tại từ Token
   * Đường dẫn: GET /api/v1/auth/me
   */
  @Get('/api/v1/auth/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin tài khoản hiện tại từ Token' })
  @ApiResponse({
    status: 200,
    description: 'Trả về thông tin chi tiết của người dùng đang đăng nhập',
  })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  async getProfile(@CurrentUser() user: any) {
    return {
      message: 'Lấy thông tin cá nhân thành công.',
      user,
    };
  }
}
