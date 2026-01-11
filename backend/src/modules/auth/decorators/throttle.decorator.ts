import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';
export const Throttle = (limit: number) => SetMetadata('throttle-limit', limit);
