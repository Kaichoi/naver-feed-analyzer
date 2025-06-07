'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Users, 
  BarChart3, 
  Activity, 
  Calendar,
  ArrowLeft,
  Shield,
  Clock,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'

interface AdminStats {
  totalUsers: number
  totalAnalyses: number
  activeToday: number
  activeThisWeek: number
  activeThisMonth: number
  adminCount: number
}

interface UserProfile {
  id: string
  email: string | null
  full_name: string | null
  total_analysis_count: number
  last_analysis_at: string | null
  is_admin: boolean
  created_at: string
}

interface DailyStats {
  date: string
  analysisCount: number
  userCount: number
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users'>('dashboard')
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalAnalyses: 0,
    activeToday: 0,
    activeThisWeek: 0,
    activeThisMonth: 0,
    adminCount: 0
  })
  const [users, setUsers] = useState<UserProfile[]>([])
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])

  const loadAdminData = useCallback(async () => {
    try {
      const profiles = await db.getAllProfiles()
      
      const totalUsers = profiles.length
      const totalAnalyses = profiles.reduce((sum: number, p: UserProfile) => sum + p.total_analysis_count, 0)
      const adminCount = profiles.filter((p: UserProfile) => p.is_admin).length
      
      // 날짜별 활동 계산
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      const activeToday = profiles.filter((p: UserProfile) => 
        p.last_analysis_at && p.last_analysis_at.startsWith(today)
      ).length

      const activeThisWeek = profiles.filter((p: UserProfile) => 
        p.last_analysis_at && p.last_analysis_at >= weekAgo
      ).length

      const activeThisMonth = profiles.filter((p: UserProfile) => 
        p.last_analysis_at && p.last_analysis_at >= monthAgo
      ).length

      // 최근 7일간 일별 통계
      const recentStats: DailyStats[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        
        const dayAnalyses = profiles.filter((p: UserProfile) => 
          p.last_analysis_at && p.last_analysis_at.startsWith(dateStr)
        ).length

        const dayUsers = profiles.filter((p: UserProfile) => 
          p.last_analysis_at && p.last_analysis_at.startsWith(dateStr)
        ).length

        recentStats.push({
          date: dateStr,
          analysisCount: dayAnalyses,
          userCount: dayUsers
        })
      }

      setStats({ 
        totalUsers, 
        totalAnalyses, 
        activeToday, 
        activeThisWeek, 
        activeThisMonth,
        adminCount 
      })
      setUsers(profiles)
      setDailyStats(recentStats)
    } catch (error) {
      console.error('관리자 데이터 로드 오류:', error)
    }
  }, [])

  const checkAdminPermission = useCallback(async () => {
    if (!user) return
    
    try {
      const adminStatus = await db.isAdmin(user.id)
      setIsAdmin(adminStatus)
      
      if (!adminStatus) {
        router.push('/')
        return
      }
      
      await loadAdminData()
    } catch (error) {
      console.error('관리자 권한 확인 오류:', error)
      router.push('/')
    } finally {
      setIsChecking(false)
    }
  }, [user, router, loadAdminData])

  const toggleAdminStatus = useCallback(async (userId: string, currentStatus: boolean) => {
    try {
      await db.updateProfile(userId, { is_admin: !currentStatus })
      await loadAdminData()
      alert(`관리자 권한이 ${!currentStatus ? '부여' : '해제'}되었습니다.`)
    } catch (error) {
      console.error('관리자 권한 변경 오류:', error)
      alert('권한 변경 중 오류가 발생했습니다.')
    }
  }, [loadAdminData])

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }
      
      checkAdminPermission()
    }
  }, [user, loading, router, checkAdminPermission])

  if (loading || isChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">권한 확인 중...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/analysis" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4" />
                분석 페이지로
              </Link>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-purple-600" />
                관리자 대시보드
              </h1>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-purple-600">
                관리자
              </Badge>
              <span className="text-sm text-gray-600">
                {user?.user_metadata?.full_name || user?.email}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'dashboard'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BarChart3 className="inline h-4 w-4 mr-2" />
                대시보드
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="inline h-4 w-4 mr-2" />
                사용자 관리
              </button>
            </nav>
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">총 사용자</p>
                      <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">총 분석 횟수</p>
                      <p className="text-3xl font-bold text-green-600">{stats.totalAnalyses}</p>
                    </div>
                    <BarChart3 className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">오늘 활동</p>
                      <p className="text-3xl font-bold text-purple-600">{stats.activeToday}</p>
                    </div>
                    <Activity className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">관리자 수</p>
                      <p className="text-3xl font-bold text-orange-600">{stats.adminCount}</p>
                    </div>
                    <Shield className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Activity Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    이번 주 활동
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.activeThisWeek}</p>
                    <p className="text-sm text-gray-600">명의 사용자가 분석을 실행했습니다</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    이번 달 활동
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{stats.activeThisMonth}</p>
                    <p className="text-sm text-gray-600">명의 사용자가 분석을 실행했습니다</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    평균 분석 횟수
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">
                      {stats.totalUsers > 0 ? Math.round(stats.totalAnalyses / stats.totalUsers * 10) / 10 : 0}
                    </p>
                    <p className="text-sm text-gray-600">사용자당 평균 분석 횟수</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity Chart */}
            <Card>
              <CardHeader>
                <CardTitle>최근 7일간 활동</CardTitle>
                <CardDescription>일별 분석 실행 현황</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dailyStats.map((day, index) => {
                    const maxCount = Math.max(...dailyStats.map(d => d.analysisCount))
                    const width = maxCount > 0 ? (day.analysisCount / maxCount) * 100 : 0
                    
                    return (
                      <div key={day.date} className="flex items-center justify-between">
                        <div className="w-20 text-sm text-gray-600">
                          {new Date(day.date).toLocaleDateString('ko-KR', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </div>
                        <div className="flex-1 mx-4">
                          <div className="bg-gray-200 rounded-full h-3 relative">
                            <div 
                              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                              style={{ width: `${width}%` }}
                            ></div>
                          </div>
                        </div>
                        <div className="w-12 text-right text-sm font-medium">
                          {day.analysisCount}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <Card>
            <CardHeader>
              <CardTitle>사용자 관리</CardTitle>
              <CardDescription>
                총 {users.length}명의 사용자 (관리자 {stats.adminCount}명)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-4 font-medium">사용자</th>
                      <th className="p-4 font-medium">분석 횟수</th>
                      <th className="p-4 font-medium">마지막 분석</th>
                      <th className="p-4 font-medium">가입일</th>
                      <th className="p-4 font-medium">권한</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((userProfile) => (
                      <tr key={userProfile.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <div className="flex flex-col">
                            <div className="font-medium text-gray-900">
                              {userProfile.full_name || '이름 없음'}
                            </div>
                            <div className="text-sm text-gray-500">{userProfile.email}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">
                            {userProfile.total_analysis_count}회
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {userProfile.last_analysis_at 
                            ? new Date(userProfile.last_analysis_at).toLocaleDateString('ko-KR', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '없음'
                          }
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {new Date(userProfile.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="p-4">
                          <Button
                            onClick={() => toggleAdminStatus(userProfile.id, userProfile.is_admin)}
                            variant={userProfile.is_admin ? "default" : "outline"}
                            size="sm"
                            className={userProfile.is_admin ? "bg-purple-600 hover:bg-purple-700" : ""}
                          >
                            {userProfile.is_admin ? (
                              <>
                                <Shield className="h-3 w-3 mr-1" />
                                관리자
                              </>
                            ) : (
                              '일반 사용자'
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
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