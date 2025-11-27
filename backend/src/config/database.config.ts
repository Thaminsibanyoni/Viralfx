import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 2,
  poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 10,
}));