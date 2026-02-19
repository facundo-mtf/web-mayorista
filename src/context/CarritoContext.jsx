import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

const CarritoContext = createContext(null)

export function CarritoProvider({ children }) {
  const { user } = useAuth()
  const storageKey = user ? `carrito_${user.uid}` : 'carrito_anon'
  const [carrito, setCarritoState] = useState(() =>
    typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(storageKey) || '[]') : []
  )

  useEffect(() => {
    const key = user ? `carrito_${user.uid}` : 'carrito_anon'
    const data = JSON.parse(localStorage.getItem(key) || '[]')
    setCarritoState(data)
  }, [user?.uid])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(carrito))
    } catch (e) {
      console.warn('Carrito: no se pudo guardar en localStorage', e)
    }
  }, [carrito, storageKey])

  const setCarrito = useCallback((updater) => {
    setCarritoState((prev) => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

  return (
    <CarritoContext.Provider value={{ carrito, setCarrito }}>
      {children}
    </CarritoContext.Provider>
  )
}

export function useCarrito() {
  const ctx = useContext(CarritoContext)
  if (!ctx) throw new Error('useCarrito must be used within CarritoProvider')
  return ctx
}
