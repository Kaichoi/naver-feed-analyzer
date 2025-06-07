import { createClient } from '@supabase/supabase-js'

// 환경변수를 정리하는 함수 (모든 공백과 줄바꿈 제거)
const cleanEnvVar = (value: string | undefined): string => {
  if (!value) return ''
  // 모든 종류의 공백과 줄바꿈 문자 제거
  return value.replace(/[\s\r\n\t]+/g, '').trim()
}

// 원본 환경변수 값 확인
console.log('원본 환경변수:', {
  rawUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  rawKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  rawUrlType: typeof process.env.NEXT_PUBLIC_SUPABASE_URL,
  rawKeyType: typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
})

const supabaseUrl = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL) || ''
const supabaseAnonKey = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || ''

// 디버깅을 위한 환경변수 확인
console.log('정리된 환경변수 확인:', {
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
  key: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : 'MISSING',
  urlLength: supabaseUrl.length,
  keyLength: supabaseAnonKey.length,
  urlValid: supabaseUrl.startsWith('https://'),
  keyValid: supabaseAnonKey.startsWith('eyJ')
})

// 브라우저에서 직접 확인할 수 있도록 전역 변수에 저장
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).debugSupabase = {
    url: supabaseUrl,
    key: supabaseAnonKey,
    urlLength: supabaseUrl.length,
    keyLength: supabaseAnonKey.length,
    fullKey: supabaseAnonKey  // 전체 키 확인용
  }
  console.log('🔍 브라우저 콘솔에서 window.debugSupabase를 입력해서 전체 값을 확인하세요')
}

// Supabase 클라이언트 생성 함수
function createSupabaseClient() {
  console.log('createSupabaseClient 호출됨')
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase 환경변수가 설정되지 않았습니다:', {
      urlExists: !!supabaseUrl,
      keyExists: !!supabaseAnonKey,
      urlLength: supabaseUrl.length,
      keyLength: supabaseAnonKey.length
    })
    return null
  }
  
  if (!supabaseUrl.startsWith('https://')) {
    console.error('❌ Supabase URL이 유효하지 않습니다:', supabaseUrl)
    return null
  }
  
  if (!supabaseAnonKey.startsWith('eyJ')) {
    console.error('❌ Supabase ANON KEY가 유효하지 않습니다:', supabaseAnonKey.substring(0, 20))
    return null
  }
  
  try {
    const client = createClient(supabaseUrl, supabaseAnonKey)
    console.log('✅ Supabase 클라이언트 생성 성공')
    return client
  } catch (error) {
    console.error('❌ Supabase 클라이언트 생성 실패:', error)
    return null
  }
}

// Supabase 클라이언트 인스턴스
export const supabase = createSupabaseClient()

console.log('최종 supabase 클라이언트:', supabase ? '✅ 생성됨' : '❌ null')

// 데이터베이스 타입 정의
export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
  last_analysis_at: string | null
  total_analysis_count: number
  marketing_consent: boolean
}

export interface CrawlJob {
  id: string
  user_id: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  total_items: number
  created_at: string
  completed_at: string | null
  error_message: string | null
}

export interface CrawlItem {
  id: string
  job_id: string
  title: string
  url: string
  service: string
  created_at: string
}

// 인증 헬퍼 함수들
export const auth = {
  // 현재 사용자 가져오기 (개선된 세션 관리)
  async getCurrentUser() {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    
    try {
      // 먼저 현재 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.warn('세션 확인 오류:', sessionError.message)
        return null
      }

      if (!session) {
        return null
      }

      // 세션이 있으면 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        // 토큰 관련 오류 시 세션 정리
        if (userError.message.includes('Invalid Refresh Token') || 
            userError.message.includes('Refresh Token Not Found') ||
            userError.message.includes('JWT expired')) {
          console.warn('토큰 만료 또는 오류로 인한 자동 로그아웃:', userError.message)
          await supabase.auth.signOut()
          return null
        }
        throw userError
      }
      
      return user
    } catch (error) {
      console.error('사용자 정보 조회 오류:', error)
      return null
    }
  },

  // 회원가입
  async signUp(email: string, password: string, fullName?: string) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    })
    
    if (error) throw error
    return data
  },

  // 로그인
  async signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) throw error
    return data
  },

  // 로그아웃
  async signOut() {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // 구글 로그인
  async signInWithGoogle() {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    
    console.log('🔵 Google OAuth 시작:', {
      currentUrl: window.location.href,
      redirectTo: `${window.location.origin}/auth/callback`
    })
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: false,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    })
    
    console.log('🔵 Google OAuth 응답:', { data, error })
    
    if (error) throw error
    return data
  },

  // 세션 새로고침
  async refreshSession() {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase.auth.refreshSession()
    if (error) throw error
    return data
  },

  // 인증 상태 변경 리스너
  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    return supabase.auth.onAuthStateChange(callback)
  }
}

// 데이터베이스 헬퍼 함수들
export const db = {
  // 프로필 생성/업데이트
  async upsertProfile(profile: Partial<Profile>) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profile)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // 사용자 프로필 가져오기
  async getProfile(userId: string) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) throw error
    return data
  },

  // 분석 통계 업데이트
  async updateAnalysisStats(userId: string) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    
    // 현재 프로필 정보 가져오기
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('total_analysis_count')
      .eq('id', userId)
      .single()
    
    if (fetchError) {
      console.warn('프로필 조회 실패, 기본값 사용:', fetchError)
    }
    
    const currentCount = profile?.total_analysis_count || 0
    
    // 분석 통계 업데이트
    const { data, error } = await supabase
      .from('profiles')
      .update({
        last_analysis_at: new Date().toISOString(),
        total_analysis_count: currentCount + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // 크롤링 작업 생성
  async createCrawlJob(userId: string) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('crawl_jobs')
      .insert({
        user_id: userId,
        status: 'pending'
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // 크롤링 작업 업데이트
  async updateCrawlJob(jobId: string, updates: Partial<CrawlJob>) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('crawl_jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // 사용자의 크롤링 작업 목록 가져오기
  async getUserCrawlJobs(userId: string) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('crawl_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // 크롤링 아이템 추가
  async addCrawlItem(item: Omit<CrawlItem, 'id' | 'created_at'>) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('crawl_items')
      .insert(item)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // 특정 작업의 아이템들 가져오기
  async getCrawlItems(jobId: string) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('crawl_items')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
    
    if (error) throw error
    return data
  }
} 