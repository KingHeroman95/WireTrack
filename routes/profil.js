const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// 📁 Upload-Ordner + Dateinamen-Konfiguration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = file.fieldname === 'profilbild'
      ? 'public/uploads/'
      : 'public/uploads/weiterbildungen/';
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = file.fieldname === 'profilbild'
      ? `user_${req.session.user.id}${ext}`
      : `wb_${Date.now()}_${file.originalname}`;
    cb(null, safeName);
  }
});
const upload = multer({ storage });

// 📄 GET /profil – Profil anzeigen + Weiterbildungen laden
router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  db.all(`SELECT * FROM weiterbildungen WHERE user_id = ?`, [req.session.user.id], (err, weiterbildungen) => {
    if (err) return res.send('Fehler beim Laden der Weiterbildungen');
    res.render('profil', {
      user: req.session.user,
      weiterbildungen
    });
  });
});

// 📝 GET /profil/bearbeiten
router.get('/bearbeiten', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('profil_bearbeiten', { user: req.session.user });
});

// 💾 POST /profil/bearbeiten – alles speichern
router.post('/bearbeiten', upload.fields([
  { name: 'profilbild', maxCount: 1 },
  { name: 'weiterbildungen', maxCount: 10 }
]), (req, res) => {
  const { name, email, strasse, plz, ort } = req.body;
  const userId = req.session.user.id;

  db.run(
    `UPDATE users SET name = ?, email = ?, strasse = ?, plz = ?, ort = ? WHERE id = ?`,
    [name, email, strasse, plz, ort, userId],
    function (err) {
      if (err) return res.send('Fehler beim Speichern');

      // Session aktualisieren
      req.session.user.name = name;
      req.session.user.email = email;
      req.session.user.strasse = strasse;
      req.session.user.plz = plz;
      req.session.user.ort = ort;

      // Profilbild speichern
      if (req.files['profilbild']) {
        const bild = req.files['profilbild'][0].filename;
        db.run(`UPDATE users SET profilbild = ? WHERE id = ?`, [bild, userId]);
        req.session.user.profilbild = bild;
      }

      // Weiterbildungen speichern
      if (req.files['weiterbildungen']) {
        req.files['weiterbildungen'].forEach(file => {
          db.run(
            `INSERT INTO weiterbildungen (user_id, dateiname, originalname) VALUES (?, ?, ?)`,
            [userId, file.filename, file.originalname]
          );
        });
      }

      res.redirect('/profil');
    }
  );
});
const fs = require('fs');

// POST /profil/weiterbildung-loeschen
router.post('/weiterbildung-loeschen', (req, res) => {
  const { id, dateiname } = req.body;
  const userId = req.session.user.id;

  db.run(`DELETE FROM weiterbildungen WHERE id = ? AND user_id = ?`, [id, userId], (err) => {
    if (err) return res.send('Fehler beim Löschen');

    const filePath = path.join(__dirname, '../public/uploads/weiterbildungen/', dateiname);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.redirect('/profil');
  });
});


module.exports = router;

