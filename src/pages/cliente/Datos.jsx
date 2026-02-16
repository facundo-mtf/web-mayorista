import { useState, useEffect } from 'react'
import { collection, query, where, addDoc, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

export default function Datos() {
  const { user, profile } = useAuth()
  const [razonesSociales, setRazonesSociales] = useState([])
  const [expresos, setExpresos] = useState([])
  const [activeTab, setActiveTab] = useState('razones')
  const [formRazon, setFormRazon] = useState({ razonSocial: '', cuit: '' })
  const [formSucursal, setFormSucursal] = useState({ razonSocialId: '', direccion: '', localidad: '', codigoPostal: '' })
  const [sucursalesSinRazon, setSucursalesSinRazon] = useState([])
  const [formExpreso, setFormExpreso] = useState({ nombre: '', direccionCABA: '', telefono: '' })
  const [formContacto, setFormContacto] = useState({ nombre: '', apellido: '', telefono: '', email: '' })
  const [guardandoContacto, setGuardandoContacto] = useState(false)
  const [contactoGuardadoOk, setContactoGuardadoOk] = useState(false)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'razonesSociales'), where('userId', '==', user.uid))
    const unsub = onSnapshot(q, (snap) => {
      setRazonesSociales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'expresos'), where('userId', '==', user.uid))
    const unsub = onSnapshot(q, (snap) => {
      setExpresos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  const [sucursales, setSucursales] = useState([])
  const razonIds = razonesSociales.map(r => r.id)
  useEffect(() => {
    if (!razonIds.length) { setSucursales([]); return }
    const q = query(
      collection(db, 'sucursales'),
      where('razonSocialId', 'in', razonIds.slice(0, 30))
    )
    const unsub = onSnapshot(q, (snap) => {
      setSucursales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [razonIds.join(',')])

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'sucursales'),
      where('userId', '==', user.uid),
      where('razonSocialId', '==', null)
    )
    const unsub = onSnapshot(q, (snap) => {
      setSucursalesSinRazon(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user?.uid])

  useEffect(() => {
    if (profile) {
      setFormContacto({
        nombre: profile.nombreContacto || '',
        apellido: profile.apellidoContacto || '',
        telefono: profile.telefonoContacto || '',
        email: profile.emailContacto || user?.email || '',
      })
    }
  }, [profile, user?.email])

  const addRazon = async (e) => {
    e.preventDefault()
    await addDoc(collection(db, 'razonesSociales'), {
      userId: user.uid,
      razonSocial: formRazon.razonSocial,
      cuit: formRazon.cuit || null,
    })
    setFormRazon({ razonSocial: '', cuit: '' })
  }

  const addSucursal = async (e) => {
    e.preventDefault()
    await addDoc(collection(db, 'sucursales'), {
      userId: user.uid,
      razonSocialId: formSucursal.razonSocialId || null,
      direccion: formSucursal.direccion,
      localidad: formSucursal.localidad,
      codigoPostal: formSucursal.codigoPostal || null,
    })
    setFormSucursal({ razonSocialId: '', direccion: '', localidad: '', codigoPostal: '' })
  }

  const addExpreso = async (e) => {
    e.preventDefault()
    await addDoc(collection(db, 'expresos'), {
      userId: user.uid,
      nombre: formExpreso.nombre,
      direccionCABA: formExpreso.direccionCABA,
      telefono: formExpreso.telefono || null,
    })
    setFormExpreso({ nombre: '', direccionCABA: '', telefono: '' })
  }

  const guardarContacto = async (e) => {
    e.preventDefault()
    if (!user) return
    setGuardandoContacto(true)
    setContactoGuardadoOk(false)
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        nombreContacto: formContacto.nombre || null,
        apellidoContacto: formContacto.apellido || null,
        telefonoContacto: formContacto.telefono || null,
        emailContacto: formContacto.email || null,
      })
      setContactoGuardadoOk(true)
      setTimeout(() => setContactoGuardadoOk(false), 3000)
    } finally {
      setGuardandoContacto(false)
    }
  }

  return (
    <div className="container page">
      <h1 className="page-title">Datos</h1>
      <p className="page-subtitle">Gestioná tus razones sociales, sucursales, expresos y datos de contacto.</p>

      <div className="tabs">
        <button className={activeTab === 'razones' ? 'active' : ''} onClick={() => setActiveTab('razones')}>
          Razones sociales
        </button>
        <button className={activeTab === 'sucursales' ? 'active' : ''} onClick={() => setActiveTab('sucursales')}>
          Sucursales
        </button>
        <button className={activeTab === 'expresos' ? 'active' : ''} onClick={() => setActiveTab('expresos')}>
          Expresos
        </button>
        <button className={activeTab === 'contacto' ? 'active' : ''} onClick={() => setActiveTab('contacto')}>
          Datos de contacto
        </button>
      </div>

      {activeTab === 'razones' && (
        <section className="entidades-section">
          <form onSubmit={addRazon} className="form-inline">
            <input
              placeholder="Razón social *"
              value={formRazon.razonSocial}
              onChange={(e) => setFormRazon({ ...formRazon, razonSocial: e.target.value })}
              required
            />
            <input
              placeholder="CUIT (opcional)"
              value={formRazon.cuit}
              onChange={(e) => setFormRazon({ ...formRazon, cuit: e.target.value })}
            />
            <button type="submit" className="btn btn-primary">Agregar</button>
          </form>
          <ul className="entidades-list">
            {razonesSociales.map(r => (
              <li key={r.id}><strong>{r.razonSocial}</strong> {r.cuit ? `— CUIT: ${r.cuit}` : ''}</li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'sucursales' && (
        <section className="entidades-section">
          <form onSubmit={addSucursal} className="form-stacked">
            <select
              value={formSucursal.razonSocialId}
              onChange={(e) => setFormSucursal({ ...formSucursal, razonSocialId: e.target.value })}
            >
              <option value="">Sin razón social</option>
              {razonesSociales.map(r => <option key={r.id} value={r.id}>{r.razonSocial}</option>)}
            </select>
            <input placeholder="Dirección *" value={formSucursal.direccion} onChange={(e) => setFormSucursal({ ...formSucursal, direccion: e.target.value })} required />
            <input placeholder="Localidad *" value={formSucursal.localidad} onChange={(e) => setFormSucursal({ ...formSucursal, localidad: e.target.value })} required />
            <input placeholder="CP" value={formSucursal.codigoPostal} onChange={(e) => setFormSucursal({ ...formSucursal, codigoPostal: e.target.value })} />
            <button type="submit" className="btn btn-primary">Agregar sucursal</button>
          </form>
          <ul className="entidades-list">
            {sucursalesSinRazon.map(s => (
              <li key={s.id}><em>Sin razón social</em> — {s.direccion}, {s.localidad}</li>
            ))}
            {sucursales.map(s => {
              const razon = razonesSociales.find(r => r.id === s.razonSocialId)
              return (
                <li key={s.id}>
                  <strong>{razon?.razonSocial}</strong> — {s.direccion}, {s.localidad}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {activeTab === 'expresos' && (
        <section className="entidades-section">
          <form onSubmit={addExpreso} className="form-inline">
            <input placeholder="Nombre del expreso *" value={formExpreso.nombre} onChange={(e) => setFormExpreso({ ...formExpreso, nombre: e.target.value })} required />
            <input placeholder="Dirección CABA *" value={formExpreso.direccionCABA} onChange={(e) => setFormExpreso({ ...formExpreso, direccionCABA: e.target.value })} required />
            <input placeholder="Teléfono" value={formExpreso.telefono} onChange={(e) => setFormExpreso({ ...formExpreso, telefono: e.target.value })} />
            <button type="submit" className="btn btn-primary">Agregar</button>
          </form>
          <ul className="entidades-list">
            {expresos.map(e => (
              <li key={e.id}><strong>{e.nombre}</strong> — {e.direccionCABA} {e.telefono ? `— ${e.telefono}` : ''}</li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'contacto' && (
        <section className="entidades-section">
          <form onSubmit={guardarContacto} className="form-stacked">
            <input
              placeholder="Nombre *"
              value={formContacto.nombre}
              onChange={(e) => setFormContacto({ ...formContacto, nombre: e.target.value })}
            />
            <input
              placeholder="Apellido *"
              value={formContacto.apellido}
              onChange={(e) => setFormContacto({ ...formContacto, apellido: e.target.value })}
            />
            <input
              type="tel"
              placeholder="Teléfono"
              value={formContacto.telefono}
              onChange={(e) => setFormContacto({ ...formContacto, telefono: e.target.value })}
            />
            <input
              type="email"
              placeholder="Email"
              value={formContacto.email}
              onChange={(e) => setFormContacto({ ...formContacto, email: e.target.value })}
            />
            <button type="submit" className="btn btn-primary" disabled={guardandoContacto}>
              {guardandoContacto ? 'Guardando...' : 'Guardar datos de contacto'}
            </button>
            {contactoGuardadoOk && <p className="hint success">Datos guardados</p>}
          </form>
          <p className="hint">Estos datos se usan para contactarte respecto a tus pedidos.</p>
        </section>
      )}
    </div>
  )
}
