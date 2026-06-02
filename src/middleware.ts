import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = ['/', '/login', '/register', '/onboarding', '/api'].some(p => pathname === p || pathname.startsWith(p + '/') || (p === '/' && pathname === '/'));

  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  if (!projectId) {
    if (!isPublic) return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('a_session_' + projectId);
  if (!sessionCookie && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
