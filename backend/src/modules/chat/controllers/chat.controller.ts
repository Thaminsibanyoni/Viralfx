import { 
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  BadRequestException,
  Request, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { ChatService } from '../services/chat.service';
import { ChatModerationService } from '../services/chat-moderation.service';
import {
  CreateRoomDto,
  SendMessageDto,
  EditMessageDto,
  AddReactionDto,
  MessageQueryDto,
  RoomQueryDto,
  TypingDto,
  MarkAsReadDto,
  MuteUserDto,
  BanUserDto,
  UpdateRoomDto,
  AddParticipantsDto,
  RemoveParticipantDto,
  UpdateParticipantRoleDto,
  MessageSearchDto,
  ChatStatsDto,
  ExportChatDto
} from '../dto/chat.dto';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard, ThrottlerGuard, RolesGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly moderationService: ChatModerationService) {}

  // Rooms endpoints
  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new chat room' })
  @ApiResponse({ status: 201, description: 'Chat room created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid room data' })
  async createRoom(
    @Body() roomData: CreateRoomDto,
    @Req() req) {
    return this.chatService.createRoom({
      ...roomData,
      createdBy: req.user.userId
    });
  }

  @Get('rooms')
  @ApiOperation({ summary: "Get current user's chat rooms" })
  @ApiQuery({ name: 'type', required: false, enum: ['PUBLIC', 'PRIVATE', 'DIRECT_MESSAGE', 'GROUP', 'TOPIC_BASED'], description: 'Filter by room type' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean, description: 'Include archived rooms' })
  @ApiResponse({ status: 200, description: 'Chat rooms retrieved successfully' })
  async getUserRooms(
    @Req() req,
    @Query() query: RoomQueryDto) {
    return this.chatService.getUserRooms(req.user.userId, query);
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'Get chat room by ID' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Chat room retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async getRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    return this.chatService.getRoomById(id, req.user.userId);
  }

  @Put('rooms/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update chat room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Chat room updated successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: UpdateRoomDto,
    @Req() req) {
    return this.chatService.updateRoom(id, updateData, req.user.userId);
  }

  @Post('rooms/:id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a public chat room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Successfully joined room' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async joinRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    await this.chatService.joinRoom(req.user.userId, id);
    return { message: 'Successfully joined room' };
  }

  @Post('rooms/:id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a chat room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Successfully left room' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async leaveRoom(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    await this.chatService.leaveRoom(req.user.userId, id);
    return { message: 'Successfully left room' };
  }

  @Post('rooms/:id/participants')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add participants to room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 201, description: 'Participants added successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async addParticipants(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: AddParticipantsDto,
    @Req() req) {
    return this.chatService.addParticipants(id, data.userIds, data.role, req.user.userId);
  }

  @Delete('rooms/:id/participants/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove participant from room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiParam({ name: 'userId', description: 'User ID to remove' })
  @ApiResponse({ status: 200, description: 'Participant removed successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async removeParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req) {
    await this.chatService.removeParticipant(id, userId, req.user.userId);
    return { message: 'Participant removed successfully' };
  }

  @Put('rooms/:id/participants/:userId/role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update participant role' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Participant role updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateParticipantRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() data: UpdateParticipantRoleDto,
    @Req() req) {
    await this.chatService.updateParticipantRole(id, userId, data.role, req.user.userId);
    return { message: 'Participant role updated successfully' };
  }

  // Messages endpoints
  @Post('messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid message data' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async sendMessage(
    @Body() messageData: SendMessageDto,
    @Req() req) {
    return this.chatService.sendMessage(req.user.userId, messageData);
  }

  @Get('rooms/:id/messages')
  @ApiOperation({ summary: 'Get messages in a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 50)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search query' })
  @ApiQuery({ name: 'type', required: false, description: 'Message type filter' })
  @ApiQuery({ name: 'senderId', required: false, description: 'Filter by sender ID' })
  @ApiQuery({ name: 'before', required: false, description: 'Get messages before this timestamp' })
  @ApiQuery({ name: 'after', required: false, description: 'Get messages after this timestamp' })
  @ApiResponse({ status: 200, description: 'Messages retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req,
    @Query() query: MessageQueryDto) {
    return this.chatService.getMessages(id, req.user.userId, query);
  }

  @Put('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message edited successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Cannot edit this message' })
  async editMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() editData: EditMessageDto,
    @Req() req) {
    return this.chatService.editMessage(id, editData, req.user.userId);
  }

  @Delete('messages/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  @ApiResponse({ status: 403, description: 'Cannot delete this message' })
  async deleteMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    await this.chatService.deleteMessage(req.user.userId, id);
    return { message: 'Message deleted successfully' };
  }

  @Post('messages/reactions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add/remove reaction to message' })
  @ApiResponse({ status: 201, description: 'Reaction updated successfully' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async addReaction(
    @Body() data: AddReactionDto,
    @Req() req) {
    await this.chatService.addReaction(req.user.userId, data.messageId, data.emoji);
    return { message: 'Reaction updated successfully' };
  }

  @Post('messages/search')
  @ApiOperation({ summary: 'Search messages in a room' })
  @ApiResponse({ status: 200, description: 'Search results retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  async searchMessages(
    @Body() searchData: MessageSearchDto,
    @Req() req) {
    return this.chatService.searchMessages(
      searchData.roomId,
      searchData,
      req.user.userId
    );
  }

  // Interaction endpoints
  @Post('typing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send typing indicator' })
  @ApiResponse({ status: 200, description: 'Typing indicator sent' })
  async sendTypingIndicator(
    @Body() data: TypingDto,
    @Req() req) {
    await this.chatService.sendTypingIndicator(req.user.userId, data.roomId, data.duration);
    return { message: 'Typing indicator sent' };
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark messages as read' })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markAsRead(
    @Body() data: MarkAsReadDto,
    @Req() req) {
    await this.chatService.markAsRead(req.user.userId, data.roomId, data.messageId);
    return { message: 'Messages marked as read' };
  }

  @Get('unread-counts')
  @ApiOperation({ summary: 'Get unread message counts' })
  @ApiResponse({ status: 200, description: 'Unread counts retrieved successfully' })
  async getUnreadCounts(@Req() req) {
    return this.chatService.getUnreadCounts(req.user.userId);
  }

  // Moderation endpoints
  @Post('rooms/:id/mute')
  @Roles('MODERATOR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mute a user in a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'User muted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async muteUser(
    @Param('id', ParseUUIDPipe) roomId: string,
    @Body() data: MuteUserDto,
    @Req() req) {
    await this.moderationService.muteUser(
      roomId,
      data.userId,
      data.durationHours,
      data.reason,
      req.user.userId
    );
    return { message: 'User muted successfully' };
  }

  @Post('rooms/:id/ban')
  @Roles('MODERATOR', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban a user from a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async banUser(
    @Param('id', ParseUUIDPipe) roomId: string,
    @Body() data: BanUserDto,
    @Req() req) {
    await this.moderationService.banUser(
      roomId,
      data.userId,
      data.durationHours,
      data.reason,
      req.user.userId
    );
    return { message: 'User banned successfully' };
  }

  @Get('rooms/:id/moderation-logs')
  @Roles('MODERATOR', 'ADMIN')
  @ApiOperation({ summary: 'Get moderation logs for a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiResponse({ status: 200, description: 'Moderation logs retrieved successfully' })
  async getModerationLogs(
    @Param('id', ParseUUIDPipe) roomId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20) {
    return this.moderationService.getModerationLogs(roomId, { page, limit });
  }

  // Analytics and export endpoints
  @Get('stats')
  @Roles('ADMIN', 'ANALYST')
  @ApiOperation({ summary: 'Get chat statistics' })
  @ApiQuery({ name: 'roomId', required: false, description: 'Filter by room ID' })
  @ApiQuery({ name: 'timeWindow', required: false, description: 'Time window (e.g., 24h, 7d, 30d)' })
  @ApiResponse({ status: 200, description: 'Chat statistics retrieved successfully' })
  async getChatStats(
    @Query() query: ChatStatsDto,
    @Req() req) {
    return this.chatService.getChatStats(query.roomId, query.timeWindow, req.user.userId);
  }

  @Post('export')
  @Roles('MODERATOR', 'ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Export chat history' })
  @ApiResponse({ status: 202, description: 'Export job started' })
  @ApiResponse({ status: 400, description: 'Invalid export request' })
  async exportChat(
    @Body() exportData: ExportChatDto,
    @Req() req) {
    return this.chatService.exportChatHistory(
      exportData.roomId,
      exportData.format,
      exportData,
      req.user.userId
    );
  }

  @Get('rooms/:id/participants')
  @ApiOperation({ summary: 'Get room participants' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Participants retrieved successfully' })
  async getRoomParticipants(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    return this.chatService.getRoomParticipants(id, req.user.userId);
  }

  @Get('rooms/:id/pinned-messages')
  @ApiOperation({ summary: 'Get pinned messages in a room' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Pinned messages retrieved successfully' })
  async getPinnedMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    return this.chatService.getPinnedMessages(id, req.user.userId);
  }

  @Post('messages/:id/pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pin/unpin a message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message pin status updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async togglePinMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req) {
    await this.chatService.togglePinMessage(id, req.user.userId);
    return { message: 'Message pin status updated' };
  }
}
