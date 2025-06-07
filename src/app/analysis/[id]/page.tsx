'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft, 
  Play, 
  Square, 
  Download, 
  BarChart3, 
  Clock,
  User,
  LogOut
} from 'lucide-react'
import { auth, db, type CrawlJob } from '@/lib/supabase'

interface CrawlItem {
  id: string
  title: string
  url: string
  service: string
  created_at: string
}

interface User {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
  }
}

export default function AnalysisPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  // 상태 관리
  const [user, setUser] = useState<User | null>(null)
  const [job, setJob] = useState<CrawlJob | null>(null)
  const [items, setItems] = useState<CrawlItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCrawling, setIsCrawling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages] = useState(15)

  // 작업 정보 로드
  const loadJob = useCallback(async (jobId: string, userId: string) => {
    try {
      // 작업 정보 확인 (사용자의 작업인지 검증)
      const userJobs = await db.getUserCrawlJobs(userId)
      const currentJob = userJobs.find(job => job.id === jobId)
      
      if (!currentJob) {
        // 사용자의 작업이 아니거나 존재하지 않는 경우
        router.push('/dashboard')
        return
      }
      
      setJob(currentJob)
      
      // 기존 아이템들 로드
      if (currentJob.status === 'completed') {
        const existingItems = await db.getCrawlItems(jobId)
        setItems(existingItems)
      }
    } catch (error) {
      console.error('작업 로드 오류:', error)
      router.push('/dashboard')
    }
  }, [router])

  // 인증 및 초기화
  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await auth.getCurrentUser()
        if (!currentUser) {
          router.push('/login')
          return
        }
        
        setUser(currentUser)
        await loadJob(jobId, currentUser.id)
      } catch (error) {
        console.error('인증 확인 오류:', error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [router, jobId, loadJob])

  // 로그아웃
  const handleSignOut = async () => {
    try {
      await auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('로그아웃 오류:', error)
    }
  }

  // 크롤링 시작
  const startCrawling = async () => {
    if (!job || !user) return

    setIsCrawling(true)
    setProgress(0)
    setCurrentPage(0)
    setItems([])

    try {
      // 작업 상태를 'running'으로 업데이트
      await db.updateCrawlJob(job.id, { 
        status: 'running',
        total_items: 0
      })

      // 스트리밍 크롤링 시작
      const response = await fetch('/api/crawl/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })

      if (!response.ok) {
        throw new Error('크롤링 시작 실패')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6))
                
                if (data.type === 'progress') {
                  setProgress(data.progress)
                  setCurrentPage(data.currentPage)
                } else if (data.type === 'item') {
                  setItems(prev => [...prev, data.item])
                } else if (data.type === 'complete') {
                  setProgress(100)
                  // 작업 상태를 'completed'로 업데이트
                  await db.updateCrawlJob(job.id, { 
                    status: 'completed',
                    total_items: data.totalItems,
                    completed_at: new Date().toISOString()
                  })
                  break
                } else if (data.type === 'error') {
                  throw new Error(data.message)
                }
              } catch (parseError) {
                console.error('데이터 파싱 오류:', parseError)
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('크롤링 오류:', error)
      // 작업 상태를 'failed'로 업데이트
      await db.updateCrawlJob(job.id, { 
        status: 'failed',
        error_message: error instanceof Error ? error.message : '알 수 없는 오류'
      })
    } finally {
      setIsCrawling(false)
    }
  }

  // CSV 다운로드
  const downloadCSV = () => {
    if (items.length === 0) return

    const BOM = '\uFEFF'
    const headers = ['번호', '제목', 'URL', '채널']
    const csvContent = [
      headers.join(','),
      ...items.map((item, index) => [
        index + 1,
        `"${item.title.replace(/"/g, '""')}"`,
        `"${item.url}"`,
        item.service
      ].join(','))
    ].join('\n')

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `naver_analysis_${job?.id || 'data'}.csv`
    link.click()
  }

  // 서비스별 통계 계산
  const getServiceStats = () => {
    const stats = items.reduce((acc, item) => {
      acc[item.service] = (acc[item.service] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(stats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">작업을 찾을 수 없습니다.</p>
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            대시보드로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4" />
                대시보드
              </Link>
              <h1 className="text-xl font-bold text-gray-900">분석 작업 #{job.id.slice(0, 8)}</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                {user?.user_metadata?.full_name || user?.email || '사용자'}
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Control Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              네이버 홈피드 분석
            </CardTitle>
            <CardDescription>
              네이버 모바일 홈피드를 분석하여 콘텐츠 트렌드를 파악합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button 
                onClick={startCrawling} 
                disabled={isCrawling}
                size="lg"
                className="flex-1"
              >
                {isCrawling ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    분석 중... ({currentPage}/{totalPages})
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    분석 시작
                  </>
                )}
              </Button>
              
              <Button 
                onClick={downloadCSV} 
                disabled={items.length === 0}
                variant="outline"
                size="lg"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV 다운로드
              </Button>
            </div>

            {/* Progress Bar */}
            {isCrawling && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>진행률</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
                <p className="text-xs text-gray-500 text-center">
                  페이지 {currentPage}/{totalPages} 분석 중...
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">총 항목 수</p>
                    <p className="text-2xl font-bold">{items.length}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">상위 채널</p>
                    <p className="text-lg font-semibold">
                      {getServiceStats()[0]?.[0] || '-'}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {getServiceStats()[0]?.[1] || 0}개
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">분석 시간</p>
                    <p className="text-lg font-semibold">
                      {job.completed_at ? 
                        `${Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)}초` 
                        : '진행 중'
                      }
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">상태</p>
                    <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                      {job.status === 'completed' ? '완료' : 
                       job.status === 'failed' ? '실패' : 
                       job.status === 'running' ? '실행 중' : '대기'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Table */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>분석 결과</CardTitle>
              <CardDescription>
                수집된 {items.length}개의 콘텐츠 목록
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 w-16">번호</th>
                      <th className="text-left p-2">제목</th>
                      <th className="text-left p-2 w-24">채널</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-sm text-gray-500">{index + 1}</td>
                        <td className="p-2">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm line-clamp-2"
                          >
                            {item.title}
                          </a>
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {item.service}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service Statistics */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>채널별 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getServiceStats().map(([service, count]) => (
                  <div key={service} className="flex items-center justify-between">
                    <span className="font-medium">{service}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${(count / items.length) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 w-12 text-right">
                        {count}개
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 