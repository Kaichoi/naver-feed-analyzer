'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db, supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

export default function ConsentPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  const checkExistingProfile = useCallback(async (userId: string) => {
    try {
      const profile = await db.getProfile(userId)
      if (profile) {
        // 이미 동의한 사용자는 홈으로
        router.push('/')
      }
    } catch (error) {
      console.log('프로필 확인 중 오류 (신규 사용자):', error)
    }
  }, [router])

  useEffect(() => {
    const initializeUser = async () => {
      try {
        if (!supabase) {
          router.push('/login')
          return
        }

        // 현재 세션 확인
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          console.error('세션 오류:', error)
          router.push('/login')
          return
        }

        setUser(session.user)
        
        // 이미 프로필이 있는 사용자는 홈으로
        await checkExistingProfile(session.user.id)
      } catch (error) {
        console.error('사용자 초기화 오류:', error)
        router.push('/login')
      } finally {
        setIsInitializing(false)
      }
    }

    initializeUser()
  }, [router, checkExistingProfile])

  const handleSubmit = async () => {
    if (!privacyConsent) {
      alert('개인정보 수집 및 이용에 동의해주세요.')
      return
    }

    if (!user) {
      alert('로그인 정보를 찾을 수 없습니다.')
      return
    }

    setIsLoading(true)

    try {
      // 프로필 생성
      await db.upsertProfile({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        marketing_consent: marketingConsent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_analysis_at: null,
        total_analysis_count: 0
      })

      // 홈으로 리다이렉트
      router.push('/')
    } catch (error) {
      console.error('프로필 생성 오류:', error)
      alert('프로필 생성 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isInitializing || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로그인 확인 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            서비스 이용 동의
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            NBLE 서비스 이용을 위해 아래 약관에 동의해주세요.
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="space-y-6">
            {/* 필수 동의 */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start">
                <input
                  id="privacy-consent"
                  type="checkbox"
                  checked={privacyConsent}
                  onChange={(e) => setPrivacyConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="privacy-consent" className="ml-3 block text-sm font-medium text-gray-900">
                  [필수] 개인정보 수집 및 이용에 동의합니다.
                </label>
              </div>
              <div className="mt-3 text-xs text-gray-500 ml-7">
                <p className="font-semibold">수집하는 개인정보 항목:</p>
                <p>• 이메일 주소, 이름 (Google 계정 정보)</p>
                <p>• 서비스 이용 기록 (분석 결과, 이용 시간 등)</p>
                <br />
                <p className="font-semibold">개인정보 수집 및 이용 목적:</p>
                <p>• 회원 가입 및 관리</p>
                <p>• 네이버 홈피드 분석 서비스 제공</p>
                <p>• 서비스 개선 및 통계 분석</p>
                <br />
                <p className="font-semibold">개인정보 보유 및 이용 기간:</p>
                <p>• 회원 탈퇴 시까지 보유</p>
                <p>• 탈퇴 후 즉시 파기</p>
              </div>
            </div>

            {/* 선택 동의 */}
            <div className="border rounded-lg p-4">
              <div className="flex items-start">
                <input
                  id="marketing-consent"
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="marketing-consent" className="ml-3 block text-sm font-medium text-gray-900">
                  [선택] 마케팅 및 홍보 활용에 대해 동의합니다.
                </label>
              </div>
              <div className="mt-3 text-xs text-gray-500 ml-7">
                <p>• 새로운 기능 및 서비스 안내</p>
                <p>• 이벤트 및 프로모션 정보</p>
                <p>• 언제든지 수신 거부 가능</p>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  처리 중...
                </div>
              ) : (
                '동의하고 시작하기'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 