'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Zap, Database, Users, LogOut, User, ChevronRight } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'

export default function HomePage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  // 로딩 중일 때
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">네이버 홈피드 분석기</h1>
            <div className="flex gap-4 items-center">
              {user ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="h-4 w-4" />
                    {user.user_metadata?.full_name || user.email || '사용자'}
                  </div>
                  <Button 
                    onClick={() => router.push('/analysis')}
                    className="flex items-center gap-2"
                  >
                    분석 시작
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={signOut}>
                    <LogOut className="h-4 w-4 mr-1" />
                    로그아웃
                  </Button>
                </>
              ) : (
                <Link href="/login">
                  <Button>로그인</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="mb-4" variant="secondary">
            실시간 분석 서비스
          </Badge>
          <h2 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            네이버 홈피드를
            <br />
            <span className="text-blue-600">실시간으로 분석</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            네이버 메인 홈피드의 콘텐츠를 실시간으로 수집하고 분석하여 
            트렌드와 채널별 통계를 제공합니다.
          </p>
          <div className="flex gap-4 justify-center">
            {user ? (
              <>
                <Button 
                  size="lg" 
                  className="text-lg px-8"
                  onClick={() => router.push('/analysis')}
                >
                  분석 시작하기
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8"
                  onClick={() => router.push('/analysis')}
                >
                  내 분석 보기
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button size="lg" className="text-lg px-8">
                    지금 시작하기
                  </Button>
                </Link>
                <Link href="/login?mode=signup">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    회원가입하기
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Welcome Message for Logged-in Users */}
      {user && (
        <section className="container mx-auto px-4 pb-8">
          <Card className="max-w-2xl mx-auto bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-blue-900 mb-2">
                  환영합니다, {user.user_metadata?.full_name || user.email}님! 👋
                </h3>
                <p className="text-blue-700 mb-4">
                  네이버 홈피드 분석을 시작해보세요.
                </p>
                <Button 
                  onClick={() => router.push('/analysis')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  분석 페이지로 이동
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">주요 기능</h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            강력한 분석 도구로 네이버 콘텐츠 트렌드를 파악하세요
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <Zap className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>실시간 수집</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                네이버 홈피드 콘텐츠를 실시간으로 수집하고 분석합니다.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BarChart3 className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>채널별 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                블로그, 인플루언서, 카페, TV 등 채널별 상세 통계를 제공합니다.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Database className="h-10 w-10 text-purple-600 mb-2" />
              <CardTitle>데이터 저장</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                분석 결과를 엑셀로 내보내거나 클라우드에 저장할 수 있습니다.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>개인화 서비스</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                회원가입 시 개인 맞춤형 분석 리포트를 제공합니다.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      {!user && (
        <section className="bg-blue-600 text-white py-16">
          <div className="container mx-auto px-4 text-center">
            <h3 className="text-3xl font-bold mb-4">지금 시작해보세요</h3>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              회원가입하고 네이버 홈피드 분석의 강력함을 경험해보세요.
            </p>
            <Link href="/login?mode=signup">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                회원가입하기
              </Button>
            </Link>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2024 네이버 홈피드 분석기. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
