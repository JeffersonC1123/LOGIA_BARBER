const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/database');

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const barbersRoutes = require('./routes/barbers');
const appointmentsRoutes = require('./routes/appointments');
const paymentsRoutes = require('./routes/payments');
const usersRoutes = require('./routes/users');
const reportsRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del Frontend
app.use(express.static(path.join(__dirname, 'public')));

// Rutas de API
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/barbers', barbersRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);

// Ruta fallback para el cliente Frontend (Single Page Application fallback)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Ruta no encontrada.' });
  }
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  res.status(500).json({ error: 'Ocurrió un error interno en el servidor.' });
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`💈 Barbería Pro - Sistema de Gestión en Ejecución`);
  console.log(`🌐 Servidor corriendo en: http://localhost:${PORT}`);
  console.log(`=================================================`);
});

module.exports = app;
