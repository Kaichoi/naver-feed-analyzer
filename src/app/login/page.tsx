'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { auth, db } from '@/lib/supabase'

// SVG 아이콘 컴포넌트
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: ''
  })
  const [error, setError] = useState('')
  const [agreements, setAgreements] = useState({
    privacy: false,
    marketing: false
  })

  // URL 파라미터 확인하여 초기 모드 설정
  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'signup') {
      setIsLogin(false)
    }
  }, [searchParams])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
    setError('') // 입력할 때 에러 메시지 제거
  }

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return false
    }

    if (!isLogin) {
      if (!formData.fullName) {
        setError('이름을 입력해주세요.')
        return false
      }
      if (formData.password !== formData.confirmPassword) {
        setError('비밀번호가 일치하지 않습니다.')
        return false
      }
      if (formData.password.length < 6) {
        setError('비밀번호는 6자 이상이어야 합니다.')
        return false
      }
      if (!agreements.privacy) {
        setError('개인정보 수집 및 이용에 동의해주세요.')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsLoading(true)
    setError('')

    try {
      if (isLogin) {
        // 로그인
        const { user } = await auth.signIn(formData.email, formData.password)
        console.log('로그인 성공:', user)
        router.push('/analysis')
      } else {
        // 회원가입
        const { user } = await auth.signUp(formData.email, formData.password, formData.fullName)
        
        if (user) {
          // 프로필 생성 (이미 존재하면 업데이트)
          try {
            await db.upsertProfile({
              id: user.id,
              email: user.email,
              full_name: formData.fullName,
            })
          } catch (profileError) {
            console.warn('프로필 생성 중 오류 (무시됨):', profileError)
          }
          
          console.log('회원가입 성공:', user)
          
          // 항상 이메일 인증 필요 (강제)
          console.log('이메일 인증 상태:', user.email_confirmed_at)
          router.push(`/auth/verify-email?email=${encodeURIComponent(formData.email)}`)
        }
      }
    } catch (error: unknown) {
      console.error('인증 오류:', error)
      
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      
      // Supabase 에러 메시지 번역
      if (errorMessage.includes('Invalid login credentials')) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else if (errorMessage.includes('User already registered')) {
        setError('이미 가입된 이메일입니다.')
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('이메일 인증이 필요합니다. 이메일을 확인해주세요.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // 구글 로그인 핸들러
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      await auth.signInWithGoogle()
      // OAuth 플로우는 콜백 페이지에서 처리됩니다
    } catch (error: unknown) {
      console.error('구글 로그인 오류:', error)
      const errorMessage = error instanceof Error ? error.message : '구글 로그인 중 오류가 발생했습니다.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" />
              홈으로 돌아가기
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
              {isLogin ? '로그인' : '회원가입'}
            </Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isLogin ? '계정에 로그인' : '새 계정 만들기'}
            </h2>
            <p className="text-gray-600">
              {isLogin 
                ? '네이버 홈피드 분석을 시작하세요' 
                : '무료로 가입하고 모든 기능을 이용하세요'
              }
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                {isLogin ? '로그인' : '회원가입'}
              </CardTitle>
              {error && (
                <CardDescription className="text-red-600 text-center">
                  {error}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">이름</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="홍길동"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">이메일</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="example@email.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">비밀번호</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {!isLogin && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">비밀번호 확인</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="••••••••"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                {/* 개인정보 동의 체크박스 - 회원가입 시만 표시 */}
                {!isLogin && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="privacy"
                          checked={agreements.privacy}
                          onChange={(e) => setAgreements(prev => ({ ...prev, privacy: e.target.checked }))}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="privacy" className="text-sm text-gray-700">
                          <span className="text-red-500 font-medium">[필수]</span> 개인정보 수집 및 이용에 동의합니다.
                        </label>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id="marketing"
                          checked={agreements.marketing}
                          onChange={(e) => setAgreements(prev => ({ ...prev, marketing: e.target.checked }))}
                          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="marketing" className="text-sm text-gray-700">
                          <span className="text-gray-500 font-medium">[선택]</span> 마케팅 및 홍보 활용에 대해 동의합니다.
                        </label>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                      <p><strong>수집하는 개인정보:</strong> 이메일, 이름</p>
                      <p><strong>이용 목적:</strong> 서비스 제공, 본인 확인</p>
                      <p><strong>보유 기간:</strong> 회원 탈퇴 시까지</p>
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                  size="lg"
                >
                  {isLoading ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
                </Button>
              </form>

              {/* 구분선 */}
              <div className="mt-6 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">또는</span>
                  </div>
                </div>
              </div>

              {/* 구글 로그인 버튼 */}
              <Button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                variant="outline" 
                size="lg"
                className="w-full mb-6"
              >
                <GoogleIcon />
                <span className="ml-2">Google로 {isLogin ? '로그인' : '회원가입'}</span>
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {isLogin ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
                  {' '}
                  <button
                    onClick={() => {
                      setIsLogin(!isLogin)
                      setError('')
                      setFormData({
                        email: '',
                        password: '',
                        fullName: '',
                        confirmPassword: ''
                      })
                      setAgreements({
                        privacy: false,
                        marketing: false
                      })
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {isLogin ? '회원가입' : '로그인'}
                  </button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
} 