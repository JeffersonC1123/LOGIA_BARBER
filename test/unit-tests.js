const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, authenticateToken, requireRole } = require('../middleware/auth');
const { createAppointment } = require('../utils/appointmentBooking');
const { doTimesOverlap } = require('../utils/timeHelper');

let assertions = 0;

function check(description, assertion) {
  assertion();
  assertions += 1;
  console.log(`  OK ${description}`);
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function createBookingDatabase() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE barbers (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      start_hour TEXT NOT NULL,
      end_hour TEXT NOT NULL,
      is_active INTEGER NOT NULL
    );
    CREATE TABLE services (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      duration_minutes INTEGER NOT NULL,
      is_active INTEGER NOT NULL
    );
    CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      barber_id INTEGER NOT NULL,
      service_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      price_at_booking REAL NOT NULL,
      status TEXT NOT NULL,
      notes TEXT
    );
    INSERT INTO users (id, name) VALUES (1, 'Carlos'), (2, 'Cliente');
    INSERT INTO barbers (id, user_id, start_hour, end_hour, is_active)
      VALUES (1, 1, '09:00', '20:00', 1);
    INSERT INTO services (id, name, price, duration_minutes, is_active)
      VALUES (1, 'Corte', 18, 30, 1);
  `);
  return db;
}

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function runAuthenticationTests() {
  console.log('Autenticación y autorización:');

  const missingTokenResponse = createResponse();
  let missingTokenNextCalled = false;
  authenticateToken(
    { headers: {} },
    missingTokenResponse,
    () => { missingTokenNextCalled = true; }
  );
  check('rechaza solicitudes sin token con 401', () => {
    assert.equal(missingTokenResponse.statusCode, 401);
    assert.equal(missingTokenNextCalled, false);
  });

  const invalidTokenResponse = createResponse();
  let invalidTokenNextCalled = false;
  authenticateToken(
    { headers: { authorization: 'Bearer token-invalido' } },
    invalidTokenResponse,
    () => { invalidTokenNextCalled = true; }
  );
  check('rechaza tokens inválidos con 403', () => {
    assert.equal(invalidTokenResponse.statusCode, 403);
    assert.equal(invalidTokenNextCalled, false);
  });

  const user = { id: 2, email: 'cliente@example.com', role: 'cliente' };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
  const validTokenRequest = { headers: { authorization: `Bearer ${token}` } };
  const validTokenResponse = createResponse();
  let validTokenNextCalled = false;
  authenticateToken(validTokenRequest, validTokenResponse, () => { validTokenNextCalled = true; });
  check('valida token y asigna el usuario a la solicitud', () => {
    assert.equal(validTokenNextCalled, true);
    assert.deepEqual({
      id: validTokenRequest.user.id,
      email: validTokenRequest.user.email,
      role: validTokenRequest.user.role
    }, user);
  });

  const permittedResponse = createResponse();
  let permittedNextCalled = false;
  requireRole('admin', 'cliente')(
    { user },
    permittedResponse,
    () => { permittedNextCalled = true; }
  );
  check('permite el rol incluido en la lista', () => {
    assert.equal(permittedNextCalled, true);
    assert.equal(permittedResponse.body, null);
  });

  const deniedResponse = createResponse();
  let deniedNextCalled = false;
  requireRole('admin')(
    { user },
    deniedResponse,
    () => { deniedNextCalled = true; }
  );
  check('deniega roles no autorizados con 403', () => {
    assert.equal(deniedResponse.statusCode, 403);
    assert.equal(deniedNextCalled, false);
  });
}

function runAppointmentTests() {
  console.log('\nReservas y solapamientos:');
  const db = createBookingDatabase();
  const date = futureDate();
  const client = { id: 2, role: 'cliente' };
  const baseInput = { barber_id: 1, service_id: 1, date, start_time: '14:00' };

  try {
    const appointment = createAppointment(db, client, baseInput);
    check('crea una reserva con fin, precio y cliente correctos', () => {
      assert.equal(appointment.client_id, client.id);
      assert.equal(appointment.start_time, '14:00');
      assert.equal(appointment.end_time, '14:30');
      assert.equal(appointment.price_at_booking, 18);
      assert.equal(appointment.status, 'pendiente');
    });

    const initialCount = db.prepare('SELECT COUNT(*) AS count FROM appointments').get().count;
    check('rechaza el solapamiento exacto sin insertar otra cita', () => {
      assert.throws(
        () => createAppointment(db, client, baseInput),
        /ya se encuentra reservado/
      );
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM appointments').get().count, initialCount);
    });

    check('rechaza solapamientos parciales', () => {
      assert.throws(
        () => createAppointment(db, client, { ...baseInput, start_time: '14:15' }),
        /ya se encuentra reservado/
      );
      assert.equal(doTimesOverlap('14:00', '14:30', '14:15', '14:45'), true);
    });

    check('permite horarios contiguos sin considerarlos solapados', () => {
      assert.equal(doTimesOverlap('14:00', '14:30', '14:30', '15:00'), false);
      const adjacent = createAppointment(db, client, { ...baseInput, start_time: '14:30' });
      assert.equal(adjacent.end_time, '15:00');
    });

    check('ignora citas canceladas al comprobar disponibilidad', () => {
      db.prepare("UPDATE appointments SET status = 'cancelada' WHERE id = ?").run(appointment.id);
      const replacement = createAppointment(db, client, baseInput);
      assert.equal(replacement.start_time, appointment.start_time);
    });

    check('rechaza datos obligatorios ausentes', () => {
      assert.throws(
        () => createAppointment(db, client, { ...baseInput, start_time: '' }),
        /son obligatorios/
      );
    });

    check('rechaza una cita que excede la jornada laboral', () => {
      assert.throws(
        () => createAppointment(db, client, { ...baseInput, start_time: '19:45' }),
        /fuera de la jornada laboral/
      );
    });

    check('admin y personal pueden reservar a nombre de un cliente indicado', () => {
      const staffBooking = createAppointment(
        db,
        { id: 99, role: 'personal' },
        { ...baseInput, start_time: '16:00', client_id: 2 }
      );
      assert.equal(staffBooking.client_id, 2);
    });
  } finally {
    db.close();
  }
}

runAuthenticationTests();
runAppointmentTests();
console.log(`\n${assertions} comprobaciones directas pasaron.`);