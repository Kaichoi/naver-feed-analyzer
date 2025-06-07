'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/supabase'

interface AdminStats {
  totalUsers: number
  totalAnalyses: number
  todayAnalyses: number
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

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, totalAnalyses: 0, todayAnalyses: 0 })
  const [users, setUsers] = useState<UserProfile[]>([])

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        router.push('/login')
        return
      }

      try {
        const adminStatus = await db.isAdmin(user.id)
        if (!adminStatus) {
          router.push('/')
          return
        }
        setIsAdmin(true)
        await loadAdminData()
      } catch (error) {
        console.error('관리자 권한 확인 오류:', error)
        router.push('/')
      } finally {
        setIsChecking(false)
      }
    }

    if (!loading) {
      checkAdminStatus()
    }
  }, [user, loading, router])

  const loadAdminData = async () => {
    try {
      // 통계 로드 (여기서는 간단하게 구현, 실제로는 RPC 함수나 aggregate 쿼리 사용)
      const profiles = await db.getAllProfiles()
      
      const totalUsers = profiles.length
      const totalAnalyses = profiles.reduce((sum: number, p: UserProfile) => sum + p.total_analysis_count, 0)
      
      // 오늘 분석 횟수 계산
      const today = new Date().toISOString().split('T')[0]
      const todayAnalyses = profiles.filter((p: UserProfile) => 
        p.last_analysis_at && p.last_analysis_at.startsWith(today)
      ).length

      setStats({ totalUsers, totalAnalyses, todayAnalyses })
      setUsers(profiles)
    } catch (error) {
      console.error('관리자 데이터 로드 오류:', error)
    }
  }

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await db.updateProfile(userId, { is_admin: !currentStatus })
      await loadAdminData() // 데이터 새로고침
      alert(`관리자 권한이 ${!currentStatus ? '부여' : '해제'}되었습니다.`)
    } catch (error) {
      console.error('관리자 권한 변경 오류:', error)
      alert('권한 변경 중 오류가 발생했습니다.')
    }
  }

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
    return null // 이미 리다이렉트 처리됨
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
          <p className="mt-2 text-gray-600">시스템 통계 및 사용자 관리</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">총 사용자</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.totalUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">총 분석 횟수</h3>
            <p className="text-3xl font-bold text-green-600">{stats.totalAnalyses}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900">오늘 분석</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.todayAnalyses}</p>
          </div>
        </div>

        {/* 사용자 목록 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">사용자 관리</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    분석 횟수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    마지막 분석
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    가입일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관리자 권한
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-900">
                          {user.full_name || '이름 없음'}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.total_analysis_count}회
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.last_analysis_at 
                        ? new Date(user.last_analysis_at).toLocaleDateString('ko-KR')
                        : '없음'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(user.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleAdminStatus(user.id, user.is_admin)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          user.is_admin
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.is_admin ? '관리자' : '일반 사용자'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
} 