const db = require('./database');
const bcrypt = require('bcryptjs');

function seedDatabase() {
  console.log('Iniciando poblado de base de datos...');

  // Limpiar datos existentes en orden correcto (respetando llaves foráneas)
  db.prepare('DELETE FROM payments').run();
  db.prepare('DELETE FROM appointments').run();
  db.prepare('DELETE FROM barbers').run();
  db.prepare('DELETE FROM services').run();
  db.prepare('DELETE FROM users').run();

  // Reset de autoincrementables
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('users', 'barbers', 'services', 'appointments', 'payments')").run();

  // Crear contraseñas encriptadas
  const adminPass = bcrypt.hashSync('Admin123!', 10);
  const barberoPass = bcrypt.hashSync('Barbero123!', 10);
  const personalPass = bcrypt.hashSync('Personal123!', 10);
  const clientePass = bcrypt.hashSync('Cliente123!', 10);

  // 1. Insertar Usuarios
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password, role, phone)
    VALUES (?, ?, ?, ?, ?)
  `);

  const adminId = insertUser.run('Administrador Pro', 'admin@barberiapro.com', adminPass, 'admin', '+57 300 000 0001').lastInsertRowid;
  const barbero1UserId = insertUser.run('Carlos "El Rey" Mendoza', 'carlos@barberiapro.com', barberoPass, 'barbero', '+57 300 111 2233').lastInsertRowid;
  const barbero2UserId = insertUser.run('Mateo "Fader" Silva', 'mateo@barberiapro.com', barberoPass, 'barbero', '+57 300 222 3344').lastInsertRowid;
  const barbero3UserId = insertUser.run('Diego "Estilo" Gómez', 'diego@barberiapro.com', barberoPass, 'barbero', '+57 300 333 4455').lastInsertRowid;
  const personalUserId = insertUser.run('Lucía Suárez (Caja/Recepción)', 'recepcion@barberiapro.com', personalPass, 'personal', '+57 300 444 5566').lastInsertRowid;
  const cliente1Id = insertUser.run('Juan Pérez', 'juan@gmail.com', clientePass, 'cliente', '+57 311 555 6677').lastInsertRowid;
  const cliente2Id = insertUser.run('Andrés Torres', 'andres@gmail.com', clientePass, 'cliente', '+57 312 666 7788').lastInsertRowid;

  // 2. Insertar Barberos
  const insertBarber = db.prepare(`
    INSERT INTO barbers (user_id, bio, specialties, start_hour, end_hour, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const barbero1Id = insertBarber.run(barbero1UserId, 'Especialista en cortes clásicos, degradados perfectos y perfilado a navaja tradicional.', 'Corte Clásico, Degradado, Barba', '09:00', '19:00').lastInsertRowid;
  const barbero2Id = insertBarber.run(barbero2UserId, 'Experto en estilos modernos, diseños urbanos, fade y tinte de barba.', 'Combo Pro, Tinte, Fade Moderno', '10:00', '20:00').lastInsertRowid;
  const barbero3Id = insertBarber.run(barbero3UserId, 'Maestro barbero enfocado en cuidado facial masculino y toalla caliente.', 'Ritual Barba, Limpieza Facial', '09:00', '18:00').lastInsertRowid;

  // 3. Insertar Servicios
  const insertService = db.prepare(`
    INSERT INTO services (name, description, price, duration_minutes, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

  const s1 = insertService.run('Corte de Cabello Clásico', 'Corte profesional adaptado a tu estilo, incluye lavado y peinado.', 15.00, 30).lastInsertRowid;
  const s2 = insertService.run('Barba Completa & Toalla Caliente', 'Perfilado de barba, exfoliación y masaje relajante con vaporizador y toalla caliente.', 12.00, 30).lastInsertRowid;
  const s3 = insertService.run('Combo Pro: Corte + Barba + Peinado', 'El tratamiento completo para el caballero exigente. Ahorro especial.', 24.00, 50).lastInsertRowid;
  const s4 = insertService.run('Tinte & Camuflaje de Canas', 'Aplicación de tinte natural especializado para cabello o barba.', 20.00, 45).lastInsertRowid;
  const s5 = insertService.run('Limpieza Facial Masculina', 'Tratamiento purificante profundo con mascarilla negra e hidratación.', 18.00, 40).lastInsertRowid;
  const s6 = insertService.run('Perfilado de Cejas & Barba Express', 'Ajuste rápido de contornos a navaja para lucir impecable.', 8.00, 20).lastInsertRowid;

  // Fecha actual para calcular citas relativas
  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];

  const todayStr = formatDate(today);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = formatDate(tomorrow);

  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - 2);
  const pastStr = formatDate(pastDate);

  // 4. Insertar Citas ficticias
  const insertAppointment = db.prepare(`
    INSERT INTO appointments (client_id, barber_id, service_id, date, start_time, end_time, price_at_booking, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Cita 1: Pasada completada
  const app1 = insertAppointment.run(cliente1Id, barbero1Id, s1, pastStr, '10:00', '10:30', 15.00, 'completada', 'Cliente preferencial').lastInsertRowid;

  // Cita 2: Hoy confirmada
  const app2 = insertAppointment.run(cliente2Id, barbero2Id, s3, todayStr, '11:00', '11:50', 24.00, 'confirmada', 'Quiere degradado bajo').lastInsertRowid;

  // Cita 3: Mañana pendiente
  const app3 = insertAppointment.run(cliente1Id, barbero3Id, s2, tomorrowStr, '15:00', '15:30', 12.00, 'pendiente', 'Sin observaciones').lastInsertRowid;

  // 5. Insertar Pagos
  const insertPayment = db.prepare(`
    INSERT INTO payments (appointment_id, amount, payment_method, status, registered_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Pago de la cita 1
  insertPayment.run(app1, 15.00, 'efectivo', 'completado', personalUserId);

  // Pago de la cita 2
  insertPayment.run(app2, 24.00, 'tarjeta', 'completado', personalUserId);

  console.log('✅ Base de datos poblada exitosamente con datos ficticios.');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
