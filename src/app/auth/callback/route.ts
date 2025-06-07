import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      console.error('OAuth 코드가 없습니다.')
      return NextResponse.redirect(new URL('/login?error=no_code', origin))
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // OAuth 코드를 세션으로 교환
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('OAuth 토큰 교환 오류:', error)
      return NextResponse.redirect(new URL('/login?error=token_exchange', origin))
    }

    if (!data.session || !data.session.user) {
      console.error('세션 또는 사용자 정보가 없습니다.')
      return NextResponse.redirect(new URL('/login?error=no_session', origin))
    }

    const user = data.session.user
    console.log('OAuth 로그인 성공:', user.id, user.email)

    // 프로필 확인
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      // 프로필이 없으면 신규 사용자
      if (profileError && profileError.code === 'PGRST116') {
        console.log('신규 사용자 - 동의 페이지로 리다이렉트')
        return NextResponse.redirect(new URL('/auth/consent', origin))
      }

      if (profileError) {
        console.error('프로필 조회 오류:', profileError)
        return NextResponse.redirect(new URL('/auth/consent', origin))
      }

      // 기존 사용자
      console.log('기존 사용자 - 분석 페이지로 리다이렉트')
      return NextResponse.redirect(new URL('/analysis', origin))

    } catch (error) {
      console.log('프로필 조회 실패 - 신규 사용자로 처리:', error)
      return NextResponse.redirect(new URL('/auth/consent', origin))
    }

  } catch (error) {
    console.error('OAuth 콜백 처리 중 오류:', error)
    return NextResponse.redirect(new URL('/login?error=callback_error', request.url))
  }
} 