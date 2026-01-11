import { HttpException, HttpStatus } from '@nestjs/common';
// COMMENTED OUT (TypeORM entity deleted): import { BetStatus } from '../entities/bet.entity';

export class BetStatusTransitionError extends HttpException {
  constructor(
    fromStatus: BetStatus,
    toStatus: BetStatus,
    betId?: string) {
    const message = betId
      ? `Invalid bet status transition from ${fromStatus} to ${toStatus} for bet ${betId}`
      : `Invalid bet status transition from ${fromStatus} to ${toStatus}`;

    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        message,
        error: 'BetStatusTransitionError',
        fromStatus,
        toStatus,
        betId
      },
      HttpStatus.BAD_REQUEST);
  }
}
