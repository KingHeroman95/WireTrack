const express = require('express');
const router = express.Router();

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/kunden_uploads/');
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `kunde_${req.body.kunden_id}_${timestamp}${ext}`);
  }
});
const upload = multer({ storage: storage });

router.get('/', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const result = await db.query(`SELECT * FROM kunden`);
    res.render('kunden', { user: req.session.user, kunden: result.rows });
  } catch (err) {
    console.error(err);
    res.send('Fehler beim Laden');
  }
});

router.get('/neu', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('kunden_neu', { user: req.session.user });
});

router.get('/details/:id', async (req, res) => {
  const kundenId = req.params.id;
  const filterTyp = req.query.typ;

  try {
    const kundeResult = await db.query(`SELECT * FROM kunden WHERE id = $1`, [kundenId]);
    const kunde = kundeResult.rows[0];
    if (!kunde) return res.send("❌ Kunde nicht gefunden");

    let query = `SELECT * FROM kundendokumente WHERE kunden_id = $1`;
    const params = [kundenId];

    if (filterTyp) {
      query += ` AND typ = $2`;
      params.push(filterTyp);
    }

    const dokumenteResult = await db.query(query, params);
    res.render('kunden_details', {
      kunde,
      dokumente: dokumenteResult.rows,
      selectedTyp: filterTyp
    });

  } catch (err) {
    console.error(err);
    res.send("❌ Fehler beim Laden");
  }
});

router.post('/neu', async (req, res) => {
  const { vorname, name, adresse, plz, ort, telefon, email } = req.body;

  try {
    await db.query(`
      INSERT INTO kunden (vorname, name, adresse, plz, ort, telefon, email)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [vorname, name, adresse, plz, ort, telefon, email]);

    res.redirect('/kunden');
  } catch (err) {
    console.error(err);
    res.send('❌ Fehler beim Speichern');
  }
});

router.post('/upload', upload.single('dokument'), async (req, res) => {
  const { kunden_id, typ } = req.body;

  if (!req.file) return res.send("❌ Keine Datei hochgeladen");

  try {
    await db.query(`
      INSERT INTO kundendokumente (kunden_id, dateiname, originalname, typ)
      VALUES ($1, $2, $3, $4)
    `, [kunden_id, req.file.filename, req.file.originalname, typ]);

    res.redirect(`/kunden/details/${kunden_id}`);
  } catch (err) {
    console.error(err);
    res.send("❌ Fehler beim Speichern");
  }
});

router.post('/delete', async (req, res) => {
  const kundenId = req.body.id;
  const rolle = req.session.user?.rolle;

  if (!rolle || (rolle !== 'Projektleiter' && rolle !== 'GL')) {
    return res.status(403).send("⛔ Zugriff verweigert");
  }

  try {
    await db.query(`DELETE FROM kunden WHERE id = $1`, [kundenId]);
    await db.query(`DELETE FROM kundendokumente WHERE kunden_id = $1`, [kundenId]);
    res.redirect('/kunden');
  } catch (err) {
    console.error(err);
    res.send("❌ Fehler beim Löschen");
  }
});

router.post('/delete-dokument', async (req, res) => {
  const { dokument_id, kunden_id } = req.body;

  try {
    const result = await db.query(`SELECT dateiname FROM kundendokumente WHERE id = $1`, [dokument_id]);
    const row = result.rows[0];
    if (!row) return res.send("❌ Datei nicht gefunden");

    const filePath = path.join(__dirname, '..', 'public', 'kunden_uploads', row.dateiname);
    fs.unlink(filePath, async (err) => {
      if (err && err.code !== 'ENOENT') return res.send("❌ Fehler beim Dateilöschen");
      try {
        await db.query(`DELETE FROM kundendokumente WHERE id = $1`, [dokument_id]);
        res.redirect(`/kunden/details/${kunden_id}`);
      } catch (err2) {
        console.error(err2);
        res.send("❌ Fehler beim Löschen");
      }
    });
  } catch (err) {
    console.error(err);
    res.send("❌ Fehler beim Laden");
  }
});

module.exports = router;
