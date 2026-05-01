import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class QrTokenService {
  private readonly childPrefix = 'QRC-CH';
  private readonly certificatePrefix = 'QRC-CERT';
  private readonly alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  generateChildToken(): string {
    return `${this.childPrefix}-${this.randomTokenBody(18)}`;
  }

  generateCertificateToken(): string {
    return `${this.certificatePrefix}-${this.randomTokenBody(18)}`;
  }

  isChildToken(value?: string | null): boolean {
    if (!value) return false;
    return /^QRC-CH-[A-Z0-9-]{10,64}$/i.test(value.trim());
  }

  isCertificateToken(value?: string | null): boolean {
    if (!value) return false;
    return /^QRC-CERT-[A-Z0-9-]{10,64}$/i.test(value.trim());
  }

  isKnownToken(value?: string | null): boolean {
    return this.isChildToken(value) || this.isCertificateToken(value);
  }

  private randomTokenBody(byteLength: number): string {
    const bytes = randomBytes(byteLength);
    let output = '';

    for (let i = 0; i < bytes.length; i += 1) {
      output += this.alphabet[bytes[i] % this.alphabet.length];
    }

    return output;
  }
}