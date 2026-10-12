import { NextResponse } from 'next/server';
import { clearAccessTokenCookie } from '../../../lib/server-auth';

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL('/', request.url), 303);
  clearAccessTokenCookie(response);
  return response;
}
