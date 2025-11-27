import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../../auth/services/auth.service';

@Injectable()
export class WsJwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token = this.extractTokenFromSocket(client);

    if (!token) {
      throw new WsException('Unauthorized: No token provided');
    }

    try {
      const payload = this.jwtService.verify(token);
      const user = await this.authService.getUserById(payload.sub);

      if (!user || !user.isActive) {
        throw new WsException('Unauthorized: Invalid user');
      }

      // Attach user to socket for later use
      client.data.user = user;
      client.data.userId = user.id;

      return true;
    } catch (error) {
      throw new WsException('Unauthorized: Invalid token');
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    // Try query parameters first
    const token = client.handshake.query.token as string;
    if (token) return token;

    // Try authorization header
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try socket handshake auth
    if (client.handshake.auth && client.handshake.auth.token) {
      return client.handshake.auth.token;
    }

    return null;
  }
}