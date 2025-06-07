'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Play, Square, Download, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface FeedItem {
  title: string
  url: string
  service: string
}

interface CrawlProgress {
  currentPage: number
  totalPages: number
  itemsFound: number
  status: 'running' | 'completed' | 'error'
  message?: string
}

export default function TempAnalysisPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<CrawlProgress>({
    currentPage: 0,
    totalPages: 15,
    itemsFound: 0,
    status: 'running'
  })
  const [items, setItems] = useState<FeedItem[]>([])
  const [channelStats, setChannelStats] = useState<Record<string, number>>({})
  const eventSourceRef = useRef<EventSource | null>(null)

  const startCrawling = async () => {
    setIsRunning(true)
    setItems([])
    setChannelStats({})
    setProgress({
      currentPage: 0,
      totalPages: 15,
      itemsFound: 0,
      status: 'running'
    })

    try {
      // EventSource 연결 설정
      const eventSource = new EventSource('/api/crawl')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('EventSource 연결 성공')
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          switch (data.type) {
            case 'progress':
              setProgress(data.data)
              break
              
            case 'item':
              const newItem = data.data as FeedItem
              setItems(prev => [...prev, newItem])
              setChannelStats(prev => ({
                ...prev,
                [newItem.service]: (prev[newItem.service] || 0) + 1
              }))
              break
              
            case 'complete':
              setProgress(prev => ({ ...prev, status: 'completed' }))
              setIsRunning(false)
              eventSource.close()
              break
              
            case 'error':
              setProgress(prev => ({ 
                ...prev, 
                status: 'error',
                message: data.data.message 
              }))
              setIsRunning(false)
              eventSource.close()
              break
              
            default:
              console.warn('알 수 없는 메시지 타입:', data.type)
          }
        } catch (parseError) {
          console.error('메시지 파싱 오류:', parseError)
        }
      }

      eventSource.onerror = (error) => {
        console.error('EventSource 오류:', error)
        setProgress(prev => ({ 
          ...prev, 
          status: 'error',
          message: '서버 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
        }))
        setIsRunning(false)
        eventSource.close()
      }

    } catch (error) {
      console.error('크롤링 시작 오류:', error)
      setProgress(prev => ({ 
        ...prev, 
        status: 'error',
        message: '크롤링을 시작할 수 없습니다.' 
      }))
      setIsRunning(false)
    }
  }

  const stopCrawling = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsRunning(false)
  }

  const downloadExcel = () => {
    if (items.length === 0) return

    // CSV 형태로 다운로드 (한글 지원을 위한 BOM 추가)
    const headers = ['번호', '제목', 'URL', '채널']
    const csvContent = [
      headers.join(','),
      ...items.map((item, index) => 
        [index + 1, `"${item.title}"`, item.url, item.service].join(',')
      )
    ].join('\n')

    // UTF-8 BOM(Byte Order Mark) 추가 - Excel에서 한글을 제대로 읽기 위함
    const BOM = '\uFEFF'
    const csvWithBom = BOM + csvContent

    const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `naver-feed-analysis-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url) // 메모리 정리
  }

  const progressPercent = progress.totalPages > 0 
    ? (progress.currentPage / progress.totalPages) * 100 
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  홈으로
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">네이버 홈피드 분석 (체험판)</h1>
            </div>
            <div className="flex gap-2">
              {!isRunning ? (
                <Button onClick={startCrawling} className="flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  분석 시작
                </Button>
              ) : (
                <Button onClick={stopCrawling} variant="destructive" className="flex items-center gap-2">
                  <Square className="h-4 w-4" />
                  중지
                </Button>
              )}
              <Button 
                onClick={downloadExcel} 
                variant="outline" 
                disabled={items.length === 0}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                다운로드
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Progress Section */}
        <Card>
          <CardHeader>
            <CardTitle>진행 상황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>페이지 진행률</span>
                <span>{progress.currentPage}/{progress.totalPages}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={
                progress.status === 'running' ? 'default' :
                progress.status === 'completed' ? 'secondary' : 'destructive'
              }>
                {progress.status === 'running' ? '실행 중' :
                 progress.status === 'completed' ? '완료' : '오류'}
              </Badge>
              <span className="text-sm text-gray-600">
                수집된 아이템: {items.length}개
              </span>
            </div>
            {progress.message && (
              <p className="text-sm text-gray-600">{progress.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Channel Stats */}
        {Object.keys(channelStats).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>채널별 통계</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(channelStats)
                  .sort(([,a], [,b]) => b - a)
                  .map(([channel, count]) => (
                  <div key={channel} className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{count}</div>
                    <div className="text-sm text-gray-600">{channel}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>수집 결과</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                분석을 시작하면 결과가 여기에 실시간으로 표시됩니다.
              </div>
            ) : (
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">번호</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead className="w-32">채널</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="max-w-md">
                          <a 
                            href={item.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline line-clamp-2"
                          >
                            {item.title}
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.service}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 