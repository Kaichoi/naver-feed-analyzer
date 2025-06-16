'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/supabase'

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
  const { user, loading, signOut } = useAuth()

  // 상태 관리
  const [items, setItems] = useState<CrawlItem[]>([])
  const [filteredItems, setFilteredItems] = useState<CrawlItem[]>([])
  const [isCrawling, setIsCrawling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentItem, setCurrentItem] = useState(0)
  const [totalItems] = useState(100) // 예상 수집량
  const [userStats, setUserStats] = useState<{
    lastAnalysisAt: string | null
    totalAnalysisCount: number
  }>({
    lastAnalysisAt: null,
    totalAnalysisCount: 0
  })
  
  // 필터링/정렬 상태
  const [sortBy, setSortBy] = useState<'number' | 'title' | 'service'>('number')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterService, setFilterService] = useState<string>('all')
  
  // Rate Limiting 상태 - 개선된 안전한 초기값
  const [canAnalyze, setCanAnalyze] = useState(false) // 🔥 초기에 차단 (안전한 방식)
  const [analysisRestriction, setAnalysisRestriction] = useState<{
    canAnalyze: boolean
    reason?: string
    timeLeft?: number
  }>({ canAnalyze: false }) // 🔥 초기에 차단 (안전한 방식)
  const [isAdmin, setIsAdmin] = useState(false)
  const [permissionLoading, setPermissionLoading] = useState(true) // 🔥 권한 체크 로딩 상태 추가

  // 분석 가능 여부 체크 - 개선된 버전
  const checkAnalysisPermission = useCallback(async () => {
    if (!user) {
      console.log('🚫 사용자 없음, 권한 체크 종료')
      setPermissionLoading(false)
      return
    }

    console.log('🔄 권한 체크 시작:', { userId: user.id, email: user.email })
    setPermissionLoading(true) // 🔥 권한 체크 시작
    try {
      // 관리자 권한 확인
      const adminStatus = await db.isAdmin(user.id)
      setIsAdmin(adminStatus)
      console.log('👑 관리자 상태 설정:', adminStatus)

      // 분석 가능 여부 확인
      const permission = await db.canAnalyze(user.id)
      setAnalysisRestriction(permission)
      setCanAnalyze(permission.canAnalyze)
      
      console.log('✅ 권한 체크 완료:', { 
        isAdmin: adminStatus, 
        canAnalyze: permission.canAnalyze,
        timeLeft: permission.timeLeft,
        reason: permission.reason,
        timeLeftFormatted: permission.timeLeft ? formatTimeRemaining(permission.timeLeft) : 'N/A'
      })
    } catch (error) {
      console.error('💥 분석 권한 확인 오류:', error)
      // 🔥 오류 시 안전하게 차단
      setCanAnalyze(false)
      setAnalysisRestriction({ canAnalyze: false, reason: '권한 확인 중 오류가 발생했습니다.' })
    } finally {
      setPermissionLoading(false) // 🔥 권한 체크 완료
    }
  }, [user])

  const loadUserStats = useCallback(async () => {
    if (!user) return
    
    try {
      const profile = await db.getProfile(user.id)
      setUserStats({
        lastAnalysisAt: profile.last_analysis_at,
        totalAnalysisCount: profile.total_analysis_count || 0
      })
    } catch (error) {
      console.error('사용자 통계 로드 오류:', error)
    }
  }, [user])

  // 인증 확인
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (user) {
      // 분석 권한 및 사용자 통계 로드
      checkAnalysisPermission()
      loadUserStats()
    }
  }, [user, loading, router, checkAnalysisPermission, loadUserStats])

  // Rate Limiting 체크 (분석 시작 전) - 개선된 버전
  const canStartAnalysis = () => {
    // 🔥 권한 체크가 완료되지 않았으면 차단
    if (permissionLoading) return false
    
    // 관리자는 항상 허용
    if (isAdmin) return true
    
    // 일반 사용자는 제한 상태 확인
    return canAnalyze && analysisRestriction.canAnalyze
  }

  // 버튼 상태 및 텍스트 결정 함수 추가
  const getButtonState = () => {
    if (permissionLoading) {
      return {
        disabled: true,
        text: '권한 확인 중...',
        icon: 'loading'
      }
    }
    
    if (isCrawling) {
      return {
        disabled: true,
        text: '분석 중...',
        icon: 'stop'
      }
    }
    
    if (isAdmin) {
      return {
        disabled: false,
        text: '분석 시작',
        icon: 'play'
      }
    }
    
    if (!canStartAnalysis()) {
      return {
        disabled: true,
        text: `대기 중 (${formatTimeRemaining(analysisRestriction.timeLeft || 0)})`,
        icon: 'clock'
      }
    }
    
    return {
      disabled: false,
      text: '분석 시작',
      icon: 'play'
    }
  }

  // 남은 시간 포맷팅
  const formatTimeRemaining = (timeLeft?: number) => {
    if (!timeLeft || timeLeft <= 0) return '0분'
    
    const minutes = Math.ceil(timeLeft / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    if (hours > 0) {
      return `${hours}시간 ${remainingMinutes}분`
    }
    return `${remainingMinutes}분`
  }

  // 실시간 타이머 업데이트 - 개선된 로직
  useEffect(() => {
    // 🔥 권한 체크가 진행 중이거나 시간이 없으면 타이머 실행 안함
    if (permissionLoading || !analysisRestriction.timeLeft || analysisRestriction.timeLeft <= 0) {
      return
    }

    const timer = setInterval(() => {
      setAnalysisRestriction(prev => {
        const newTimeLeft = (prev.timeLeft || 0) - 1000
        
        if (newTimeLeft <= 0) {
          // 시간이 만료되면 권한 상태 복구 (무한 루프 방지)
          setCanAnalyze(true) // canAnalyze 상태도 함께 업데이트
          return { 
            canAnalyze: true, 
            timeLeft: 0,
            reason: undefined
          }
        }
        
        return { ...prev, timeLeft: newTimeLeft }
      })
    }, 1000)
    
    return () => clearInterval(timer)
  }, [analysisRestriction.timeLeft, permissionLoading]) // 🔥 permissionLoading 의존성 추가

  // 크롤링 시작 (스트리밍 API 사용) - parse.py와 동일한 로직
  const startCrawling = async () => {
    if (!user) return
    
    // 서버 기반 권한 체크
    if (!canStartAnalysis()) {
      const message = isAdmin 
        ? '관리자는 언제든지 분석 가능합니다.' 
        : `${analysisRestriction.reason || '분석 제한 중입니다.'}\n${analysisRestriction.timeLeft ? `다음 분석까지 ${formatTimeRemaining(analysisRestriction.timeLeft)} 남았습니다.` : ''}`
      alert(message)
      if (!isAdmin) return
    }

    // 일반 사용자에게만 쿨다운 적용 (관리자는 제외)
    if (!isAdmin) {
      const oneHourInMs = 60 * 60 * 1000
      setAnalysisRestriction({
        canAnalyze: false,
        timeLeft: oneHourInMs, // 1시간(밀리초)
        reason: '1시간에 1회만 분석 가능합니다.'
      })
      setCanAnalyze(false)
    }

    // 분석 시간 업데이트 (관리자 포함)
    try {
      await db.updateAnalysisStats(user.id)
      // 로컬 상태도 업데이트
      setUserStats(prev => ({
        lastAnalysisAt: new Date().toISOString(),
        totalAnalysisCount: prev.totalAnalysisCount + 1
      }))
    } catch (error) {
      console.error('분석 통계 업데이트 오류:', error)
    }

    setIsCrawling(true)
    setProgress(0)
    setCurrentItem(0)
    setItems([])

    try {
      // 🔥 스트리밍 API 사용으로 변경 - parse.py와 동일한 로직
      const response = await fetch('/api/crawl/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: 'spGLaNSR5qMlh35F', // parse.py와 동일한 고정 세션 ID
          maxPages: 15, // parse.py와 동일한 페이지 수
          delay: 1500 // parse.py와 동일한 딜레이
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('스트림을 읽을 수 없습니다')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          
          // 줄바꿈으로 구분된 JSON 메시지들 처리
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 마지막 불완전한 줄은 버퍼에 보관

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line)
                
                if (data.type === 'progress') {
                  setProgress(data.progress)
                  setCurrentItem(data.currentPage || 0)
                } else if (data.type === 'items') {
                  // 실시간으로 아이템 추가 (이미 중복 제거됨)
                  setItems(data.items)
                } else if (data.type === 'complete') {
                  setProgress(100)
                  console.log(`✅ 크롤링 완료: 총 ${data.totalItems}개 항목 (중복 제거됨)`)
                } else if (data.type === 'error') {
                  throw new Error(data.message)
                }
              } catch (parseError) {
                console.warn('JSON 파싱 오류:', parseError, 'Line:', line)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      setProgress(100)
      
    } catch (error) {
      console.error('분석 오류:', error)
      alert('분석 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'))
    } finally {
      setIsCrawling(false)
    }
  }

  // CSV 다운로드 - 즉시 다운로드
  const downloadCSV = () => {
    if (items.length === 0) {
      alert('다운로드할 데이터가 없습니다.')
      return
    }

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
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    
    link.href = url
    link.download = `naver_analysis_${new Date().toISOString().slice(0, 10)}.csv`
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // 메모리 정리
    URL.revokeObjectURL(url)
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

  // 필터링 및 정렬 로직
  useEffect(() => {
    let filtered = [...items]
    
    // 서비스 필터링
    if (filterService !== 'all') {
      filtered = filtered.filter(item => item.service === filterService)
    }
    
    // 정렬
    filtered.sort((a, b) => {
      let aValue: string | number = 0
      let bValue: string | number = 0
      
      switch (sortBy) {
        case 'number':
          aValue = items.indexOf(a)
          bValue = items.indexOf(b)
          break
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'service':
          aValue = a.service
          bValue = b.service
          break
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
    
    setFilteredItems(filtered)
  }, [items, sortBy, sortOrder, filterService])

  // 고유 서비스 목록 가져오기
  const getUniqueServices = () => {
    const services = [...new Set(items.map(item => item.service))]
    return services.sort()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
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
              <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4" />
                홈으로
              </Link>
              <h1 className="text-xl font-bold text-gray-900">네이버 홈피드 분석기</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                {user?.user_metadata?.full_name || user?.email || '사용자'}
                {isAdmin && (
                  <Badge variant="default" className="ml-2 bg-purple-600">
                    관리자
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
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
                disabled={getButtonState().disabled}
                size="lg"
                className="flex-1"
              >
                {getButtonState().icon === 'loading' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                )}
                {getButtonState().icon === 'stop' && <Square className="h-4 w-4 mr-2" />}
                {getButtonState().icon === 'clock' && <Clock className="h-4 w-4 mr-2" />}
                {getButtonState().icon === 'play' && <Play className="h-4 w-4 mr-2" />}
                {getButtonState().text}
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

            {/* Rate Limiting 및 권한 상태 안내 - 개선된 버전 */}
            {permissionLoading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  🔍 사용자 권한을 확인하고 있습니다...
                </p>
              </div>
            )}
            
            {!permissionLoading && !isAdmin && !analysisRestriction.canAnalyze && analysisRestriction.timeLeft && analysisRestriction.timeLeft > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⏰ {analysisRestriction.reason} 다음 분석까지 <strong>{formatTimeRemaining(analysisRestriction.timeLeft)}</strong> 남았습니다.
                </p>
              </div>
            )}
            
            {!permissionLoading && isAdmin && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-sm text-purple-800">
                  👑 관리자는 시간 제한 없이 언제든지 분석을 실행할 수 있습니다.
                </p>
              </div>
            )}

            {!permissionLoading && !isAdmin && analysisRestriction.canAnalyze && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  ✅ 분석이 가능합니다. 분석 버튼을 클릭하여 시작하세요.
                </p>
              </div>
            )}

            {/* Progress Bar */}
            {isCrawling && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>진행률</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="w-full" />
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
                    <p className="text-sm text-gray-600">총 분석 횟수</p>
                    <p className="text-2xl font-bold">{userStats.totalAnalysisCount}</p>
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
                    <Badge variant={isCrawling ? 'secondary' : 'default'}>
                      {isCrawling ? '분석 중' : '대기'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* User Stats Card - 분석 전에도 표시 */}
        {!items.length && userStats.totalAnalysisCount > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>내 분석 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{userStats.totalAnalysisCount}</p>
                  <p className="text-sm text-gray-600">총 분석 횟수</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">
                    {userStats.lastAnalysisAt 
                      ? new Date(userStats.lastAnalysisAt).toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '없음'
                    }
                  </p>
                  <p className="text-sm text-gray-600">마지막 분석</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Service Statistics - 분석 결과 바로 위로 이동 */}
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

        {/* Results Table */}
        {items.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <CardTitle>분석 결과</CardTitle>
                  <CardDescription>
                    수집된 {items.length}개 중 {filteredItems.length}개 표시
                  </CardDescription>
                </div>
                
                {/* 필터링/정렬 컨트롤 */}
                <div className="flex flex-col sm:flex-row gap-2">
                  {/* 서비스 필터 */}
                  <select
                    value={filterService}
                    onChange={(e) => setFilterService(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="all">모든 채널</option>
                    {getUniqueServices().map(service => (
                      <option key={service} value={service}>{service}</option>
                    ))}
                  </select>
                  
                  {/* 정렬 기준 */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'number' | 'title' | 'service')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="number">번호순</option>
                    <option value="title">제목순</option>
                    <option value="service">채널순</option>
                  </select>
                  
                  {/* 정렬 순서 */}
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    title={sortOrder === 'asc' ? '오름차순' : '내림차순'}
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
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
                    {filteredItems.map((item) => {
                      // 원본 배열에서의 인덱스 찾기
                      const originalIndex = items.findIndex(originalItem => originalItem.id === item.id)
                      return (
                        <tr key={item.id} className="border-b hover:bg-gray-50">
                          <td className="p-2 text-sm text-gray-500">{originalIndex + 1}</td>
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
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 