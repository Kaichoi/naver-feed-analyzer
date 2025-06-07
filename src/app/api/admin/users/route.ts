import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 서버 사이드에서 서비스 키를 사용한 Supabase 클라이언트 생성
const getServiceSupabase = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  console.log('=== 환경변수 상태 ===', {
    supabaseUrl: supabaseUrl ? 'EXISTS' : 'MISSING',
    serviceKey: supabaseServiceKey ? 'EXISTS' : 'MISSING',
    nodeEnv: process.env.NODE_ENV
  })
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(`환경변수 누락: URL=${!!supabaseUrl}, ServiceKey=${!!supabaseServiceKey}`)
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
    console.log('=== Admin Users API 시작 ===')
    console.log('요청 URL:', request.url)
    console.log('요청 시간:', new Date().toISOString())
    
    // 환경변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    console.log('환경변수 상세 확인:', {
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
      serviceKeyExists: !!supabaseServiceKey,
      serviceKeyLength: supabaseServiceKey?.length || 0,
      anonKeyExists: !!anonKey,
      anonKeyLength: anonKey?.length || 0
    })
    
    // 필수 환경변수 확인
    if (!supabaseUrl) {
      console.error('❌ NEXT_PUBLIC_SUPABASE_URL 누락')
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'NEXT_PUBLIC_SUPABASE_URL is missing'
      }, { status: 500 })
    }
    
    if (!anonKey) {
      console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 누락')
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing'
      }, { status: 500 })
    }
    
    if (!supabaseServiceKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY 누락')
      return NextResponse.json({ 
        error: 'Configuration error',
        details: 'SUPABASE_SERVICE_ROLE_KEY is missing - 이 환경변수를 Vercel에 추가해야 합니다'
      }, { status: 500 })
    }
    
    // Authorization header 확인
    const authHeader = request.headers.get('authorization')
    console.log('Authorization header:', authHeader ? 'EXISTS' : 'MISSING')
    
    if (!authHeader) {
      console.error('❌ Authorization header 누락')
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 })
    }
    
    // 사용자의 토큰으로 권한 확인
    console.log('클라이언트 Supabase 인스턴스 생성 중...')
    const supabaseClient = createClient(supabaseUrl, anonKey)
    
    const token = authHeader.replace('Bearer ', '')
    console.log('토큰 길이:', token.length, '토큰 시작:', token.substring(0, 20) + '...')
    
    console.log('사용자 인증 확인 중...')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    console.log('사용자 조회 결과:', {
      userExists: !!user,
      userId: user?.id,
      userEmail: user?.email,
      error: userError?.message
    })
    
    if (userError) {
      console.error('❌ 사용자 인증 실패:', userError)
      return NextResponse.json({ 
        error: 'Invalid token',
        details: userError.message
      }, { status: 401 })
    }
    
    if (!user) {
      console.error('❌ 사용자 정보 없음')
      return NextResponse.json({ 
        error: 'Invalid token',
        details: 'No user found'
      }, { status: 401 })
    }
    
    // 관리자 권한 확인
    console.log('관리자 권한 확인 중...', user.id)
    try {
      // SERVICE KEY를 사용하여 프로필 조회 (RLS 우회)
      const serviceSupabase = getServiceSupabase()
      
      const { data: profile, error: profileError } = await serviceSupabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()
      
      console.log('프로필 조회 결과:', {
        profileExists: !!profile,
        isAdmin: profile?.is_admin,
        error: profileError?.message
      })
      
      if (profileError) {
        console.error('❌ 프로필 조회 실패:', profileError)
        return NextResponse.json({ 
          error: 'Profile lookup failed',
          details: `Failed to fetch user profile: ${profileError.message}`,
          userId: user.id,
          userEmail: user.email
        }, { status: 500 })
      }
      
      if (!profile) {
        console.error('❌ 프로필 없음:', user.id)
        return NextResponse.json({ 
          error: 'Profile not found',
          details: `User profile not found in database: ${user.email}`,
          userId: user.id
        }, { status: 404 })
      }
      
      if (!profile.is_admin) {
        console.error('❌ 관리자 아님:', user.email, profile.is_admin)
        return NextResponse.json({ 
          error: 'Admin access required',
          details: `User ${user.email} is not an admin (is_admin: ${profile.is_admin})`
        }, { status: 403 })
      }
      
      console.log('✅ 관리자 권한 확인됨:', user.email)
      
    } catch (profileCheckError) {
      console.error('❌ 프로필 확인 중 예외 발생:', profileCheckError)
      return NextResponse.json({ 
        error: 'Profile check failed',
        details: profileCheckError instanceof Error ? profileCheckError.message : 'Unknown error during profile check'
      }, { status: 500 })
    }
    
    // 서비스 키로 모든 사용자 조회
    console.log('서비스 키로 데이터 조회 시작...')
    
    try {
      const serviceSupabase = getServiceSupabase()
      console.log('✅ 서비스 Supabase 클라이언트 생성 성공')
      
      // auth.users 테이블의 모든 사용자 조회
      console.log('auth.users 조회 중...')
      const { data: authUsers, error: authError } = await serviceSupabase.auth.admin.listUsers()
      
      console.log('Auth users 조회 결과:', {
        success: !authError,
        userCount: authUsers?.users?.length || 0,
        error: authError?.message
      })
      
      if (authError) {
        console.error('❌ Auth users 조회 오류:', authError)
        return NextResponse.json({ 
          error: 'Failed to fetch auth users',
          details: authError.message
        }, { status: 500 })
      }
      
      // profiles 테이블의 모든 프로필 조회
      console.log('profiles 테이블 조회 중...')
      const { data: profiles, error: profilesError } = await serviceSupabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      console.log('Profiles 조회 결과:', {
        success: !profilesError,
        profileCount: profiles?.length || 0,
        error: profilesError?.message
      })
      
      if (profilesError) {
        console.error('❌ Profiles 조회 오류:', profilesError)
        return NextResponse.json({ 
          error: 'Failed to fetch profiles',
          details: profilesError.message
        }, { status: 500 })
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
      
      const result = {
        authUsers: authUsersData,
        profiles: profiles || [],
        summary: {
          totalAuthUsers: authUsers.users.length,
          totalProfiles: profiles?.length || 0,
          missingProfiles: authUsers.users.filter(
            authUser => !profiles?.some(profile => profile.id === authUser.id)
          ).length
        }
      }
      
      console.log('=== API 성공 완료 ===', {
        authUsers: result.summary.totalAuthUsers,
        profiles: result.summary.totalProfiles,
        missing: result.summary.missingProfiles
      })
      
      return NextResponse.json(result)
      
    } catch (serviceError) {
      console.error('❌ 서비스 키 사용 중 오류:', serviceError)
      return NextResponse.json({ 
        error: 'Service key operation failed',
        details: serviceError instanceof Error ? serviceError.message : 'Unknown service error'
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('=== Admin users API 전체 오류 ===', error)
    console.error('오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
} 