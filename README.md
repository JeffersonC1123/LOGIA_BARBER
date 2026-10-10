# 💈 Barbería Pro - Sistema Web de Gestión de Citas y Cobros

Demostración completa y funcional de un sistema web integral para la gestión de citas, servicios, agenda de barberos, cobros y administración en una barbería moderna.

---

## 🌟 Características Principales y Arquitectura

* **Diseño Moderno y Responsivo:** Tema oscuro con finos detalles en dorado (*Dark & Gold*), adaptado para pantallas de escritorio, tablets y dispositivos móviles.
* **Backend Robusto y Seguro:** Construido sobre **Node.js** y **Express** con arquitectura RESTful.
* **Base de Datos Relacional Persistente:** **SQLite** utilizando el driver ultrarrápido y seguro `better-sqlite3`.
* **Protección Anti-Solapamiento Atómica (RF-005):** Transacciones atómicas a nivel de base de datos para impedir citas simultáneas cruzadas para el mismo barbero, incluso ante peticiones simultáneas concurrentes.
* **Autenticación y Seguridad (RBAC - RNF-003):** Contraseñas encriptadas mediante **bcryptjs** y sesiones seguras basadas en **JSON Web Tokens (JWT)** con control estricto de acceso por roles.

---

## 👥 Matriz de Roles y Cuentas Ficticias de Prueba

El sistema implementa cuatro roles independientes. Puedes iniciar sesión utilizando las siguientes credenciales pre-pobladas o creando nuevas cuentas desde la interfaz:

| Rol | Correo Electrónico | Contraseña | Funciones Permitidas |
|---|---|---|---|
| **Administrador** | `admin@barberiapro.com` | `Admin123!` | Control total: Métricas/Dashboard, Gestión CRUD de servicios, barberos, usuarios, citas y reportes de ingresos. |
| **Barbero** | `carlos@barberiapro.com` | `Barbero123!` | Consultar agenda asignada, filtrar por fechas y actualizar estados de citas (*Pendiente*, *Confirmada*, *En Proceso*, *Completada*, *Cancelada*). |
| **Personal Autorizado (Caja/Recepción)** | `recepcion@barberiapro.com` | `Personal123!` | Ver todas las citas de la barbería, registrar pagos de clientes, seleccionar método de pago (*Efectivo*, *Tarjeta*, *Transferencia*) y auditar transacciones. |
| **Cliente** | `juan@gmail.com` | `Cliente123!` | Explorar catálogo de servicios, ver barberos y horarios disponibles, agendar citas en tiempo real y cancelar citas propias. |

> ⚡ **Demo de 1 Clic:** En la pantalla principal de la aplicación encontrarás **Botones de Acceso Rápido** para iniciar sesión en cualquier rol con un solo clic.

---

## 📋 Cumplimiento de Requisitos Funcionales (RF)

* **RF-001 (Registro e Inicio de Sesión):** Formulario de autenticación JWT y registro de nuevos clientes.
* **RF-002 (Servicios y Precios):** Muestra catálogo con precios, duración en minutos y descripciones.
* **RF-003 (Barberos y Disponibilidad):** Muestra perfil de barberos, especialidades y calcula disponibilidad exacta de horarios de atención en tiempo real.
* **RF-004 (Reserva de Citas):** Selección interactiva de servicio, barbero, fecha y bloques de tiempo disponibles.
* **RF-005 (Prevención de Solapamientos):** Validación estricta en el Backend usando transacciones atómicas de SQLite (`BEGIN IMMEDIATE`), rechazando cualquier reserva solapada.
* **RF-006 (Agenda de Barberos):** Panel exclusivo para que el barbero consulte su jornada y actualice el estado de sus clientes.
* **RF-007 (Modificación y Cancelación):** Permite cancelar o modificar citas liberando inmediatamente el bloque horario en la agenda.
* **RF-008 (Registro de Pagos):** Permite al personal receptor autorizado o administrador registrar pagos con su método de pago y monto acordado al reservar (`price_at_booking`).
* **RF-009 (Panel Administrativo):** Módulos CRUD completos de Servicios, Barberos, Usuarios y Dashboard con reporte de ingresos totales y rendimiento por barbero.

---

## 🛠️ Requisitos de Instalación y Ejecución Local

### Prerrequisitos
* **Node.js** (Versión v18+, v20+ o v24+).
* **NPM** (incluido con Node.js).
* **Visual Studio Code** (opcional, recomendable).

