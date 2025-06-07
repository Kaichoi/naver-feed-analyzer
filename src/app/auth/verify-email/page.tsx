'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Mail, CheckCircle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // 이미 로그인된 사용자가 있는지 확인
    const checkAuth = async () => {
      try {
        if (!supabase) return
        
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && session.user.email_confirmed_at) {
          // 이미 인증된 사용자는 분석 페이지로 리다이렉트
          router.push('/analysis')
        }
      } catch {
        // 인증되지 않은 사용자는 그대로 두기
      }
    }
    
    checkAuth()
  }, [router])

  const handleResendEmail = async () => {
    if (!email) {
      setError('이메일 정보가 없습니다.')
      return
    }

    setIsResending(true)
    setError('')
    
    try {
      // Supabase는 resend API를 제공하지 않으므로, 
      // 사용자에게 다시 회원가입을 시도하도록 안내
      setResendSuccess(true)
    } catch {
      setError('인증 이메일 재전송 중 오류가 발생했습니다.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/login" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              로그인으로 돌아가기
            </Link>
            <h1 className="text-xl font-bold text-gray-900">네이버 홈피드 분석기</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <Badge className="mb-4" variant="default">
              이메일 인증
            </Badge>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              이메일을 확인해주세요
            </h2>
            <p className="text-gray-600">
              회원가입을 완료하기 위해 이메일 인증이 필요합니다
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center flex items-center gap-2 justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
                인증 이메일 발송 완료
              </CardTitle>
              <CardDescription className="text-center">
                {email && (
                  <span className="font-medium text-blue-600">{email}</span>
                )}
                {email && <br />}
                위 이메일 주소로 인증 링크를 발송했습니다.
              </CardDescription>
              {error && (
                <CardDescription className="text-red-600 text-center">
                  {error}
                </CardDescription>
              )}
              {resendSuccess && (
                <CardDescription className="text-green-600 text-center">
                  로그인 페이지에서 다시 회원가입을 시도해주세요.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">다음 단계:</h3>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. 이메일 inbox를 확인하세요</li>
                  <li>2. &quot;Confirm your email&quot; 링크를 클릭하세요</li>
                  <li>3. 인증 완료 후 로그인해주세요</li>
                </ol>
              </div>

              <div className="text-center space-y-3">
                <p className="text-sm text-gray-600">
                  이메일이 오지 않았나요?
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="w-full"
                >
                  {isResending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    '회원가입 다시 시도'
                  )}
                </Button>
              </div>

              <div className="text-center">
                <Link href="/login" className="text-blue-600 hover:text-blue-800 text-sm">
                  로그인 페이지로 이동 →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
} 