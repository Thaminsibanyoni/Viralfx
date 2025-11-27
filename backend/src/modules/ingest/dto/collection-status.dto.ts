import { ApiProperty } from '@nestjs/swagger';
import { CollectionStatus } from '../interfaces/ingest.interface';

export class CollectionStatusDto implements CollectionStatus {
  @ApiProperty({
    description: 'Platform name',
    example: 'twitter',
  })
  platform: string;

  @ApiProperty({
    description: 'Whether collection is currently running',
    example: false,
  })
  isRunning: boolean;

  @ApiProperty({
    description: 'Last collection run time',
    example: '2024-01-15T10:30:00Z',
  })
  lastRun: Date | null;

  @ApiProperty({
    description: 'Next scheduled collection time',
    example: '2024-01-15T10:32:00Z',
  })
  nextRun: Date | null;

  @ApiProperty({
    description: 'Total number of items collected',
    example: 1250,
  })
  totalCollected: number;

  @ApiProperty({
    description: 'Total number of failed collection attempts',
    example: 5,
  })
  totalFailed: number;
}

export class CollectionStatusResponseDto {
  @ApiProperty({
    description: 'Collection status for all platforms',
    type: [CollectionStatusDto],
  })
  platforms: CollectionStatusDto[];

  @ApiProperty({
    description: 'Total number of items collected across all platforms',
    example: 5000,
  })
  totalCollected: number;

  @ApiProperty({
    description: 'Total number of failed collection attempts across all platforms',
    example: 15,
  })
  totalFailed: number;

  @ApiProperty({
    description: 'Whether any platform is currently collecting',
    example: true,
  })
  isAnyRunning: boolean;

  @ApiProperty({
    description: 'Last update time of status information',
    example: '2024-01-15T10:31:00Z',
  })
  lastUpdated: Date;
}