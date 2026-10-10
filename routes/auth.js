const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// POST /api/auth/register - Registro de usuarios
router.post('/register', (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    // El rol por defecto es 'cliente'. Si viene otro rol, verificar si es válido.
    const validRoles = ['cliente', 'barbero', 'personal', 'admin'];
    const userRole = validRoles.includes(role) ? role : 'cliente';

    // Verificar si el usuario ya existe
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existingUser) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Encriptar contraseña
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `).run(name.trim(), email.toLowerCase().trim(), hashedPassword, userRole, phone || null);

    const newUser = {
      id: result.lastInsertRowid,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: userRole,
      phone: phone || null
    };

    // Si es un barbero recién creado por admin o registro, crear su perfil en tabla barbers
    if (userRole === 'barbero') {
      db.prepare(`
        INSERT INTO barbers (user_id, bio, specialties, start_hour, end_hour, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(newUser.id, 'Barbero profesional de Barbería Pro', 'Corte, Barba', '09:00', '20:00');
    }

    // Generar JWT token
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Usuario registrado con éxito.',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Error en /auth/register:', error);
    res.status(500).json({ error: 'Error al registrar el usuario.' });
  }
});

// POST /api/auth/login - Inicio de sesión
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: userPayload
    });
  } catch (error) {
    console.error('Error en /auth/login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// GET /api/auth/me - Obtener datos del usuario actual
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del usuario.' });
  }
});

module.exports = router;
