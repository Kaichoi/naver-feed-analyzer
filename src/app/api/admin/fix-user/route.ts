import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { email, action } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: '이메일이 필요합니다.' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    if (action === 'diagnose') {
      // 현재 상태 진단
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const authUser = authUsers.users.find(u => u.email === email)
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
      
      return NextResponse.json({
        success: true,
        diagnosis: {
          authUser: authUser ? {
            id: authUser.id,
            email: authUser.email,
            emailConfirmed: !!authUser.email_confirmed_at,
            createdAt: authUser.created_at
          } : null,
          profiles: profiles || [],
          issue: authUser && profiles && profiles.length > 0 && 
                 profiles.every(p => p.id !== authUser.id) ? 
                 'ID_MISMATCH' : 'NONE'
        }
      })
    }

    if (action === 'fix') {
      // 문제 해결
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const authUser = authUsers.users.find(u => u.email === email)
      
      if (!authUser) {
        return NextResponse.json({ error: '해당 이메일의 사용자를 찾을 수 없습니다.' }, { status: 404 })
      }

      // 1. 해당 이메일의 모든 기존 프로필 삭제
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('email', email)
      
      if (deleteError) {
        console.error('프로필 삭제 오류:', deleteError)
      }

      // 2. 새 프로필 생성 (auth 사용자 ID와 일치)
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
          avatar_url: authUser.user_metadata?.avatar_url || null,
          is_admin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_analysis_at: null,
          total_analysis_count: 0
        })

      if (insertError) {
        console.error('프로필 생성 오류:', insertError)
        return NextResponse.json({ error: '프로필 생성 실패: ' + insertError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: '사용자 동기화가 완료되었습니다.',
        userId: authUser.id
      })
    }

    if (action === 'cleanup') {
      // 완전 정리 (모든 관련 데이터 삭제)
      
      // 1. Auth 사용자 삭제
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const authUser = authUsers.users.find(u => u.email === email)
      
      if (authUser) {
        await supabase.auth.admin.deleteUser(authUser.id)
      }

      // 2. 프로필 삭제
      await supabase
        .from('profiles')
        .delete()
        .eq('email', email)

      return NextResponse.json({
        success: true,
        message: '모든 관련 데이터가 삭제되었습니다. 새로 회원가입해주세요.'
      })
    }

    return NextResponse.json({ error: '잘못된 액션입니다.' }, { status: 400 })

  } catch (error) {
    console.error('사용자 수정 오류:', error)
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.', 
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
} 