const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
router.get('/', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const result = await db.query(`SELECT * FROM weiterbildungen WHERE user_id = $1`, [req.session.user.id]);
    res.render('profil', {
      user: req.session.user,
      weiterbildungen: result.rows
    });
  } catch (err) {
    console.error(err);
    res.send('Fehler beim Laden der Weiterbildungen');
  }
});

// 📝 GET /profil/bearbeiten
router.get('/bearbeiten', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('profil_bearbeiten', { user: req.session.user });
});

// 💾 POST /profil/bearbeiten
router.post('/bearbeiten', upload.fields([
  { name: 'profilbild', maxCount: 1 },
  { name: 'weiterbildungen', maxCount: 10 }
]), async (req, res) => {
  const { name, email, strasse, plz, ort } = req.body;
  const userId = req.session.user.id;

  try {
    // Hauptdaten speichern
    await db.query(
      `UPDATE users SET name = $1, email = $2, strasse = $3, plz = $4, ort = $5 WHERE id = $6`,
      [name, email, strasse, plz, ort, userId]
    );

    // Session aktualisieren
    Object.assign(req.session.user, { name, email, strasse, plz, ort });

    // Profilbild speichern
    if (req.files['profilbild']) {
      const bild = req.files['profilbild'][0].filename;
      await db.query(`UPDATE users SET profilbild = $1 WHERE id = $2`, [bild, userId]);
      req.session.user.profilbild = bild;
    }

    // Weiterbildungen speichern
    if (req.files['weiterbildungen']) {
      for (const file of req.files['weiterbildungen']) {
        await db.query(
          `INSERT INTO weiterbildungen (user_id, dateiname, originalname) VALUES ($1, $2, $3)`,
          [userId, file.filename, file.originalname]
        );
      }
    }

    res.redirect('/profil');
  } catch (err) {
    console.error(err);
    res.send('Fehler beim Speichern');
  }
});

// POST /profil/weiterbildung-loeschen
router.post('/weiterbildung-loeschen', async (req, res) => {
  const { id, dateiname } = req.body;
  const userId = req.session.user.id;

  try {
    await db.query(`DELETE FROM weiterbildungen WHERE id = $1 AND user_id = $2`, [id, userId]);

    const filePath = path.join(__dirname, '../public/uploads/weiterbildungen/', dateiname);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.redirect('/profil');
  } catch (err) {
    console.error(err);
    res.send('Fehler beim Löschen');
  }
});

module.exports = router;
