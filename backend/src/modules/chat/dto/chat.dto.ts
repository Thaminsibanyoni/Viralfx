import { IsString, IsOptional, IsEnum, IsArray, IsNumber, IsObject, IsDateString, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MessageType, ChatRoomType, MessageStatus, UserRole } from '../types/chat.types';

export class CreateRoomDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(ChatRoomType)
  type: ChatRoomType;

  @IsString()
  @IsOptional()
  topicId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participantIds?: string[];

  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class JoinRoomDto {
  @IsString()
  roomId: string;

  @IsString()
  @IsOptional()
  inviteCode?: string;
}

export class SendMessageDto {
  @IsString()
  roomId: string;

  @IsString()
  @MaxLength(2000)
  content: string;

  @IsEnum(MessageType)
  @IsOptional()
  type: MessageType = MessageType.TEXT;

  @IsObject()
  @IsOptional()
  metadata?: any;

  @IsString()
  @IsOptional()
  replyToId?: string;
}

export class EditMessageDto {
  @IsString()
  @MaxLength(2000)
  content: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class AddReactionDto {
  @IsString()
  messageId: string;

  @IsString()
  @MaxLength(10)
  emoji: string;
}

export class MessageQueryDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 50;

  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @IsString()
  @IsOptional()
  senderId?: string;

  @IsString()
  @IsOptional()
  before?: string;

  @IsString()
  @IsOptional()
  after?: string;
}

export class RoomQueryDto {
  @IsEnum(ChatRoomType)
  @IsOptional()
  type?: ChatRoomType;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;

  @IsString()
  @IsOptional()
  includeArchived?: boolean = false;
}

export class MessageDto {
  id: string;
  roomId: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  sender?: {
    id: string;
    username: string;
    profile?: {
      firstName: string;
      lastName: string;
      avatar: string;
    };
  };
  replyTo?: {
    id: string;
    content: string;
    sender: {
      id: string;
      username: string;
    };
  };
  reactions?: Array<{
    id: string;
    emoji: string;
    user: {
      id: string;
      username: string;
    };
    createdAt: Date;
  }>;
  isEdited: boolean;
}

export class ChatRoomDto {
  id: string;
  name?: string;
  description?: string;
  type: ChatRoomType;
  topicId?: string;
  isArchived: boolean;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt?: Date;
  participantCount?: number;
  messageCount?: number;
  unreadCount?: number;
}

export class ChatRoomResponseDto extends ChatRoomDto {
  createdBy?: {
    id: string;
    username: string;
    profile?: {
      firstName: string;
      lastName: string;
      avatar: string;
    };
  };
  participants?: Array<{
    id: string;
    user: {
      id: string;
      username: string;
      email?: string;
      profile?: {
        firstName: string;
        lastName: string;
        avatar: string;
        isOnline?: boolean;
      };
    };
    role: UserRole;
    joinedAt: Date;
    lastActiveAt: Date;
    isMuted: boolean;
  }>;
  topic?: {
    id: string;
    name: string;
    description: string;
    category: string;
  };
  lastMessage?: MessageDto;
}

export class TypingDto {
  @IsString()
  roomId: string;

  @IsOptional()
  @IsString()
  duration?: number = 5000; // 5 seconds default
}

export class MarkAsReadDto {
  @IsString()
  roomId: string;

  @IsString()
  @IsOptional()
  messageId?: string; // If provided, marks all messages before this as read
}

export class MuteUserDto {
  @IsString()
  userId: string;

  @IsNumber()
  @Min(1)
  @Max(8760) // Max 1 year in hours
  @Type(() => Number)
  @IsOptional()
  durationHours?: number = 1;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class BanUserDto {
  @IsString()
  userId: string;

  @IsNumber()
  @Min(1)
  @Max(8760) // Max 1 year in hours
  @Type(() => Number)
  @IsOptional()
  durationHours?: number = 24;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class UpdateRoomDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;

  @IsOptional()
  isArchived?: boolean;
}

export class AddParticipantsDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.MEMBER;
}

export class RemoveParticipantDto {
  @IsString()
  userId: string;
}

export class UpdateParticipantRoleDto {
  @IsString()
  userId: string;

  @IsEnum(UserRole)
  role: UserRole;
}

export class MessageSearchDto {
  @IsString()
  roomId: string;

  @IsString()
  @Min(1)
  @MaxLength(100)
  query: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType;

  @IsString()
  @IsOptional()
  senderId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 20;
}

export class ChatStatsDto {
  @IsString()
  @IsOptional()
  roomId?: string;

  @IsString()
  @IsOptional()
  timeWindow?: string; // e.g., '24h', '7d', '30d'
}

export class ChatNotificationDto {
  @IsString()
  userId: string;

  @IsString()
  roomId: string;

  @IsString()
  type: 'NEW_MESSAGE' | 'MENTION' | 'ROOM_INVITE' | 'ROOM_UPDATE';

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsObject()
  @IsOptional()
  data?: any;
}

export class ExportChatDto {
  @IsString()
  roomId: string;

  @IsEnum(['JSON', 'CSV', 'TXT'])
  format: 'JSON' | 'CSV' | 'TXT';

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsBoolean()
  @IsOptional()
  includeMetadata?: boolean = false;
}