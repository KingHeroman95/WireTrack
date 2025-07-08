const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');

router.get('/login', (req, res) => {
  res.render('login');
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) {
      console.error("❌ DB-Fehler beim Login:", err.message);
      return res.render('login', { fehler: "Serverfehler. Bitte später versuchen." });
    }

    if (!user) {
      return res.render('login', { fehler: "Benutzer nicht gefunden." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('login', { fehler: "Falsches Passwort." });
    }

    // Erfolgreich
    req.session.user = {
  id: user.id,
  name: user.name,
  email: user.email,  
  rolle: user.rolle
};
    res.redirect('/dashboard');
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = {
  router,
  isGL: user => user && user.rolle === 'GL',
  isPL: user => user && user.rolle === 'PL',
  isSekretariat: user => user && user.rolle === 'Sekretariat',
  isMitarbeiter: user => user && user.rolle === 'Mitarbeiter',
  isLehrling: user => user && user.rolle === 'Lehrling',
  isAdmin: user => user && user.email === 'admin@firma.ch'
};
