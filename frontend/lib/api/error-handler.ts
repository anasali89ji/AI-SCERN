import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class AuthError extends Error {}
export class RateLimitError extends Error {}

export function handleApiError(error: unknown, context?: Record<string, unknown>): NextResponse {
  console.error({ error, context }, 'API error occurred');

  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: error.issues },
      { status: 400 }
    );
  }

  if (error instanceof AuthError) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }

  return NextResponse.json(
    { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
