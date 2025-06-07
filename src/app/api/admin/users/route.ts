import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 서버 사이드에서 서비스 키를 사용한 Supabase 클라이언트 생성
const getServiceSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    // 현재 사용자 확인 (클라이언트 키 사용)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }
    
    // 사용자의 토큰으로 권한 확인
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    // 관리자 권한 확인
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // 서비스 키로 모든 사용자 조회
    const serviceSupabase = getServiceSupabase()
    
    // auth.users 테이블의 모든 사용자 조회
    const { data: authUsers, error: authError } = await serviceSupabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('Auth users 조회 오류:', authError)
      return NextResponse.json({ error: 'Failed to fetch auth users' }, { status: 500 })
    }
    
    // profiles 테이블의 모든 프로필 조회
    const { data: profiles, error: profilesError } = await serviceSupabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (profilesError) {
      console.error('Profiles 조회 오류:', profilesError)
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 })
    }
    
    // 응답 데이터 구성
    const authUsersData = authUsers.users.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      user_metadata: user.user_metadata
    }))
    
    return NextResponse.json({
      authUsers: authUsersData,
      profiles: profiles || [],
      summary: {
        totalAuthUsers: authUsers.users.length,
        totalProfiles: profiles?.length || 0,
        missingProfiles: authUsers.users.filter(
          authUser => !profiles?.some(profile => profile.id === authUser.id)
        ).length
      }
    })
    
  } catch (error) {
    console.error('Admin users API 오류:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 