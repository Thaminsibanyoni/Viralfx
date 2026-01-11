import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  adminSecret: process.env.JWT_ADMIN_SECRET,
  adminRefreshSecret: process.env.JWT_ADMIN_REFRESH_SECRET,
  adminExpiresIn: process.env.JWT_ADMIN_EXPIRES_IN || '15m',
  adminRefreshExpiresIn: process.env.JWT_ADMIN_REFRESH_EXPIRES_IN || '7d'
}));
