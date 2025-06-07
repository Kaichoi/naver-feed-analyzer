'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Play, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  LogOut,
  Download,
  Eye
} from 'lucide-react'
import { db, type CrawlJob } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface User {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const [jobs, setJobs] = useState<CrawlJob[]>([])
  const [isCreatingJob, setIsCreatingJob] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }
      
      loadJobs(user.id)
    }
  }, [user, loading, router])

  const loadJobs = async (userId: string) => {
    try {
      const userJobs = await db.getUserCrawlJobs(userId)
      setJobs(userJobs)
    } catch (error) {
      console.error('작업 목록 로드 오류:', error)
    }
  }

  const createNewJob = async () => {
    if (!user) return

    setIsCreatingJob(true)
    try {
      const newJob = await db.createCrawlJob(user.id)
      router.push(`/analysis/${newJob.id}`)
    } catch (error) {
      console.error('새 작업 생성 오류:', error)
      alert('새 분석 작업을 생성하는 중 오류가 발생했습니다.')
    } finally {
      setIsCreatingJob(false)
    }
  }

  const getStatusIcon = (status: CrawlJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'running':
        return <Play className="h-4 w-4 text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusText = (status: CrawlJob['status']) => {
    switch (status) {
      case 'pending':
        return '대기 중'
      case 'running':
        return '실행 중'
      case 'completed':
        return '완료'
      case 'failed':
        return '실패'
      default:
        return '알 수 없음'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xl font-bold text-gray-900">
                네이버 홈피드 분석기
              </Link>
              <Badge variant="secondary">대시보드</Badge>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4" />
                <span className="text-sm">
                  {user?.user_metadata?.full_name || user?.email || '사용자'}
                </span>
              </div>
              <Button onClick={signOut} variant="ghost" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                로그아웃
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome Section */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            안녕하세요, {user?.user_metadata?.full_name || '사용자'}님! 👋
          </h1>
          <p className="text-gray-600 mb-6">
            네이버 홈피드 분석을 시작하고 결과를 관리하세요.
          </p>
          
          <Button 
            onClick={createNewJob}
            disabled={isCreatingJob}
            size="lg"
            className="flex items-center gap-2"
          >
            <Play className="h-5 w-5" />
            {isCreatingJob ? '생성 중...' : '새 분석 시작'}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">전체 분석</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{jobs.length}</div>
              <p className="text-xs text-muted-foreground">
                총 분석 작업 수
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">완료된 분석</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {jobs.filter(job => job.status === 'completed').length}
              </div>
              <p className="text-xs text-muted-foreground">
                성공적으로 완료됨
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">수집된 아이템</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {jobs.reduce((total, job) => total + (job.total_items || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                전체 아이템 수
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>분석 기록</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">아직 분석 기록이 없습니다</p>
                <p className="text-sm">첫 번째 분석을 시작해보세요!</p>
              </div>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>상태</TableHead>
                      <TableHead>생성일</TableHead>
                      <TableHead>완료일</TableHead>
                      <TableHead>아이템 수</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(job.status)}
                            <span className="text-sm">{getStatusText(job.status)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(job.created_at)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {job.completed_at ? formatDate(job.completed_at) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {job.total_items || 0}개
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/analysis/${job.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              보기
                            </Button>
                            {job.status === 'completed' && job.total_items > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // TODO: 다운로드 기능 구현
                                  alert('다운로드 기능은 곧 구현됩니다.')
                                }}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                다운로드
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle>빠른 접근</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <Button 
                variant="outline" 
                className="w-full justify-start h-auto p-4"
                onClick={() => alert('도움말 페이지는 곧 구현됩니다.')}
              >
                <div className="text-left">
                  <div className="font-medium">사용 가이드</div>
                  <div className="text-sm text-gray-500">
                    분석 기능 사용법 안내
                  </div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 