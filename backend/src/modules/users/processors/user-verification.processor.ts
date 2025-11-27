import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { NotificationsService } from '../../notifications/services/notification.service';

interface VerificationJob {
  userId: string;
  type: 'email' | 'phone' | 'identity';
  data: any;
}

@Processor('user-verification')
export class UserVerificationProcessor {
  private readonly logger = new Logger(UserVerificationProcessor.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Process('email-verification')
  async handleEmailVerification(job: Job<VerificationJob>) {
    const { userId, data } = job.data;

    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.isVerified) {
        this.logger.log(`User ${userId} is already verified`);
        return { success: true, message: 'User already verified' };
      }

      // Generate verification token
      const verificationToken = this.generateVerificationToken();

      // Send verification email
      await this.notificationsService.sendNotification({
        userId,
        type: 'EMAIL_VERIFICATION',
        title: 'Verify Your Email Address',
        message: `Please click the link below to verify your email address: ${data.verificationUrl}?token=${verificationToken}`,
        data: {
          verificationToken,
          verificationUrl: data.verificationUrl,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Store verification token (in Redis with expiry)
      // await this.redis.setex(`email_verification:${userId}`, 24 * 60 * 60, verificationToken);

      this.logger.log(`Email verification sent to user ${userId}`);

      return {
        success: true,
        message: 'Email verification sent successfully',
        verificationToken,
      };
    } catch (error) {
      this.logger.error(`Failed to send email verification to user ${userId}:`, error);
      throw error;
    }
  }

  @Process('phone-verification')
  async handlePhoneVerification(job: Job<VerificationJob>) {
    const { userId, data } = job.data;

    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.phoneNumber) {
        throw new Error('User phone number not found');
      }

      // Generate 6-digit verification code
      const verificationCode = this.generateVerificationCode();

      // Send SMS verification
      await this.notificationsService.sendNotification({
        userId,
        type: 'SMS_VERIFICATION',
        title: 'Phone Verification',
        message: `Your ViralFX verification code is: ${verificationCode}. This code will expire in 10 minutes.`,
        data: {
          verificationCode,
          phoneNumber: user.phoneNumber,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      // Store verification code (in Redis with expiry)
      // await this.redis.setex(`phone_verification:${userId}`, 10 * 60, verificationCode);

      this.logger.log(`Phone verification sent to user ${userId}`);

      return {
        success: true,
        message: 'Phone verification sent successfully',
        verificationCode: verificationCode.substring(0, 3) + '***', // Partial code for logging
      };
    } catch (error) {
      this.logger.error(`Failed to send phone verification to user ${userId}:`, error);
      throw error;
    }
  }

  @Process('identity-verification')
  async handleIdentityVerification(job: Job<VerificationJob>) {
    const { userId, data } = job.data;

    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Perform identity verification checks
      const verificationResult = await this.performIdentityVerification(user, data);

      // Update user verification status
      if (verificationResult.success) {
        user.isVerified = true;
        user.verifiedAt = new Date();
        user.verificationMethod = 'IDENTITY_DOCUMENT';
        await this.usersService.updateProfile(userId, user);

        // Send success notification
        await this.notificationsService.sendNotification({
          userId,
          type: 'IDENTITY_VERIFIED',
          title: 'Identity Verification Successful',
          message: 'Your identity has been successfully verified. You now have access to all platform features.',
          data: {
            verifiedAt: new Date(),
            verificationMethod: 'IDENTITY_DOCUMENT',
          },
        });
      } else {
        // Send failure notification
        await this.notificationsService.sendNotification({
          userId,
          type: 'IDENTITY_VERIFICATION_FAILED',
          title: 'Identity Verification Failed',
          message: `We couldn't verify your identity. Reason: ${verificationResult.reason}. Please try again or contact support.`,
          data: {
            reason: verificationResult.reason,
            retryAllowed: verificationResult.retryAllowed,
          },
        });
      }

      this.logger.log(`Identity verification for user ${userId}: ${verificationResult.success ? 'SUCCESS' : 'FAILED'}`);

      return verificationResult;
    } catch (error) {
      this.logger.error(`Failed to process identity verification for user ${userId}:`, error);
      throw error;
    }
  }

  @Process('verify-email-token')
  async handleVerifyEmailToken(job: Job<{ userId: string; token: string }>) {
    const { userId, token } = job.data;

    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify token from Redis
      // const storedToken = await this.redis.get(`email_verification:${userId}`);

      // For demo purposes, simulate token verification
      const isValid = this.verifyEmailToken(token);

      if (isValid) {
        // Mark user as verified
        user.isVerified = true;
        user.verifiedAt = new Date();
        user.verificationMethod = 'EMAIL';
        await this.usersService.updateProfile(userId, user);

        // Clear token from Redis
        // await this.redis.del(`email_verification:${userId}`);

        // Send success notification
        await this.notificationsService.sendNotification({
          userId,
          type: 'EMAIL_VERIFIED',
          title: 'Email Verified Successfully',
          message: 'Your email address has been verified. Thank you for confirming your account.',
          data: {
            verifiedAt: new Date(),
            verificationMethod: 'EMAIL',
          },
        });

        this.logger.log(`Email verified successfully for user ${userId}`);

        return {
          success: true,
          message: 'Email verified successfully',
        };
      } else {
        throw new Error('Invalid or expired verification token');
      }
    } catch (error) {
      this.logger.error(`Failed to verify email token for user ${userId}:`, error);
      throw error;
    }
  }

  @Process('verify-phone-code')
  async handleVerifyPhoneCode(job: Job<{ userId: string; code: string }>) {
    const { userId, code } = job.data;

    try {
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify code from Redis
      // const storedCode = await this.redis.get(`phone_verification:${userId}`);

      // For demo purposes, simulate code verification (e.g., accept 123456)
      const isValid = code === '123456' || this.verifyPhoneCode(code);

      if (isValid) {
        // Update user phone verification status
        await this.usersService.updateProfile(userId, {
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
        });

        // Clear code from Redis
        // await this.redis.del(`phone_verification:${userId}`);

        // Send success notification
        await this.notificationsService.sendNotification({
          userId,
          type: 'PHONE_VERIFIED',
          title: 'Phone Number Verified',
          message: 'Your phone number has been successfully verified.',
          data: {
            verifiedAt: new Date(),
          },
        });

        this.logger.log(`Phone verified successfully for user ${userId}`);

        return {
          success: true,
          message: 'Phone number verified successfully',
        };
      } else {
        throw new Error('Invalid or expired verification code');
      }
    } catch (error) {
      this.logger.error(`Failed to verify phone code for user ${userId}:`, error);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing verification job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Completed verification job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Failed verification job ${job.id} of type ${job.name}:`, error);
  }

  private generateVerificationToken(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private verifyEmailToken(token: string): boolean {
    // In production, verify against stored token in Redis
    // For demo, accept any 64-character hex string
    return /^[a-f0-9]{64}$/i.test(token);
  }

  private verifyPhoneCode(code: string): boolean {
    // In production, verify against stored code in Redis
    return /^\d{6}$/.test(code);
  }

  private async performIdentityVerification(user: any, data: any): Promise<{
    success: boolean;
    reason?: string;
    retryAllowed?: boolean;
  }> {
    // This would integrate with FSCA-compliant identity verification service
    // For demo purposes, simulate verification process

    try {
      // Simulate API call to verification service
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate random verification result (90% success rate)
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        return {
          success: true,
          reason: 'Identity verified successfully',
        };
      } else {
        return {
          success: false,
          reason: 'Document could not be verified. Please ensure the document is clear and valid.',
          retryAllowed: true,
        };
      }
    } catch (error) {
      return {
        success: false,
        reason: 'Verification service temporarily unavailable. Please try again later.',
        retryAllowed: true,
      };
    }
  }
}