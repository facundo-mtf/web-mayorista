import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, query, where, addDoc, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { PROVINCIAS_ARGENTINA } from '../../data/provinciasArgentina'
import { fetchLocalidades } from '../../utils/georefApi'

const CONDICIONES_FISCALES = [
  { value: 'responsable_inscripto', label: 'Responsable inscripto' },
  { value: 'autonomo', label: 'Autónomo' },
  { value: 'monotributista', label: 'Monotributista' },
  { value: 'exento', label: 'Exento' },
  { value: 'no_alcanzado', label: 'No alcanzado' },
]

export default function Datos() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromRegister = location.state?.fromRegister === true

  const [razonesSociales, setRazonesSociales] = useState([])
  const [expresos, setExpresos] = useState([])
  const [activeTab, setActiveTab] = useState('razones')
  const [formRazon, setFormRazon] = useState({
    razonSocial: '',
    cuit: '',
    condicionFiscal: '',
    calle: '',
    numero: '',
    localidad: '',
    provincia: '',
    provinciaId: '',
    codigoPostal: '',
  })
  const [formSucursal, setFormSucursal] = useState({
    razonSocialId: '',
    razonSocial: '',
    calle: '',
    numero: '',
    localidad: '',
    provincia: '',
    provinciaId: '',
    codigoPostal: '',
  })
  const [localidadesRazon, setLocalidadesRazon] = useState([])
  const [localidadesSucursal, setLocalidadesSucursal] = useState([])
  const [loadingLocalRazon, setLoadingLocalRazon] = useState(false)
  const [loadingLocalSucursal, setLoadingLocalSucursal] = useState(false)
  const [sucursalesSinRazon, setSucursalesSinRazon] = useState([])
  const [formExpreso, setFormExpreso] = useState({ nombre: '', direccionCABA: '', telefono: '' })
  const [mismoCompraQuePaga, setMismoCompraQuePaga] = useState(true)
  const [formCompra, setFormCompra] = useState({ nombre: '', apellido: '', telefono: '', email: '' })
  const [formPago, setFormPago] = useState({ nombre: '', apellido: '', telefono: '', email: '' })
  const [guardandoContacto, setGuardandoContacto] = useState(false)
  const [contactoGuardadoOk, setContactoGuardadoOk] = useState(false)
  const [editRazonId, setEditRazonId] = useState(null)
  const [editSucursalId, setEditSucursalId] = useState(null)
  const [editExpresoId, setEditExpresoId] = useState(null)

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
    if (formRazon.provinciaId) {
      setLoadingLocalRazon(true)
      fetchLocalidades(formRazon.provinciaId).then(locs => {
        setLocalidadesRazon(locs)
        setLoadingLocalRazon(false)
      })
    } else {
      setLocalidadesRazon([])
    }
  }, [formRazon.provinciaId])

  useEffect(() => {
    if (formSucursal.provinciaId) {
      setLoadingLocalSucursal(true)
      fetchLocalidades(formSucursal.provinciaId).then(locs => {
        setLocalidadesSucursal(locs)
        setLoadingLocalSucursal(false)
      })
    } else {
      setLocalidadesSucursal([])
    }
  }, [formSucursal.provinciaId])

  useEffect(() => {
    if (profile) {
      const compra = {
        nombre: profile.nombreCompra ?? profile.nombreContacto ?? '',
        apellido: profile.apellidoCompra ?? profile.apellidoContacto ?? '',
        telefono: profile.telefonoCompra ?? profile.telefonoContacto ?? '',
        email: profile.emailCompra ?? profile.emailContacto ?? user?.email ?? '',
      }
      const pago = {
        nombre: profile.nombrePago ?? profile.nombreContacto ?? '',
        apellido: profile.apellidoPago ?? profile.apellidoContacto ?? '',
        telefono: profile.telefonoPago ?? profile.telefonoContacto ?? '',
        email: profile.emailPago ?? profile.emailContacto ?? user?.email ?? '',
      }
      setFormCompra(compra)
      setFormPago(pago)
      setMismoCompraQuePaga(profile.mismoCompraQuePaga !== false)
    }
  }, [profile, user?.email])

  useEffect(() => {
    if (mismoCompraQuePaga) setFormPago({ ...formCompra })
  }, [mismoCompraQuePaga])

  const formPagoEfectivo = mismoCompraQuePaga ? formCompra : formPago

  const addRazon = async (e) => {
    e.preventDefault()
    const dir = {
      calle: formRazon.calle || null,
      numero: formRazon.numero || null,
      localidad: formRazon.localidad || null,
      provincia: formRazon.provincia || null,
      codigoPostal: formRazon.codigoPostal || null,
    }
    const payload = {
      userId: user.uid,
      razonSocial: formRazon.razonSocial,
      cuit: formRazon.cuit || null,
      condicionFiscal: formRazon.condicionFiscal || null,
      direccionFacturacion: dir,
    }
    if (editRazonId) {
      await updateDoc(doc(db, 'razonesSociales', editRazonId), payload)
      setEditRazonId(null)
    } else {
      await addDoc(collection(db, 'razonesSociales'), payload)
    }
    setFormRazon({ razonSocial: '', cuit: '', condicionFiscal: '', calle: '', numero: '', localidad: '', provincia: '', provinciaId: '', codigoPostal: '' })
  }

  const cargarRazonParaEditar = (r) => {
    const d = r.direccionFacturacion || {}
    setFormRazon({
      razonSocial: r.razonSocial || '',
      cuit: r.cuit || '',
      condicionFiscal: r.condicionFiscal || '',
      calle: d.calle || '',
      numero: d.numero || '',
      localidad: d.localidad || '',
      provincia: d.provincia || '',
      provinciaId: PROVINCIAS_ARGENTINA.find(p => p.nombre === d.provincia)?.id || '',
      codigoPostal: d.codigoPostal || '',
    })
    setEditRazonId(r.id)
  }

  const addSucursal = async (e) => {
    e.preventDefault()
    const payload = {
      userId: user.uid,
      razonSocialId: formSucursal.razonSocialId || null,
      razonSocial: formSucursal.razonSocial || null,
      calle: formSucursal.calle,
      numero: formSucursal.numero || null,
      localidad: formSucursal.localidad,
      provincia: formSucursal.provincia || null,
      codigoPostal: formSucursal.codigoPostal || null,
      direccion: `${formSucursal.calle || ''} ${formSucursal.numero || ''}`.trim() || formSucursal.calle,
    }
    if (editSucursalId) {
      await updateDoc(doc(db, 'sucursales', editSucursalId), payload)
      setEditSucursalId(null)
    } else {
      await addDoc(collection(db, 'sucursales'), payload)
    }
    setFormSucursal({ razonSocialId: '', razonSocial: '', calle: '', numero: '', localidad: '', provincia: '', provinciaId: '', codigoPostal: '' })
  }

  const cargarSucursalParaEditar = (s) => {
    const r = razonesSociales.find(x => x.id === s.razonSocialId)
    setFormSucursal({
      razonSocialId: s.razonSocialId || '',
      razonSocial: r?.razonSocial || s.razonSocial || '',
      calle: s.calle || '',
      numero: s.numero || '',
      localidad: s.localidad || '',
      provincia: s.provincia || '',
      provinciaId: PROVINCIAS_ARGENTINA.find(p => p.nombre === s.provincia)?.id || '',
      codigoPostal: s.codigoPostal || '',
    })
    setEditSucursalId(s.id)
  }

  const addExpreso = async (e) => {
    e.preventDefault()
    const payload = {
      userId: user.uid,
      nombre: formExpreso.nombre,
      direccionCABA: formExpreso.direccionCABA,
      telefono: formExpreso.telefono || null,
    }
    if (editExpresoId) {
      await updateDoc(doc(db, 'expresos', editExpresoId), payload)
      setEditExpresoId(null)
    } else {
      await addDoc(collection(db, 'expresos'), payload)
    }
    setFormExpreso({ nombre: '', direccionCABA: '', telefono: '' })
  }

  const cargarExpresoParaEditar = (e) => {
    setFormExpreso({
      nombre: e.nombre || '',
      direccionCABA: e.direccionCABA || '',
      telefono: e.telefono || '',
    })
    setEditExpresoId(e.id)
  }

  const guardarContacto = async (e) => {
    e.preventDefault()
    if (!user) return
    setGuardandoContacto(true)
    setContactoGuardadoOk(false)
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        nombreCompra: formCompra.nombre || null,
        apellidoCompra: formCompra.apellido || null,
        telefonoCompra: formCompra.telefono || null,
        emailCompra: formCompra.email || null,
        nombrePago: formPagoEfectivo.nombre || null,
        apellidoPago: formPagoEfectivo.apellido || null,
        telefonoPago: formPagoEfectivo.telefono || null,
        emailPago: formPagoEfectivo.email || null,
        mismoCompraQuePaga,
        nombreContacto: formCompra.nombre || null,
        apellidoContacto: formCompra.apellido || null,
        telefonoContacto: formCompra.telefono || null,
        emailContacto: formCompra.email || null,
      })
      setContactoGuardadoOk(true)
      setTimeout(() => setContactoGuardadoOk(false), 3000)
      const completo = !!(formCompra.nombre && formCompra.apellido && formCompra.telefono && formCompra.email &&
        formPagoEfectivo.nombre && formPagoEfectivo.apellido && formPagoEfectivo.telefono && formPagoEfectivo.email)
      if (completo) {
        setTimeout(() => navigate('/catalogo'), 1500)
      }
    } finally {
      setGuardandoContacto(false)
    }
  }

  const contactoCompleto = !!(
    formCompra.nombre && formCompra.apellido && formCompra.telefono && formCompra.email &&
    formPagoEfectivo.nombre && formPagoEfectivo.apellido && formPagoEfectivo.telefono && formPagoEfectivo.email
  )

  const formatDirFact = (r) => {
    if (!r?.direccionFacturacion) return ''
    const d = r.direccionFacturacion
    const parts = [d.calle, d.numero, d.localidad, d.provincia, d.codigoPostal].filter(Boolean)
    return parts.join(', ')
  }

  const formatSucursal = (s) => {
    const parts = [s.calle, s.numero, s.localidad, s.provincia, s.codigoPostal].filter(Boolean)
    if (parts.length) return parts.join(', ')
    return s.direccion ? `${s.direccion}, ${s.localidad || ''}`.trim() : '-'
  }

  return (
    <div className="container page">
      <h1 className="page-title">Datos</h1>
      {fromRegister && (
        <div className="datos-alerta-registro" role="alert">
          Por favor completá todos los datos necesarios para poder hacer pedidos.
        </div>
      )}
      {!contactoCompleto && !fromRegister && (
        <p className="datos-prompt">Para poder realizar pedidos completá los siguientes datos.</p>
      )}
      <p className="page-subtitle">Gestioná tus razones sociales, sucursales de entrega, expresos y datos de contacto.</p>

      <div className="tabs">
        <button className={activeTab === 'razones' ? 'active' : ''} onClick={() => setActiveTab('razones')}>
          Razones sociales
        </button>
        <button className={activeTab === 'sucursales' ? 'active' : ''} onClick={() => setActiveTab('sucursales')}>
          Sucursales de entrega
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
          <form onSubmit={addRazon} className="form-stacked datos-form-razon">
            <h3>Agregar razón social</h3>
            <input placeholder="Razón social *" value={formRazon.razonSocial} onChange={(e) => setFormRazon({ ...formRazon, razonSocial: e.target.value })} required />
            <input placeholder="CUIT o CUIL" value={formRazon.cuit} onChange={(e) => setFormRazon({ ...formRazon, cuit: e.target.value })} />
            <select value={formRazon.condicionFiscal} onChange={(e) => setFormRazon({ ...formRazon, condicionFiscal: e.target.value })}>
              <option value="">Condición fiscal (opcional)</option>
              {CONDICIONES_FISCALES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <h4>Dirección de facturación</h4>
            <div className="form-row">
              <input placeholder="Calle *" value={formRazon.calle} onChange={(e) => setFormRazon({ ...formRazon, calle: e.target.value })} />
              <input placeholder="Número" value={formRazon.numero} onChange={(e) => setFormRazon({ ...formRazon, numero: e.target.value })} style={{ maxWidth: 100 }} />
            </div>
            <div className="form-row">
              <select
                value={formRazon.provinciaId}
                onChange={(e) => {
                  const id = e.target.value
                  const prov = PROVINCIAS_ARGENTINA.find(p => p.id === id)
                  setFormRazon({ ...formRazon, provinciaId: id, provincia: prov?.nombre || '', localidad: '' })
                }}
              >
                <option value="">Provincia</option>
                {PROVINCIAS_ARGENTINA.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
              <select
                value={formRazon.localidad}
                onChange={(e) => setFormRazon({ ...formRazon, localidad: e.target.value })}
                disabled={!formRazon.provinciaId || loadingLocalRazon}
                required
              >
                <option value="">{loadingLocalRazon ? 'Cargando...' : 'Localidad *'}</option>
                {localidadesRazon.map(l => <option key={l.id} value={l.nombre}>{l.nombre}</option>)}
              </select>
              <input placeholder="Código postal" value={formRazon.codigoPostal} onChange={(e) => setFormRazon({ ...formRazon, codigoPostal: e.target.value })} style={{ maxWidth: 120 }} />
            </div>
            <button type="submit" className="btn btn-primary">{editRazonId ? 'Guardar cambios' : 'Agregar razón social'}</button>
            {editRazonId && <button type="button" className="btn btn-ghost" onClick={() => { setEditRazonId(null); setFormRazon({ razonSocial: '', cuit: '', condicionFiscal: '', calle: '', numero: '', localidad: '', provincia: '', provinciaId: '', codigoPostal: '' }); }}>Cancelar</button>}
          </form>
          <ul className="entidades-list">
            {razonesSociales.map(r => (
              <li key={r.id} className="entidades-list-item">
                <span><strong>{r.razonSocial}</strong>
                {r.cuit && ` — CUIT: ${r.cuit}`}
                {r.condicionFiscal && ` — ${CONDICIONES_FISCALES.find(c => c.value === r.condicionFiscal)?.label || r.condicionFiscal}`}
                {formatDirFact(r) && ` — ${formatDirFact(r)}`}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cargarRazonParaEditar(r)}>Editar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'sucursales' && (
        <section className="entidades-section">
          <form onSubmit={addSucursal} className="form-stacked datos-form-sucursal">
            <h3>Agregar sucursal o domicilio de entrega</h3>
            <select value={formSucursal.razonSocialId} onChange={(e) => {
                const rid = e.target.value
                const r = rid ? razonesSociales.find(x => x.id === rid) : null
                setFormSucursal({ ...formSucursal, razonSocialId: rid, razonSocial: r?.razonSocial || '' })
              }}>
              <option value="">Sin razón social</option>
              {razonesSociales.map(r => <option key={r.id} value={r.id}>{r.razonSocial}</option>)}
            </select>
            <input placeholder="Calle *" value={formSucursal.calle} onChange={(e) => setFormSucursal({ ...formSucursal, calle: e.target.value })} required />
            <input placeholder="Número" value={formSucursal.numero} onChange={(e) => setFormSucursal({ ...formSucursal, numero: e.target.value })} style={{ maxWidth: 100 }} />
            <select
              value={formSucursal.provinciaId}
              onChange={(e) => {
                const id = e.target.value
                const prov = PROVINCIAS_ARGENTINA.find(p => p.id === id)
                setFormSucursal({ ...formSucursal, provinciaId: id, provincia: prov?.nombre || '', localidad: '' })
              }}
            >
              <option value="">Provincia</option>
              {PROVINCIAS_ARGENTINA.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <select
              value={formSucursal.localidad}
              onChange={(e) => setFormSucursal({ ...formSucursal, localidad: e.target.value })}
              disabled={!formSucursal.provinciaId || loadingLocalSucursal}
              required
            >
              <option value="">{loadingLocalSucursal ? 'Cargando...' : 'Localidad *'}</option>
              {localidadesSucursal.map(l => <option key={l.id} value={l.nombre}>{l.nombre}</option>)}
            </select>
            <input placeholder="Código postal" value={formSucursal.codigoPostal} onChange={(e) => setFormSucursal({ ...formSucursal, codigoPostal: e.target.value })} />
            <button type="submit" className="btn btn-primary">{editSucursalId ? 'Guardar cambios' : 'Agregar sucursal'}</button>
            {editSucursalId && <button type="button" className="btn btn-ghost" onClick={() => { setEditSucursalId(null); setFormSucursal({ razonSocialId: '', razonSocial: '', calle: '', numero: '', localidad: '', provincia: '', provinciaId: '', codigoPostal: '' }); }}>Cancelar</button>}
          </form>
          <ul className="entidades-list">
            {sucursalesSinRazon.map(s => (
              <li key={s.id} className="entidades-list-item">
                <span><em>Sin razón social</em> — {formatSucursal(s)}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cargarSucursalParaEditar(s)}>Editar</button>
              </li>
            ))}
            {sucursales.map(s => {
              const razon = razonesSociales.find(r => r.id === s.razonSocialId)
              return (
                <li key={s.id} className="entidades-list-item">
                  <span><strong>{razon?.razonSocial || s.razonSocial || 'Sin razón'}</strong> — {formatSucursal(s)}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => cargarSucursalParaEditar(s)}>Editar</button>
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
            <button type="submit" className="btn btn-primary">{editExpresoId ? 'Guardar cambios' : 'Agregar'}</button>
            {editExpresoId && <button type="button" className="btn btn-ghost" onClick={() => { setEditExpresoId(null); setFormExpreso({ nombre: '', direccionCABA: '', telefono: '' }); }}>Cancelar</button>}
          </form>
          <ul className="entidades-list">
            {expresos.map(e => (
              <li key={e.id} className="entidades-list-item">
                <span><strong>{e.nombre}</strong> — {e.direccionCABA} {e.telefono ? `— ${e.telefono}` : ''}</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => cargarExpresoParaEditar(e)}>Editar</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === 'contacto' && (
        <section className="entidades-section">
          <form onSubmit={guardarContacto} className="form-stacked">
            <label className="checkbox-label datos-checkbox-mismo">
              <input type="checkbox" checked={mismoCompraQuePaga} onChange={(e) => setMismoCompraQuePaga(e.target.checked)} />
              ¿Es la misma persona quien compra y quien paga?
            </label>

            <div className="datos-contacto-grid">
              <div className="datos-contacto-block">
                <h4>Datos de quien compra</h4>
                <input placeholder="Nombre *" value={formCompra.nombre} onChange={(e) => setFormCompra({ ...formCompra, nombre: e.target.value })} />
                <input placeholder="Apellido *" value={formCompra.apellido} onChange={(e) => setFormCompra({ ...formCompra, apellido: e.target.value })} />
                <input type="tel" placeholder="Teléfono WhatsApp *" value={formCompra.telefono} onChange={(e) => setFormCompra({ ...formCompra, telefono: e.target.value })} />
                <input type="email" placeholder="Email *" value={formCompra.email} onChange={(e) => setFormCompra({ ...formCompra, email: e.target.value })} />
              </div>
              <div className="datos-contacto-block">
                <h4>Datos de quien paga</h4>
                <input placeholder="Nombre *" value={formPagoEfectivo.nombre} onChange={(e) => setFormPago({ ...formPago, nombre: e.target.value })} disabled={mismoCompraQuePaga} />
                <input placeholder="Apellido *" value={formPagoEfectivo.apellido} onChange={(e) => setFormPago({ ...formPago, apellido: e.target.value })} disabled={mismoCompraQuePaga} />
                <input type="tel" placeholder="Teléfono WhatsApp *" value={formPagoEfectivo.telefono} onChange={(e) => setFormPago({ ...formPago, telefono: e.target.value })} disabled={mismoCompraQuePaga} />
                <input type="email" placeholder="Email *" value={formPagoEfectivo.email} onChange={(e) => setFormPago({ ...formPago, email: e.target.value })} disabled={mismoCompraQuePaga} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={guardandoContacto}>
              {guardandoContacto ? 'Guardando...' : 'Guardar datos de contacto'}
            </button>
            {contactoGuardadoOk && <p className="hint success">Datos guardados</p>}
          </form>
        </section>
      )}
    </div>
  )
}
