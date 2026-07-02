import { ConfigService } from '@nestjs/config';

const BLOCKED_JWT_SECRETS = new Set([
  'super-secret-key',
  'your-super-secret-jwt-key-change-in-production',
  'child-vaccination-system-jwt-secret-key-2025',
]);

export function getRequiredJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET')?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET is required. Set a strong random secret before starting the backend.');
  }

  if (secret.length < 32 || BLOCKED_JWT_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET is too weak. Use a unique random secret with at least 32 characters.');
  }

  return secret;
}
