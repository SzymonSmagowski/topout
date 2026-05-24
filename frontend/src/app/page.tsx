import { isAuthenticatedNextjs } from '@convex-dev/auth/nextjs/server';
import { redirect } from 'next/navigation';

export default async function HomePage(): Promise<never> {
  const authed = await isAuthenticatedNextjs();
  redirect(authed ? '/dashboard' : '/sign-in');
}
