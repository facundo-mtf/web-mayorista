import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyD3ilwHMaFcQ1t7IwgRkFqYttV8UaXC_Y4",
  authDomain: "web-mayoristas.firebaseapp.com",
  projectId: "web-mayoristas",
  storageBucket: "web-mayoristas.firebasestorage.app",
  messagingSenderId: "637184489427",
  appId: "1:637184489427:web:e4f68fd369acf687926126",
  measurementId: "G-K0C2FYWBQP"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

// Conectar a emuladores en desarrollo
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099')
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

export default app
