# Configuración en la consola de Firebase

Tu proyecto ya está configurado en código. Sigue estos pasos en la consola de Firebase para que todo funcione.

## 1. Autenticación (Authentication)

1. Entrá a [Firebase Console](https://console.firebase.google.com) → tu proyecto **web-mayoristas**
2. En el menú lateral: **Build** → **Authentication**
3. Clic en **Get started**
4. En **Sign-in method**, activá **Correo electrónico/contraseña**
5. Guardá los cambios

## 2. Firestore

Firestore ya debería estar creado si elegiste una región durante `firebase init`. Verificá:

1. **Build** → **Firestore Database**
2. Si pedís crear la base de datos, creala en la región que elegiste (ej: southamerica-east1)

Las colecciones se crean automáticamente cuando la app empiece a escribir datos:
- `users` – perfiles (cliente/admin, approved, descuentoBase, vendedorId)
- `razonesSociales`, `sucursales`, `expresos`
- `productos` – catálogo (admin los carga en Stock)
- `pedidos` – notas de pedido
- `vendedores` – para asignar a clientes (cargalos desde Admin si querés usarlos)

## 3. Storage

1. **Build** → **Storage**
2. Clic en **Get started**
3. Elegí las reglas que quieras (para producción vas a actualizar `storage.rules`)
4. Elegí la región (idealmente la misma que Firestore)

## 4. Crear el usuario administrador

El primer admin hay que crearlo manualmente:

1. **Authentication** → **Users** → **Add user**
2. Creá un usuario con email y contraseña (ej: admin@distribuidoramtf.com)
3. Copiá el **User UID**
4. Entrá a **Firestore** → **Start collection** → collection ID: `users`
5. Document ID: pegá el UID del usuario que creaste
6. Agregá estos campos:
   - `email` (string): el email del admin
   - `role` (string): `admin`
   - `approved` (boolean): `true`
   - `nombreEmpresa` (string): "Admin" (o lo que quieras)
7. Guardá

A partir de ahí, ese usuario podrá entrar a `/admin`.

## 5. Vendedores (opcional)

Si querés asignar vendedores a los clientes:

1. En Firestore, creá la colección `vendedores`
2. Agregá documentos con: `nombre`, `email` (o los campos que necesites)

## 6. Datos bancarios para el checkout

Los datos bancarios están en `src/pages/cliente/Checkout.jsx` en la constante `DATOS_BANCARIOS`. Actualizá CBU, alias y banco con los datos reales.

## 7. Reglas de seguridad

Las reglas de Firestore y Storage actuales son permisivas (para desarrollo). Antes de producción, actualizá:
- `firestore.rules`
- `storage.rules`

para restringir acceso según roles y aprobación.
