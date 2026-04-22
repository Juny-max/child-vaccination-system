import { NextResponse } from 'next/server'
import { generateVerificationToken } from '@/lib/verify-token'

/**
 * POST /api/verify/token
 * Generate a verification token for the /verify page
 * Token is valid for 5 minutes and can only be used once
 */
export async function POST() {
  const { token, expiresIn } = generateVerificationToken()
  return NextResponse.json({ token, expiresIn })
}
