import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  endpoint: process.env.AWS_S3_ENDPOINT || process.env.S3_ENDPOINT,
  accessKeyId: process.env.AWS_S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  bucket: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET,
  region: process.env.AWS_S3_REGION || process.env.S3_REGION || 'us-east-1',
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === undefined ? true : process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
}));