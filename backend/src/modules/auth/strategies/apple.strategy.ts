import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-apple";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, "apple") {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('APPLE_CLIENT_ID'),
      teamID: configService.get<string>('APPLE_TEAM_ID'),
      keyID: configService.get<string>('APPLE_KEY_ID'),
      keyFilePath: configService.get<string>('APPLE_KEY_PATH'),
      callbackURL: configService.get<string>('APPLE_CALLBACK_URL'),
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback): Promise<any> {
    const { name, email } = profile;
    const user = {
      email: email,
      firstName: name?.firstName,
      lastName: name?.lastName,
      accessToken,
    };
    done(null, user);
  }
}