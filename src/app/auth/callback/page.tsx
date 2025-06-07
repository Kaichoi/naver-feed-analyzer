'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, db } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase 클라이언트 확인
        if (!supabase) {
          console.error('Supabase 클라이언트가 초기화되지 않았습니다.')
          router.push('/login?error=init_error')
          return
        }

        // URL에서 인증 정보 처리
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('OAuth 콜백 오류:', error)
          router.push('/login?error=oauth_error')
          return
        }

        if (data.session) {
          console.log('OAuth 로그인 성공:', data.session.user)
          
          // 신규 사용자 확인
          try {
            const existingProfile = await db.getProfile(data.session.user.id)
            
            if (!existingProfile) {
              // 신규 사용자면 동의 페이지로 리다이렉트
              console.log('신규 사용자 - 동의 페이지로 이동')
              router.push('/auth/consent')
              return
            }
            
            // 기존 사용자면 분석 페이지로
            console.log('기존 사용자 - 분석 페이지로 이동')
            router.push('/analysis')
            
          } catch (profileError) {
            // 프로필 조회 실패 시 신규 사용자로 간주
            console.log('프로필 조회 실패 - 신규 사용자로 처리:', profileError)
            router.push('/auth/consent')
          }
        } else {
          // 세션이 없으면 로그인 페이지로
          router.push('/login')
        }
      } catch (error) {
        console.error('OAuth 처리 중 오류:', error)
        router.push('/login?error=callback_error')
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  )
} 