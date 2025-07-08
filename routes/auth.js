const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

// 📥 Login-Seite
router.get('/login', (req, res) => {
  res.render('login');
});

// 🔐 Login POST
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];

    if (!user) {
      return res.render('login', { fehler: "Benutzer nicht gefunden." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { fehler: "Falsches Passwort." });
    }

    // ✅ Login erfolgreich → Session setzen
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      rolle: user.rolle
    };

    res.redirect('/dashboard');

  } catch (err) {
    console.error("❌ DB-Fehler beim Login:", err.message);
    res.render('login', { fehler: "Serverfehler. Bitte später versuchen." });
  }
});

// 🚪 Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});


// 🛡️ Rollenprüfungen – überall nutzbar
const isGL = user => user?.rolle === 'GL';
const isPL = user => user?.rolle === 'PL';
const isSekretariat = user => user?.rolle === 'Sekretariat';
const isMitarbeiter = user => user?.rolle === 'Mitarbeiter';
const isLehrling = user => user?.rolle === 'Lehrling';
const isAdmin = user => user?.email === 'admin@firma.ch'
