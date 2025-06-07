import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      console.error('OAuth 코드가 없습니다.')
      return NextResponse.redirect(new URL('/login?error=no_code', request.url))
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // OAuth 토큰 교환
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('OAuth 토큰 교환 오류:', error)
      return NextResponse.redirect(new URL('/login?error=token_exchange', request.url))
    }

    if (!data.session || !data.session.user) {
      console.error('세션 또는 사용자 정보가 없습니다.')
      return NextResponse.redirect(new URL('/login?error=no_session', request.url))
    }

    const user = data.session.user
    console.log('OAuth 로그인 성공:', user.id, user.email)

    // 프로필 확인
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('프로필 조회 오류:', profileError)
        throw profileError
      }

      if (!profile) {
        // 신규 사용자 - 동의 페이지로
        console.log('신규 사용자 - 동의 페이지로 리다이렉트')
        return NextResponse.redirect(new URL('/auth/consent', request.url))
      } else {
        // 기존 사용자 - 분석 페이지로
        console.log('기존 사용자 - 분석 페이지로 리다이렉트')
        return NextResponse.redirect(new URL('/analysis', request.url))
      }
    } catch (error) {
      // 프로필 조회 실패 시 신규 사용자로 간주
      console.log('프로필 조회 실패 - 신규 사용자로 처리:', error)
      return NextResponse.redirect(new URL('/auth/consent', request.url))
    }

  } catch (error) {
    console.error('OAuth 콜백 처리 중 오류:', error)
    return NextResponse.redirect(new URL('/login?error=callback_error', request.url))
  }
} 