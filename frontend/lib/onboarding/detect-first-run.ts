import type { UserResource } from '@clerk/shared/types';

export function isFirstTimeUser(user: UserResource): boolean {
  const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;
  const lastSignInAt = user.lastSignInAt ? new Date(user.lastSignInAt).getTime() : 0;
  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;

  // User created within last 5 minutes and either never signed in or last sign-in is very recent
  const isRecentlyCreated = now - createdAt < FIVE_MINUTES;
  const isFirstSignIn = !lastSignInAt || Math.abs(lastSignInAt - createdAt) < FIVE_MINUTES;

  return isRecentlyCreated && isFirstSignIn;
}
