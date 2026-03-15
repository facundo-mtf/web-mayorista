import { Link } from 'react-router-dom'
import WhatsAppFab from '../components/WhatsAppFab'

export default function Landing() {
  return (
    <div className="landing">
      <video
        src="/landing-video.mp4"
        className="landing-video-bg"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="landing-overlay" />
      <div className="landing-content">
        <img src="/logos/polesie.png" alt="Polesie" className="landing-logo" />
        <h1 className="landing-title">Compra mayorista juguetes Polesie Argentina</h1>
        <p className="landing-leyenda">Registrate por única vez para ver el catálogo y lista de precios.</p>
        <p className="landing-extra">También encontrarás ofertas, descuentos y material digital para redes sociales.</p>
        <div className="landing-cta">
          <Link to="/registro" className="btn btn-primary btn-lg landing-btn">
            Registrarse
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg landing-btn">
            Iniciar sesión
          </Link>
        </div>
      </div>
      <WhatsAppFab />
    </div>
  )
}
