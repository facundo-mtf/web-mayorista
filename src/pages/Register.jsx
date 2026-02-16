import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'

export default function Register() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombreEmpresa: '',
    rubro: '',
    telefono: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await setDoc(doc(db, 'users', user.uid), {
        email: form.email,
        nombreEmpresa: form.nombreEmpresa,
        rubro: form.rubro,
        telefono: form.telefono || null,
        role: 'cliente',
        approved: false,
        createdAt: new Date(),
      })
      navigate('/pendiente')
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'Ese email ya está registrado' : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-subtitle">Completá tus datos para registrarte</p>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert-error">{error}</div>}
          <label>
            Email *
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Contraseña *
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
            />
          </label>
          <label>
            Nombre de la empresa *
            <input
              type="text"
              name="nombreEmpresa"
              value={form.nombreEmpresa}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Rubro *
            <input
              type="text"
              name="rubro"
              value={form.rubro}
              onChange={handleChange}
              placeholder="Ej: Alimentos, Bebidas..."
              required
            />
          </label>
          <label>
            Teléfono
            <input
              type="tel"
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrarse'}
          </button>
        </form>
        <p className="auth-footer">
          ¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
