import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly maxFailedAttempts = 5;
  private readonly lockoutDurationMs = 15 * 60 * 1000; // 15 phút

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Đăng ký tài khoản khách hàng mới
   */
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email này đã được đăng ký trong hệ thống.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: UserRole.CUSTOMER,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      message: 'Đăng ký tài khoản thành công.',
      user,
      tokens,
    };
  }

  /**
   * Đăng nhập kèm cơ chế chặn leo thang dò mật khẩu (Brute-Force F03)
   */
  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    // 1. Kiểm tra tài khoản có đang bị khóa do nhập sai mật khẩu quá 5 lần không
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (60 * 1000),
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: `Tài khoản của bạn đã bị tạm khóa do nhập sai mật khẩu quá nhiều lần. Vui lòng thử lại sau ${remainingMinutes} phút.`,
          retryAfterMinutes: remainingMinutes,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản này đã bị quản trị viên vô hiệu hóa.');
    }

    // 2. So sánh mật khẩu
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      const newFailedCount = user.failedLoginCount + 1;

      // Nếu vượt ngưỡng 5 lần, tiến hành khóa tài khoản 15 phút
      if (newFailedCount >= this.maxFailedAttempts) {
        const lockedUntil = new Date(Date.now() + this.lockoutDurationMs);
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: 0,
            lockedUntil,
          },
        });

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message:
              'Bạn đã nhập sai mật khẩu 5 lần liên tiếp. Tài khoản đã bị tạm khóa trong 15 phút để bảo vệ an toàn.',
            retryAfterMinutes: 15,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else {
        // Cập nhật số lần nhập sai
        await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: newFailedCount },
        });

        const remainingAttempts = this.maxFailedAttempts - newFailedCount;
        throw new UnauthorizedException(
          `Mật khẩu không chính xác. Bạn còn ${remainingAttempts} lần thử trước khi tài khoản bị khóa tạm thời.`,
        );
      }
    }

    // 3. Đăng nhập thành công -> Reset bộ đếm nhập sai
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      message: 'Đăng nhập thành công.',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * Cấp lại Access Token mới từ Refresh Token
   */
  async refreshToken(dto: RefreshTokenDto) {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'shopfast_refresh_jwt_super_secret_key_2026_module6';

      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc người dùng không tồn tại.');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.role);

      return {
        message: 'Làm mới token thành công.',
        tokens,
      };
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  /**
   * Sinh bộ cặp Access Token và Refresh Token
   */
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'shopfast_jwt_super_secret_key_2026_module6_defense';
    const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '1d';

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'shopfast_refresh_jwt_super_secret_key_2026_module6';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as any,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as any,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
    };
  }
}
