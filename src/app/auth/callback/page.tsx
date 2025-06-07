'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (!supabase) {
          router.push('/login')
          return
        }

        // 단순한 세션 확인
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          router.push('/login')
          return
        }

        console.log('로그인 성공:', session.user.email)
        
        // 빠른 프로필 확인
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle()
        
        if (profile) {
          router.push('/analysis')
        } else {
          router.push('/auth/consent')
        }

      } catch (error) {
        console.error('OAuth 처리 오류:', error)
        router.push('/login')
      }
    }

    // 즉시 실행
    handleCallback()
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