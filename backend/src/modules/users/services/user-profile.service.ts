import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { FilesService } from '../files/files.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WebSocketGateway } from '@nestjs/websockets';

interface ProfileCompletion {
  percentage: number;
  missing: string[];
}

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly filesService: FilesService,
    @InjectQueue('user-profile-update')
    private readonly profileUpdateQueue: Queue,
  ) {}

  async updateAvatar(userId: string, file: Express.Multer.File): Promise<{ avatarUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Upload avatar to MinIO
    const uploadedFile = await this.filesService.uploadFile(file, userId, 'avatar');

    // Update user avatar URL
    user.avatarUrl = uploadedFile.url;
    await this.userRepository.save(user);

    // Queue profile verification job
    await this.profileUpdateQueue.add('verify-avatar', {
      userId,
      avatarUrl: uploadedFile.url,
    });

    // Emit WebSocket event for real-time update
    // This would be handled by WebSocketGateway

    return { avatarUrl: uploadedFile.url };
  }

  async updatePersonalInfo(userId: string, personalInfo: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    dateOfBirth?: Date;
    country?: string;
    bio?: string;
  }): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate date of birth (must be at least 18 years old)
    if (personalInfo.dateOfBirth) {
      const age = this.calculateAge(personalInfo.dateOfBirth);
      if (age < 18) {
        throw new BadRequestException('User must be at least 18 years old');
      }
    }

    // Update personal information
    Object.assign(user, personalInfo);
    user.profileUpdatedAt = new Date();

    const updatedUser = await this.userRepository.save(user);

    // Queue profile verification for sensitive changes
    if (personalInfo.phoneNumber || personalInfo.dateOfBirth) {
      await this.profileUpdateQueue.add('verify-personal-info', {
        userId,
        updatedFields: Object.keys(personalInfo),
      });
    }

    return updatedUser;
  }

  async calculateProfileCompletion(userId: string): Promise<ProfileCompletion> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const requiredFields = [
      { field: 'firstName', value: user.firstName, name: 'First Name' },
      { field: 'lastName', value: user.lastName, name: 'Last Name' },
      { field: 'email', value: user.email, name: 'Email Address' },
      { field: 'phoneNumber', value: user.phoneNumber, name: 'Phone Number' },
      { field: 'dateOfBirth', value: user.dateOfBirth, name: 'Date of Birth' },
      { field: 'country', value: user.country, name: 'Country' },
      { field: 'avatarUrl', value: user.avatarUrl, name: 'Profile Picture' },
      { field: 'bio', value: user.bio, name: 'Bio' },
      { field: 'isVerified', value: user.isVerified, name: 'Email Verification' },
      { field: 'kycStatus', value: user.kycStatus === 'APPROVED', name: 'KYC Verification' },
    ];

    const completedFields = requiredFields.filter(field => !!field.value);
    const missingFields = requiredFields.filter(field => !field.value).map(field => field.name);
    const percentage = Math.round((completedFields.length / requiredFields.length) * 100);

    return {
      percentage,
      missing: missingFields,
    };
  }

  async getProfileCompletionSuggestions(userId: string): Promise<string[]> {
    const completion = await this.calculateProfileCompletion(userId);
    const suggestions: string[] = [];

    if (completion.missing.includes('First Name') || completion.missing.includes('Last Name')) {
      suggestions.push('Add your name to personalize your profile');
    }

    if (completion.missing.includes('Phone Number')) {
      suggestions.push('Add your phone number for account security');
    }

    if (completion.missing.includes('Date of Birth')) {
      suggestions.push('Add your date of birth to complete verification');
    }

    if (completion.missing.includes('Country')) {
      suggestions.push('Set your country for localized features');
    }

    if (completion.missing.includes('Profile Picture')) {
      suggestions.push('Upload a profile picture to build trust');
    }

    if (completion.missing.includes('Bio')) {
      suggestions.push('Write a bio to tell others about yourself');
    }

    if (completion.missing.includes('Email Verification')) {
      suggestions.push('Verify your email address to secure your account');
    }

    if (completion.missing.includes('KYC Verification')) {
      suggestions.push('Complete KYC verification to unlock all features');
    }

    return suggestions;
  }

  async getPublicProfile(userId: string): Promise<{
    id: string;
    username: string;
    avatarUrl?: string;
    bio?: string;
    joinDate: Date;
    isVerified: boolean;
    stats: {
      totalBets: number;
      totalMarkets: number;
      winRate?: number;
    };
  }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get public stats
    // This would typically use aggregated data from Prisma
    const stats = {
      totalBets: 0, // Would be calculated from Bet table
      totalMarkets: 0, // Would be calculated from Market table
      winRate: undefined, // Would be calculated from bet history
    };

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      joinDate: user.createdAt,
      isVerified: user.isVerified,
      stats,
    };
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();

    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }
}