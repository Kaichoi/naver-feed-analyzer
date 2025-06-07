'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, db } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('처리 중...')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        if (!supabase) {
          setError('서비스 초기화 중 문제가 발생했습니다.')
          return
        }

        setStatus('인증 정보 확인 중...')

        // URL 해시에서 직접 토큰 파싱
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const errorParam = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        // 에러가 있는 경우 처리
        if (errorParam) {
          console.error('OAuth 에러:', errorParam, errorDescription)
          setError(`인증 실패: ${errorDescription || errorParam}`)
          setTimeout(() => router.push('/login'), 3000)
          return
        }

        // 토큰이 없는 경우 세션에서 확인
        if (!accessToken) {
          setStatus('세션 확인 중...')
          const { data, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            console.error('세션 가져오기 오류:', sessionError)
            setError('로그인 처리 중 오류가 발생했습니다.')
            setTimeout(() => router.push('/login'), 3000)
            return
          }

          if (!data.session || !data.session.user) {
            console.log('세션이 없습니다. 로그인 페이지로 이동')
            setError('로그인 세션을 찾을 수 없습니다.')
            setTimeout(() => router.push('/login'), 3000)
            return
          }

          const user = data.session.user
          console.log('OAuth 로그인 성공 (세션):', user.email)
          await handleUserProfile(user.id)
          return
        }

        // 토큰으로 세션 설정
        setStatus('세션 설정 중...')
        const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        })

        if (setSessionError) {
          console.error('세션 설정 오류:', setSessionError)
          setError('세션 설정 중 오류가 발생했습니다.')
          setTimeout(() => router.push('/login'), 3000)
          return
        }

        if (!sessionData.user) {
          setError('사용자 정보를 가져올 수 없습니다.')
          setTimeout(() => router.push('/login'), 3000)
          return
        }

        console.log('OAuth 로그인 성공 (토큰):', sessionData.user.email)
        await handleUserProfile(sessionData.user.id)

      } catch (error) {
        console.error('OAuth 처리 중 오류:', error)
        setError('로그인 처리 중 예상치 못한 오류가 발생했습니다.')
        setTimeout(() => router.push('/login'), 3000)
      }
    }

    const handleUserProfile = async (userId: string) => {
      try {
        setStatus('프로필 확인 중...')
        const existingProfile = await db.getProfile(userId)
        
        if (existingProfile) {
          // 기존 사용자
          console.log('기존 사용자 - 분석 페이지로 이동')
          router.push('/analysis')
        } else {
          // 신규 사용자
          console.log('신규 사용자 - 동의 페이지로 이동')
          router.push('/auth/consent')
        }
      } catch (error) {
        // 프로필 조회 실패 시 신규 사용자로 간주
        console.log('프로필 조회 실패 - 신규 사용자로 처리:', error)
        router.push('/auth/consent')
      }
    }

    // 페이지 로드 후 약간의 지연을 두고 실행
    const timer = setTimeout(handleAuthCallback, 1000)
    
    return () => clearTimeout(timer)
  }, [router])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="bg-red-100 border border-red-300 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">로그인 오류</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-sm text-red-500">잠시 후 로그인 페이지로 이동합니다...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">{status}</p>
        <p className="mt-2 text-xs text-gray-500">잠시만 기다려주세요...</p>
      </div>
    </div>
  )
} 