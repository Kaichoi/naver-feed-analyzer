import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NODE_ENV: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
      serviceKeyStart: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) || 'MISSING'
    }
    
    console.log('환경변수 테스트:', envCheck)
    
    return NextResponse.json({
      status: 'success',
      envCheck,
      message: '환경변수 상태 확인 완료'
    })
  } catch (error) {
    console.error('환경변수 테스트 오류:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 