const assert = require('assert');
const http = require('http');
const db = require('../db/database');
const { seedDatabase } = require('../db/seed');
const app = require('../server');

let server;
const PORT = 3001;

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Iniciando Pruebas Automatizadas de Funcionalidades Principales...\n');
  
  // Reiniciar base de datos
  seedDatabase();

  server = app.listen(PORT);

  try {
    // 1. PRUEBA RF-001: Autenticación
    console.log('1️⃣  Probando Autenticación (RF-001)...');
    
    // Login Admin
    const adminLogin = await request('POST', '/api/auth/login', {
      email: 'admin@barberiapro.com',
      password: 'Admin123!'
    });
    assert.strictEqual(adminLogin.status, 200, 'Login de Admin falló');
    const adminToken = adminLogin.body.token;
    assert.ok(adminToken, 'Token de admin recibido');
    console.log('  ✅ Login Admin OK');

    // Login Cliente
    const clientLogin = await request('POST', '/api/auth/login', {
      email: 'juan@gmail.com',
      password: 'Cliente123!'
    });
    assert.strictEqual(clientLogin.status, 200, 'Login de Cliente falló');
    const clientToken = clientLogin.body.token;
    console.log('  ✅ Login Cliente OK');

    // Login Barbero
    const barberoLogin = await request('POST', '/api/auth/login', {
      email: 'carlos@barberiapro.com',
      password: 'Barbero123!'
    });
    assert.strictEqual(barberoLogin.status, 200, 'Login de Barbero falló');
    const barberoToken = barberoLogin.body.token;
    console.log('  ✅ Login Barbero OK');

    // Login Personal
    const personalLogin = await request('POST', '/api/auth/login', {
      email: 'recepcion@barberiapro.com',
      password: 'Personal123!'
    });
    assert.strictEqual(personalLogin.status, 200, 'Login de Personal falló');
    const personalToken = personalLogin.body.token;
    console.log('  ✅ Login Personal OK');


    // 2. PRUEBA RF-002 & RF-003: Servicios y Barberos
    console.log('\n2️⃣  Probando Catálogo de Servicios y Barberos (RF-002, RF-003)...');
    
    const services = await request('GET', '/api/services');
    assert.strictEqual(services.status, 200);
    assert.ok(services.body.length >= 5, 'Se obtuvieron los servicios activos');
    console.log(`  ✅ Servicios listados correctamente (${services.body.length} encontrados)`);

    const barbers = await request('GET', '/api/barbers');
    assert.strictEqual(barbers.status, 200);
    assert.ok(barbers.body.length >= 3, 'Se obtuvieron los barberos');
    console.log(`  ✅ Barberos listados correctamente (${barbers.body.length} encontrados)`);

    const barberId = barbers.body[0].id;
    const serviceId = services.body[0].id;
    const today = new Date().toISOString().split('T')[0];

    const availability = await request('GET', `/api/barbers/${barberId}/availability?date=${today}&service_id=${serviceId}`);
    assert.strictEqual(availability.status, 200);
    assert.ok(availability.body.slots.length > 0, 'Bloques de horarios generados');
    console.log('  ✅ Disponibilidad de horarios calculada correctamente');


    // 3. PRUEBA RF-004 & RF-005: Reserva de cita y Validación de Solapamiento
    console.log('\n3️⃣  Probando Reserva de Citas y Control de Solapamiento (RF-004, RF-005)...');
    
    // Buscar una fecha futura
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dateStr = nextWeek.toISOString().split('T')[0];

    // Cita exitosa
    const booking1 = await request('POST', '/api/appointments', {
      barber_id: barberId,
      service_id: serviceId,
      date: dateStr,
      start_time: '14:00',
      notes: 'Prueba de reserva'
    }, clientToken);

    assert.strictEqual(booking1.status, 201, `Falló crear reserva: ${JSON.stringify(booking1.body)}`);
    console.log('  ✅ Cita reservada exitosamente');

    // Cita solapada intento 1 (mismo horario exacto)
    const bookingOverlap = await request('POST', '/api/appointments', {
      barber_id: barberId,
      service_id: serviceId,
      date: dateStr,
      start_time: '14:00',
      notes: 'Prueba solapada'
    }, clientToken);

    assert.strictEqual(bookingOverlap.status, 400, 'Debió rechazar la cita solapada');
    assert.ok(bookingOverlap.body.error.includes('se encuentra reservado'), 'Mensaje de solapamiento correcto');
    console.log('  ✅ Solapamiento rechazado correctamente por el Backend');


    // 4. PRUEBA DE CONCURRENCIA SIMULTÁNEA (RF-005)
    console.log('\n4️⃣  Probando Solicitudes Simultáneas Concurrentes (RF-005)...');
    
    const simTime = '16:00';
    const req1 = request('POST', '/api/appointments', {
      barber_id: barberId,
      service_id: serviceId,
      date: dateStr,
      start_time: simTime
    }, clientToken);

    const req2 = request('POST', '/api/appointments', {
      barber_id: barberId,
      service_id: serviceId,
      date: dateStr,
      start_time: simTime
    }, clientToken);

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();
    
    assert.deepStrictEqual(statuses, [201, 400], 'Exactamente una solicitud debió tener éxito (201) y la otra ser rechazada (400)');
    console.log('  ✅ Transacciones simultáneas procesadas de forma atómica: 1 Aceptada (201) y 1 Rechazada (400)');


    // 5. PRUEBA RF-006 & RF-007: Agenda del Barbero, Modificación y Cancelación
    console.log('\n5️⃣  Probando Agenda del Barbero, Modificación y Cancelación (RF-006, RF-007)...');
    
    const barberAgenda = await request('GET', '/api/appointments', null, barberoToken);
    assert.strictEqual(barberAgenda.status, 200);
    console.log(`  ✅ Agenda del barbero obtenida (${barberAgenda.body.length} citas en su agenda)`);

    const createdAppId = booking1.body.appointment.id;

    // Actualizar estado de cita por el barbero
    const statusUpdate = await request('PUT', `/api/appointments/${createdAppId}/status`, {
      status: 'confirmada'
    }, barberoToken);
    assert.strictEqual(statusUpdate.status, 200);
    console.log('  ✅ Estado de cita actualizado a "confirmada" por el barbero');

    // Cancelar cita por el cliente (liberar horario)
    const cancelRes = await request('PUT', `/api/appointments/${createdAppId}/status`, {
      status: 'cancelada'
    }, clientToken);
    assert.strictEqual(cancelRes.status, 200);
    console.log('  ✅ Cita cancelada por el cliente. Horario liberado.');

    // Verificar que el horario liberado se puede volver a reservar
    const rebook = await request('POST', '/api/appointments', {
      barber_id: barberId,
      service_id: serviceId,
      date: dateStr,
      start_time: '14:00'
    }, clientToken);
    assert.strictEqual(rebook.status, 201);
    console.log('  ✅ Horario cancelado fue liberado y reservado nuevamente con éxito');


    // 6. PRUEBA RF-008: Registro de Pagos
    console.log('\n6️⃣  Probando Registro de Pagos por Personal Autorizado (RF-008)...');
    
    const rebookedId = rebook.body.appointment.id;
    
    // Intento de pago por cliente (Debe fallar 403)
    const clientPay = await request('POST', '/api/payments', {
      appointment_id: rebookedId,
      amount: 15.00,
      payment_method: 'efectivo'
    }, clientToken);
    assert.strictEqual(clientPay.status, 403, 'El cliente no debe poder registrar pagos');
    console.log('  ✅ Intento de pago por usuario no autorizado rechazado (403)');

    // Pago por Personal (Debe ser exitoso 201)
    const personalPay = await request('POST', '/api/payments', {
      appointment_id: rebookedId,
      amount: 15.00,
      payment_method: 'efectivo'
    }, personalToken);
    assert.strictEqual(personalPay.status, 201, `Falló registro de pago: ${JSON.stringify(personalPay.body)}`);
    console.log('  ✅ Pago registrado exitosamente por personal autorizado (201)');


    // 7. PRUEBA RF-009: Administración y Reportes
    console.log('\n7️⃣  Probando Administración y Dashboard (RF-009)...');
    
    const dashboard = await request('GET', '/api/reports/dashboard', null, adminToken);
    assert.strictEqual(dashboard.status, 200);
    assert.ok(dashboard.body.total_income > 0, 'Ingresos calculados');
    console.log(`  ✅ Métricas del Dashboard Admin generadas (Ingresos totales: $${dashboard.body.total_income})`);

    const createService = await request('POST', '/api/services', {
      name: 'Perfilado de Barba VIP',
      description: 'Tratamiento exclusivo',
      price: 35.00,
      duration_minutes: 45
    }, adminToken);
    assert.strictEqual(createService.status, 201);
    console.log('  ✅ Nuevo servicio creado por Administrador');

    console.log('\n🎉 ¡TODAS LAS PRUEBAS AUTOMATIZADAS PASARON EXITOSAMENTE! 🎉\n');

  } catch (err) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
