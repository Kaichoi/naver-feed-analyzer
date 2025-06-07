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
  is_admin: boolean
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
      // 직접 세션 확인 (타임아웃 없음)
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session?.user) {
        return null
      }
      
      return session.user
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

  // 모든 사용자 프로필 가져오기 (관리자용)
  async getAllProfiles(): Promise<Profile[]> {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data || []
  },

  // 모든 인증된 사용자 가져오기 (관리자용) - 서버 API 호출
  async getAllAuthUsers() {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    
    try {
      // 현재 사용자의 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증 토큰이 없습니다.')
      }
      
      // 서버 API 호출
      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      return data.authUsers || []
    } catch (error) {
      console.error('인증 사용자 조회 오류:', error)
      throw error
    }
  },

  // 서버 API를 통한 사용자 현황 조회 (디버깅용)
  async getUsersDebugInfo() {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    
    try {
      // 현재 사용자의 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('인증 토큰이 없습니다.')
      }
      
      // 서버 API 호출
      const response = await fetch('/api/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      return {
        authUsers: data.authUsers || [],
        profiles: data.profiles || [],
        summary: data.summary || {}
      }
    } catch (error) {
      console.error('사용자 디버그 정보 조회 오류:', error)
      throw error
    }
  },

  // 프로필이 없는 사용자들을 위한 자동 동기화 (서버 API 사용)
  async syncMissingProfiles() {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    
    try {
      // 서버 API를 통해 사용자 정보 가져오기
      const debugInfo = await this.getUsersDebugInfo()
      const { authUsers, profiles } = debugInfo
      
      const profileIds = new Set(profiles.map((p: any) => p.id))
      const missingProfiles = authUsers.filter((user: any) => !profileIds.has(user.id))
      
      if (missingProfiles.length === 0) {
        return { synced: 0, total: authUsers.length }
      }
      
      console.log(`${missingProfiles.length}명의 사용자 프로필이 누락되어 자동 생성합니다.`)
      
      // 누락된 프로필들 자동 생성
      const syncPromises = missingProfiles.map(async (user: any) => {
        try {
          await this.upsertProfile({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
            avatar_url: user.user_metadata?.avatar_url || null,
            marketing_consent: false, // 기본값
            is_admin: false,
            created_at: user.created_at,
            updated_at: new Date().toISOString(),
            last_analysis_at: null,
            total_analysis_count: 0
          })
          console.log(`프로필 생성 완료: ${user.email}`)
          return true
        } catch (error) {
          console.error(`프로필 생성 실패 (${user.email}):`, error)
          return false
        }
      })
      
      const results = await Promise.all(syncPromises)
      const syncedCount = results.filter(Boolean).length
      
      return { 
        synced: syncedCount, 
        total: authUsers.length,
        failed: missingProfiles.length - syncedCount
      }
    } catch (error) {
      console.error('프로필 동기화 오류:', error)
      throw error
    }
  },

  // 사용자 프로필 업데이트 (관리자용)
  async updateProfile(userId: string, updates: Partial<Profile>) {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  // 관리자 권한 확인
  async isAdmin(userId: string): Promise<boolean> {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single()
      
      if (error) return false
      return data?.is_admin || false
    } catch (error) {
      console.error('관리자 권한 확인 오류:', error)
      return false
    }
  },

  // 분석 가능 여부 확인 (관리자는 시간 제한 없음)
  async canAnalyze(userId: string): Promise<{ canAnalyze: boolean; reason?: string; timeLeft?: number }> {
    if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.')
    
    try {
      // 관리자 권한 확인
      const isUserAdmin = await this.isAdmin(userId)
      if (isUserAdmin) {
        return { canAnalyze: true }
      }

      // 일반 사용자 시간 제한 확인
      const { data, error } = await supabase
        .from('profiles')
        .select('last_analysis_at')
        .eq('id', userId)
        .single()
      
      if (error) {
        // 프로필이 없으면 분석 가능
        return { canAnalyze: true }
      }
      
      if (!data.last_analysis_at) {
        // 첫 분석이면 가능
        return { canAnalyze: true }
      }
      
      const lastAnalysis = new Date(data.last_analysis_at)
      const now = new Date()
      const hoursSinceLastAnalysis = (now.getTime() - lastAnalysis.getTime()) / (1000 * 60 * 60)
      
      if (hoursSinceLastAnalysis >= 1) {
        return { canAnalyze: true }
      } else {
        const timeLeft = Math.ceil((1 - hoursSinceLastAnalysis) * 60) // 분 단위
        return { 
          canAnalyze: false, 
          reason: `1시간에 1회만 분석 가능합니다.`,
          timeLeft 
        }
      }
    } catch (error) {
      console.error('분석 가능 여부 확인 오류:', error)
      return { canAnalyze: false, reason: '권한 확인 중 오류가 발생했습니다.' }
    }
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