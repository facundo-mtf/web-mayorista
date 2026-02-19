import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '../firebase/config'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mostrarRecuperar, setMostrarRecuperar] = useState(false)
  const [emailRecuperar, setEmailRecuperar] = useState('')
  const [recuperarEnviado, setRecuperarEnviado] = useState(false)
  const [recuperarError, setRecuperarError] = useState('')
  const [recuperando, setRecuperando] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reasonDeleted = searchParams.get('reason') === 'deleted'
  const reasonBlocked = searchParams.get('reason') === 'blocked'
  const reasonTimeout = searchParams.get('reason') === 'timeout'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigate('/')
    } catch (err) {
      setError(err.code === 'auth/invalid-credential' ? 'Email o contraseña incorrectos' : err.message)
    } finally {
      setLoading(false)
    }
  }

  // Para que el correo no vaya a spam: en Firebase Console > Authentication > Templates >
  // "Restablecer contraseña" poné un asunto claro, ej: "Restablecer contraseña - Web Mayoristas"
  const handleRecuperar = async (e) => {
    e.preventDefault()
    setRecuperarError('')
    setRecuperando(true)
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/login',
        handleCodeInApp: false,
      }
      await sendPasswordResetEmail(auth, emailRecuperar, actionCodeSettings)
      setRecuperarEnviado(true)
    } catch (err) {
      setRecuperarError(err.code === 'auth/user-not-found'
        ? 'No existe una cuenta con ese email'
        : err.code === 'auth/invalid-email'
        ? 'Email inválido'
        : err.message)
    } finally {
      setRecuperando(false)
    }
  }

  const volverALogin = () => {
    setMostrarRecuperar(false)
    setEmailRecuperar('')
    setRecuperarEnviado(false)
    setRecuperarError('')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {mostrarRecuperar ? (
          <>
            <h1 className="auth-title">Recuperar contraseña</h1>
            <p className="auth-subtitle">Ingresá tu email y te enviamos un enlace seguro para restablecer tu contraseña.</p>
            {recuperarEnviado ? (
              <div className="auth-recuperar-exito">
                <p className="auth-recuperar-mensaje">Revisá tu bandeja de entrada (y la carpeta de spam). Te enviamos un enlace para restablecer tu contraseña.</p>
                <div className="auth-recuperar-botones">
                  <button type="button" className="btn btn-primary btn-block" onClick={volverALogin}>
                    Volver al inicio de sesión
                  </button>
                  <button type="button" className="btn btn-ghost btn-block" onClick={volverALogin}>
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRecuperar} className="auth-form">
                {recuperarError && <div className="alert alert-error">{recuperarError}</div>}
                <label>
                  Email
                  <input
                    type="email"
                    value={emailRecuperar}
                    onChange={(e) => setEmailRecuperar(e.target.value)}
                    placeholder="tu@empresa.com"
                    required
                    className="auth-input"
                  />
                </label>
                <div className="auth-form-buttons">
                  <button type="submit" className="btn btn-primary btn-block" disabled={recuperando}>
                    {recuperando ? 'Enviando...' : 'Enviar enlace de recuperación'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-block" onClick={volverALogin}>
                    Volver al login
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="auth-title">Web Mayoristas</h1>
            <p className="auth-subtitle">Ingresá a tu cuenta</p>
            <form onSubmit={handleSubmit} className="auth-form">
              {reasonDeleted && <div className="alert alert-error">Tu cuenta fue dada de baja. Contactá al administrador.</div>}
              {reasonBlocked && <div className="alert alert-error">Tu cuenta está bloqueada. Contactá al administrador.</div>}
              {reasonTimeout && <div className="alert alert-error">La sesión expiró por inactividad. Volvé a iniciar sesión.</div>}
              {error && <div className="alert alert-error">{error}</div>}
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  required
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? 'Ingresando...' : 'Ingresar'}
              </button>
            </form>
            <p className="auth-footer">
              <button
                type="button"
                className="auth-link-button"
                onClick={() => setMostrarRecuperar(true)}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </p>
            <p className="auth-footer">
              ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
