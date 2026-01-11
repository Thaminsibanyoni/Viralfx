import { createHash, createCipher, createDecipher, randomBytes } from "crypto";

export class CryptoUtils {
  static generateRandomString(length: number): string {
    return randomBytes(length).toString('hex');
  }

  static generateApiKey(): string {
    return randomBytes(32).toString('hex');
  }

  static hash(data: string, salt?: string): string {
    return createHash('sha256')
      .update(data + (salt || ''))
      .digest('hex');
  }

  static generateSecureToken(): string {
    return randomBytes(32).toString('base64');
  }

  static encrypt(text: string, key: string): string {
    const iv = randomBytes(16);
    const cipher = createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  static decrypt(encryptedText: string, key: string): string {
    const decipher = createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
