'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { auth } from './supabase'

interface User {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const currentUser = await auth.getCurrentUser()
      setUser(currentUser)
    } catch (error) {
      console.error('사용자 새로고침 오류:', error)
      setUser(null)
    }
  }

  const signOut = async () => {
    try {
      await auth.signOut()
      setUser(null)
    } catch (error) {
      console.error('로그아웃 오류:', error)
    }
  }

  useEffect(() => {
    let mounted = true
    
    // 초기 세션 확인 (타임아웃 설정)
    const initializeAuth = async () => {
      try {
        // 5초 타임아웃 설정
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Authentication timeout')), 5000)
        )
        
        const authPromise = refreshUser()
        
        await Promise.race([authPromise, timeoutPromise])
      } catch (error) {
        console.error('인증 초기화 오류:', error)
        if (mounted) {
          setUser(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // 인증 상태 변경 리스너
    const { data: { subscription } } = auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session)
        
        if (!mounted) return
        
        if (event === 'SIGNED_IN') {
          setLoading(true)
          await refreshUser()
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED') {
          await refreshUser()
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = {
    user,
    loading,
    signOut,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 