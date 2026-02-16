# Plan de Desarrollo: Aplicación Web B2B - Pedidos Mayoristas

Este archivo sirve como base de contexto para el desarrollo de una plataforma de toma de pedidos mayoristas. El sistema permite a los clientes gestionar múltiples razones sociales y sucursales, con una lógica de descuentos dinámica y validación de pagos.

## 1. Arquitectura de Usuarios y Permisos
- **Registro:** El cliente puede registrarse sin CUIT (solo Rubro y datos de contacto son obligatorios).
- **Validación:** El Administrador debe aprobar la cuenta antes de que el cliente pueda ver precios o stock.
- **Vendedores:** El Administrador asigna un Vendedor específico a cada Cliente.

## 2. Modelo de Datos (Relacional)
- **Usuario (Padre):** Posee un Descuento BASE (asignado por Admin) y un Vendedor.
- **Razones Sociales (Hijos):** Un Usuario puede tener múltiples CUITs/Razones Sociales.
- **Sucursales (Nietos):** Cada Razón Social puede tener múltiples direcciones de entrega.
- **Expresos:** El cliente carga sus propios transportes (Nombre, Dirección CABA, Teléfono).

## 3. Lógica de Descuentos y Precios
El cálculo es lineal e independiente de la condición fiscal:
1. **Precio de Lista:** Base.
2. **Precio con Descuento BASE:** `Precio Lista - % Descuento BASE` (fijo por el Admin).
3. **Pronto Pago:** Si el cliente elige "Transferencia" o "Mercado Pago", se aplica un **10% adicional** sobre el precio ya descontado.

## 4. Proceso de Checkout y Validaciones
El cliente debe completar 5 selectores para finalizar la Nota de Pedido:
1. **Razón Social:** (Quién compra).
2. **Sucursal:** (A dónde se envía).
3. **Condición de Compra:** (A, A 1/2, R).
   - *Regla:* Si elige **A** o **A 1/2**, el CUIT es **obligatorio**. Si no existe, debe pedirle cargarlo.
4. **Logística:** Seleccionar Expreso para despacho en CABA.
5. **Forma de Pago:**
   - **Transferencia / Mercado Pago:** Muestra datos bancarios y **exige** subir una imagen/PDF de comprobante para habilitar el botón "Finalizar".
   - **Acuerdo con Vendedor:** Oculta datos bancarios y no aplica el 10% de pronto pago.

## 5. Panel de Administración
- Aprobación de nuevos usuarios.
- Asignación de % Descuento BASE y Vendedor.
- Visualización de Notas de Pedido con acceso al archivo del comprobante adjunto.
- Gestión de Stock (lo que el cliente ve en el catálogo).

## 6. Stack Tecnológico Sugerido
- **Frontend:** React.js / Next.js (para el panel de cliente y admin).
- **Backend:** Node.js / Python (FastAPI o Django).
- **Base de Datos:** PostgreSQL (por su naturaleza relacional para manejar Razones Sociales/Sucursales).