import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const INACTIVITY_MS = 60 * 60 * 1000

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimerRef = useRef(null)

  useEffect(() => {
    if (!user) return
    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = setTimeout(() => {
        signOut(auth)
        if (typeof window !== 'undefined') window.location.href = '/login?reason=timeout'
      }, INACTIVITY_MS)
    }
    resetTimer()
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(ev => window.addEventListener(ev, resetTimer))
    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetTimer))
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [user])

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      setUser(firebaseUser)

      const unsubProfile = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          const data = snap.exists() ? { id: snap.id, ...snap.data() } : null
          if (data?.blocked === true || data?.deleted === true) {
            signOut(auth)
            setUser(null)
            setProfile(null)
            setLoading(false)
            if (typeof window !== 'undefined') {
              const reason = data?.deleted ? 'deleted' : 'blocked'
              window.location.href = `/login?reason=${reason}`
            }
            return
          }
          setProfile(data)
          setLoading(false)
        },
        () => {
          setProfile(null)
          setLoading(false)
        }
      )
      return () => unsubProfile()
    })

    return () => unsubAuth()
  }, [])

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isApproved: profile?.approved === true && !profile?.deleted,
    isDeleted: profile?.deleted === true,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