### Pasos para Ejecutar Localmente

1. **Abrir la terminal en la carpeta del proyecto:**
   ```bash
   cd c:\Users\Usuario\Documents\Barberia
   ```

2. **Instalar las dependencias (ya instaladas en el repositorio):**
   ```bash
   npm install
   ```

3. **Poblar la base de datos con datos de prueba iniciales:**
   ```bash
   node db/seed.js
   ```

4. **Ejecutar el servidor de la aplicación:**
   ```bash
   node server.js
   ```

5. **Abrir en tu navegador web:**
   Ingresa a: [http://localhost:3000](http://localhost:3000)

---

## 🧪 Verificación y Pruebas Automatizadas

El proyecto incluye una suite completa de pruebas automatizadas en `test/run-tests.js` que verifica la autenticación, reserva, solapamiento simultáneo concurrente y seguridad por roles.

Para ejecutar la verificación automatizada:
```bash
node test/run-tests.js
```

**Resultado esperado:**
```text
🧪 Iniciando Pruebas Automatizadas de Funcionalidades Principales...

1️⃣  Probando Autenticación (RF-001)...
  ✅ Login Admin OK
  ✅ Login Cliente OK
  ✅ Login Barbero OK
  ✅ Login Personal OK

2️⃣  Probando Catálogo de Servicios y Barberos (RF-002, RF-003)...
  ✅ Servicios listados correctamente
  ✅ Barberos listados correctamente
  ✅ Disponibilidad de horarios calculada correctamente

3️⃣  Probando Reserva de Citas y Control de Solapamiento (RF-004, RF-005)...
  ✅ Cita reservada exitosamente
  ✅ Solapamiento rechazado correctamente por el Backend

4️⃣  Probando Solicitudes Simultáneas Concurrentes (RF-005)...
  ✅ Transacciones simultáneas procesadas de forma atómica: 1 Aceptada (201) y 1 Rechazada (400)

5️⃣  Probando Agenda del Barbero, Modificación y Cancelación (RF-006, RF-007)...
  ✅ Agenda del barbero obtenida
  ✅ Estado de cita actualizado a "confirmada" por el barbero
  ✅ Cita cancelada por el cliente. Horario liberado.
  ✅ Horario cancelado fue liberado y reservado nuevamente con éxito

6️⃣  Probando Registro de Pagos por Personal Autorizado (RF-008)...
  ✅ Intento de pago por usuario no autorizado rechazado (403)
  ✅ Pago registrado exitosamente por personal autorizado (201)

7️⃣  Probando Administración y Dashboard (RF-009)...
  ✅ Métricas del Dashboard Admin generadas
  ✅ Nuevo servicio creado por Administrador

🎉 ¡TODAS LAS PRUEBAS AUTOMATIZADAS PASARON EXITOSAMENTE! 🎉
```

---

## 📁 Estructura del Proyecto

```
Barberia/
├── db/
│   ├── database.js     # Conexión SQLite y esquema de tablas
│   └── seed.js         # Script de carga inicial de datos de prueba
├── middleware/
│   └── auth.js         # Middleware JWT y verificación RBAC de Roles
├── routes/
│   ├── auth.js         # Rutas de login, registro y perfil
│   ├── services.js     # Rutas y CRUD de servicios
│   ├── barbers.js      # Rutas y cálculo de disponibilidad de barberos
│   ├── appointments.js # Lógica de reservas, solapamiento y estados
│   ├── payments.js     # Registro de cobros y métodos de pago
│   ├── users.js        # Gestión de usuarios por el administrador
│   └── reports.js      # Reportes e indicadores del dashboard admin
├── public/
│   ├── index.html      # Estructura principal Single Page Application
│   ├── css/
│   │   └── styles.css  # Tema visual oscuro y dorado (Dark & Gold)
│   └── js/
│       ├── api.js      # Cliente HTTP Fetch con tokens JWT
│       ├── auth.js     # Manejo de sesiones y logins rápidos
│       └── app.js      # Controlador de vistas y modales interactivos
├── test/
│   └── run-tests.js    # Suite de pruebas automatizadas de integración
├── package.json        # Dependencias y scripts del proyecto
├── server.js           # Servidor principal Express.js
└── README.md           # Documentación e instrucciones
```

---
*Desarrollado para Barbería Pro.*
