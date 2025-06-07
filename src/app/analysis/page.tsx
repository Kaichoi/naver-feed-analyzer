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
  
  // Rate Limiting 상태
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number | null>(null)
  const [timeUntilNext, setTimeUntilNext] = useState<number>(0)

  // Rate Limiting 체크
  const checkLastAnalysisTime = useCallback(() => {
    const lastTime = localStorage.getItem('lastAnalysisTime')
    if (lastTime) {
      const lastAnalysis = parseInt(lastTime)
      setLastAnalysisTime(lastAnalysis)
      
      const now = Date.now()
      const oneHour = 60 * 60 * 1000 // 1시간
      const timeDiff = now - lastAnalysis
      
      if (timeDiff < oneHour) {
        setTimeUntilNext(oneHour - timeDiff)
      }
    }
  }, [])

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
      // Rate Limiting 체크
      checkLastAnalysisTime()
      // 사용자 통계 로드
      loadUserStats()
    }
  }, [user, loading, router, checkLastAnalysisTime, loadUserStats])

  // Rate Limiting 체크 (분석 시작 전)
  const canStartAnalysis = () => {
    if (!lastAnalysisTime) return true
    
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    const timeDiff = now - lastAnalysisTime
    
    return timeDiff >= oneHour
  }

  // 남은 시간 포맷팅
  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.ceil(ms / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    
    if (hours > 0) {
      return `${hours}시간 ${remainingMinutes}분`
    }
    return `${remainingMinutes}분`
  }

  // 실시간 타이머 업데이트
  useEffect(() => {
    if (timeUntilNext > 0) {
      const timer = setInterval(() => {
        setTimeUntilNext(prev => {
          const newTime = prev - 1000
          if (newTime <= 0) {
            clearInterval(timer)
            return 0
          }
          return newTime
        })
      }, 1000)
      
      return () => clearInterval(timer)
    }
  }, [timeUntilNext])

  // 크롤링 시작 (서버 API 사용) - 성능 최적화
  const startCrawling = async () => {
    if (!user) return
    
    // Rate Limiting 체크
    if (!canStartAnalysis()) {
      alert(`분석은 시간당 1회만 가능합니다.\n다음 분석까지 ${formatTimeRemaining(timeUntilNext)} 남았습니다.`)
      return
    }

    // 분석 시작 시간 저장 및 통계 업데이트
    const now = Date.now()
    localStorage.setItem('lastAnalysisTime', now.toString())
    setLastAnalysisTime(now)
    setTimeUntilNext(60 * 60 * 1000) // 1시간

    try {
      // 데이터베이스에 분석 통계 업데이트
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
      const sessionId = 'spGLaNSR5qMlh35F'
      const maxScanCount = 15 // 스캔 횟수
      const delay = 800 // 딜레이 단축
      const batchSize = 3 // 동시 요청 수
      
      // 배치 단위로 병렬 처리
      for (let batchStart = 1; batchStart <= maxScanCount; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize - 1, maxScanCount)
        const batchItems = Array.from(
          { length: batchEnd - batchStart + 1 }, 
          (_, i) => batchStart + i
        )
        
        // 현재 배치의 모든 요청을 병렬로 처리
        const batchPromises = batchItems.map(async (scanIndex) => {
          try {
            const response = await fetch('/api/crawl', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sessionId, page: scanIndex }),
            })
            
            if (!response.ok) {
              console.warn(`스캔 ${scanIndex} 요청 실패:`, response.status)
              return { scanIndex, items: [], hasMore: false, error: true }
            }
            
            const result = await response.json()
            
            if (result.error) {
              console.warn(`스캔 ${scanIndex} 오류:`, result.error)
              return { scanIndex, items: [], hasMore: false, error: true }
            }
            
            return { scanIndex, items: result.items || [], hasMore: result.hasMore, error: false }
            
          } catch (error) {
            console.error(`스캔 ${scanIndex} 처리 중 오류:`, error)
            return { scanIndex, items: [], hasMore: false, error: true }
          }
        })
        
        // 배치 결과 기다리기
        const batchResults = await Promise.all(batchPromises)
        
        // 결과 처리
        let shouldStop = false
        for (const result of batchResults.sort((a, b) => a.scanIndex - b.scanIndex)) {
          setCurrentItem(result.scanIndex)
          setProgress((result.scanIndex / maxScanCount) * 100)
          
          if (!result.error && result.items.length > 0) {
            // 새로운 아이템들 추가 (중복 제거)
            setItems(prev => {
              const newItems = [...prev]
              for (const newItem of result.items) {
                if (!newItems.some(existingItem => existingItem.url === newItem.url)) {
                  newItems.push(newItem)
                }
              }
              return newItems
            })
            
            // 더 이상 데이터가 없으면 종료 플래그 설정
            if (!result.hasMore) {
              shouldStop = true
            }
          }
        }
        
        // 조기 종료 조건
        if (shouldStop) {
          console.log(`스캔 ${batchEnd}에서 데이터가 더 이상 없어 분석 종료`)
          break
        }
        
        // 배치 간 딜레이 (마지막 배치가 아닌 경우에만)
        if (batchEnd < maxScanCount) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      
      setProgress(100)
      
    } catch (error) {
      console.error('분석 오류:', error)
      alert('분석 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : '알 수 없는 오류'))
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
    link.download = `naver_analysis_${new Date().toISOString().slice(0, 10)}.csv`
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
                disabled={isCrawling || !canStartAnalysis()}
                size="lg"
                className="flex-1"
              >
                {isCrawling ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    분석 중... ({currentItem}/{totalItems})
                  </>
                ) : !canStartAnalysis() ? (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    대기 중 ({formatTimeRemaining(timeUntilNext)})
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

            {/* Rate Limiting 안내 */}
            {!canStartAnalysis() && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⏰ 분석은 시간당 1회만 가능합니다. 다음 분석까지 <strong>{formatTimeRemaining(timeUntilNext)}</strong> 남았습니다.
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
                <p className="text-xs text-gray-500 text-center">
                  항목 {currentItem}/{totalItems} 분석 중...
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