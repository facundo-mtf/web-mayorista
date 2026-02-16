import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null)
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
    isApproved: profile?.approved === true,
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
