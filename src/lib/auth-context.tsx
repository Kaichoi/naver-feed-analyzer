'use client'

// Force rebuild - 타임아웃 완전 제거됨
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

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
      if (!supabase) {
        setUser(null)
        return
      }

      // 직접 세션 확인 (타임아웃 없음)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user as User)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.warn('사용자 새로고침 오류:', error)
      setUser(null)
    }
  }

  const signOut = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut()
      }
      setUser(null)
    } catch (error) {
      console.error('로그아웃 오류:', error)
      setUser(null) // 에러가 나도 로컬 상태는 정리
    }
  }

  useEffect(() => {
    let mounted = true
    
    // 즉시 세션 확인 (타임아웃 없음)
    const initializeAuth = async () => {
      if (!mounted) return
      
      try {
        await refreshUser()
      } catch (error) {
        console.warn('인증 초기화 오류:', error)
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
    const { data: { subscription } } = supabase?.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)
        
        if (!mounted) return
        
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user as User)
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user as User)
        }
      }
    ) || { data: { subscription: { unsubscribe: () => {} } } }

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