import { NextRequest, NextResponse } from 'next/server'

// 간단한 Rate Limiting을 위한 인메모리 스토어
const rateLimit = new Map<string, { count: number; lastReset: number }>()

// 설정
const RATE_LIMIT_WINDOW = 60 * 1000 // 1분 (밀리초)
const MAX_REQUESTS = 100 // 분당 최대 요청 수

export function middleware(request: NextRequest) {
  // API 라우트에만 적용
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // 클라이언트 IP 얻기
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     request.headers.get('cf-connecting-ip') || // Cloudflare
                     '127.0.0.1'
    
    const now = Date.now()
    const key = `rate_limit:${clientIp}`
    
    // 현재 요청 카운트 확인
    const record = rateLimit.get(key)
    
    if (!record || now - record.lastReset > RATE_LIMIT_WINDOW) {
      // 새로운 윈도우 시작
      rateLimit.set(key, { count: 1, lastReset: now })
    } else {
      // 기존 윈도우에서 카운트 증가
      record.count += 1
      
      if (record.count > MAX_REQUESTS) {
        // Rate limit 초과
        console.log(`Rate limit exceeded for IP: ${clientIp}`)
        return new NextResponse(
          JSON.stringify({ 
            error: 'Too Many Requests',
            message: `분당 최대 ${MAX_REQUESTS}회 요청 가능합니다.`,
            retryAfter: Math.ceil((RATE_LIMIT_WINDOW - (now - record.lastReset)) / 1000)
          }),
          { 
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': Math.ceil((RATE_LIMIT_WINDOW - (now - record.lastReset)) / 1000).toString(),
              'X-RateLimit-Limit': MAX_REQUESTS.toString(),
              'X-RateLimit-Remaining': Math.max(0, MAX_REQUESTS - record.count).toString(),
              'X-RateLimit-Reset': Math.ceil((record.lastReset + RATE_LIMIT_WINDOW) / 1000).toString()
            }
          }
        )
      }
    }
    
    // 요청 허용 - 헤더 추가
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', MAX_REQUESTS.toString())
    response.headers.set('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - (record?.count || 1)).toString())
    
    return response
  }
  
  // 보안 헤더 추가
  const response = NextResponse.next()
  
  // HSTS
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  
  // XSS Protection
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // CSP (기본값)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  )
  
  return response
}

export const config = {
  matcher: [
    /*
     * API 라우트와 일반 페이지에 적용
     * 단, _next/static, _next/image, favicon.ico 제외
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
} 