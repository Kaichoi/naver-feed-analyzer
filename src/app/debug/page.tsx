'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function DebugPage() {
  const { user, loading } = useAuth()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const checkCurrentUser = async () => {
    if (!user) return

    setIsLoading(true)
    try {
      // 현재 사용자 프로필 조회
      const profile = await db.getProfile(user.id)
      
      // 모든 프로필 조회 (관리자 권한 불필요)
      const allProfiles = await db.getAllProfiles()
      
      setDebugInfo({
        currentUser: {
          id: user.id,
          email: user.email,
          metadata: user.user_metadata
        },
        currentProfile: profile,
        allProfiles: allProfiles,
        summary: {
          totalProfiles: allProfiles.length,
          adminCount: allProfiles.filter(p => p.is_admin).length,
          isCurrentUserAdmin: profile?.is_admin || false
        }
      })
    } catch (error) {
      console.error('디버깅 정보 조회 오류:', error)
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setIsLoading(false)
    }
  }

  const makeCurrentUserAdmin = async () => {
    if (!user) return

    try {
      await db.updateProfile(user.id, { is_admin: true })
      alert('현재 사용자에게 관리자 권한을 부여했습니다!')
      await checkCurrentUser() // 정보 새로고침
    } catch (error) {
      console.error('관리자 권한 부여 오류:', error)
      alert('권한 부여 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  useEffect(() => {
    if (!loading && user) {
      checkCurrentUser()
    }
  }, [user, loading])

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

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-gray-600">로그인이 필요합니다.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>🔍 디버깅 페이지</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={checkCurrentUser} disabled={isLoading}>
              {isLoading ? '로딩 중...' : '정보 새로고침'}
            </Button>
            
            {debugInfo && !debugInfo.error && (
              <Button 
                onClick={makeCurrentUserAdmin}
                variant="outline"
                className="ml-2"
                disabled={debugInfo.summary?.isCurrentUserAdmin}
              >
                {debugInfo.summary?.isCurrentUserAdmin ? '이미 관리자입니다' : '관리자 권한 부여'}
              </Button>
            )}
          </CardContent>
        </Card>

        {debugInfo?.error ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">오류 발생</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-600">{debugInfo.error}</p>
            </CardContent>
          </Card>
        ) : debugInfo ? (
          <div className="space-y-6">
            {/* 요약 정보 */}
            <Card>
              <CardHeader>
                <CardTitle>📊 요약 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{debugInfo.summary.totalProfiles}</p>
                    <p className="text-sm text-gray-600">총 프로필 수</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{debugInfo.summary.adminCount}</p>
                    <p className="text-sm text-gray-600">관리자 수</p>
                  </div>
                  <div className={`rounded-lg p-4 text-center ${debugInfo.summary.isCurrentUserAdmin ? 'bg-green-50' : 'bg-orange-50'}`}>
                    <p className={`text-2xl font-bold ${debugInfo.summary.isCurrentUserAdmin ? 'text-green-600' : 'text-orange-600'}`}>
                      {debugInfo.summary.isCurrentUserAdmin ? '관리자' : '일반사용자'}
                    </p>
                    <p className="text-sm text-gray-600">현재 사용자 권한</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 현재 사용자 정보 */}
            <Card>
              <CardHeader>
                <CardTitle>👤 현재 사용자 정보</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify(debugInfo.currentUser, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* 현재 사용자 프로필 */}
            <Card>
              <CardHeader>
                <CardTitle>📝 현재 사용자 프로필</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify(debugInfo.currentProfile, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>

            {/* 모든 프로필 목록 */}
            <Card>
              <CardHeader>
                <CardTitle>👥 모든 프로필 목록</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {debugInfo.allProfiles.map((profile: any, index: number) => (
                    <div key={profile.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{profile.email}</p>
                          <p className="text-sm text-gray-600">
                            분석 {profile.total_analysis_count}회 • 
                            가입일: {new Date(profile.created_at).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`px-2 py-1 rounded text-xs ${
                            profile.is_admin 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {profile.is_admin ? '관리자' : '일반사용자'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">데이터 로딩 중...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 