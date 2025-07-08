const express = require('express');
const router = express.Router();

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db'); // falls noch nicht drin

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


router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  db.all(`SELECT * FROM kunden`, (err, kunden) => {
    if (err) return res.send('Fehler beim Laden');
    res.render('kunden', { user: req.session.user, kunden });
  });
});

router.get('/neu', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.render('kunden_neu', { user: req.session.user });
});

router.get('/details/:id', (req, res) => {
  const kundenId = req.params.id;
  const filterTyp = req.query.typ;

  db.get(`SELECT * FROM kunden WHERE id = ?`, [kundenId], (err, kunde) => {
    if (err || !kunde) return res.send("❌ Kunde nicht gefunden");

    let query = `SELECT * FROM kundendokumente WHERE kunden_id = ?`;
    let params = [kundenId];

    if (filterTyp) {
      query += ` AND typ = ?`;
      params.push(filterTyp);
    }

    db.all(query, params, (err2, dokumente) => {
      if (err2) return res.send("❌ Fehler beim Laden");

      res.render('kunden_details', { kunde, dokumente, selectedTyp: filterTyp });
    });
  });
});



router.post('/neu', (req, res) => {
  const { vorname, name, adresse, plz, ort, telefon, email } = req.body;
  db.run(`
    INSERT INTO kunden (vorname, name, adresse, plz, ort, telefon, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [vorname, name, adresse, plz, ort, telefon, email],
    (err) => {
      if (err) return res.send('❌ Fehler beim Speichern');
      res.redirect('/kunden');
    });
});

router.post('/upload', upload.single('dokument'), (req, res) => {
  const { kunden_id, typ } = req.body;

  if (!req.file) return res.send("❌ Keine Datei hochgeladen");

  db.run(`
    INSERT INTO kundendokumente (kunden_id, dateiname, originalname, typ)
    VALUES (?, ?, ?, ?)
  `,
    [kunden_id, req.file.filename, req.file.originalname, typ],
    (err) => {
      if (err) return res.send("❌ Fehler beim Speichern");
      res.redirect(`/kunden/details/${kunden_id}`);
    });
});

// ⬇️ Jetzt außerhalb, nicht mehr verschachtelt!
router.post('/delete', (req, res) => {
  const kundenId = req.body.id;

  // Sicherheitscheck: Nur Projektleiter oder GL dürfen löschen
  const rolle = req.session.user?.rolle;
  if (!rolle || (rolle !== 'Projektleiter' && rolle !== 'GL')) {
    return res.status(403).send("⛔ Zugriff verweigert");
  }

  db.run(`DELETE FROM kunden WHERE id = ?`, [kundenId], function(err) {
    if (err) return res.send("❌ Fehler beim Löschen");

    // Auch verknüpfte Dokumente löschen
    db.run(`DELETE FROM kundendokumente WHERE kunden_id = ?`, [kundenId], () => {
      res.redirect('/kunden');
    });
  });
});
router.post('/delete-dokument', (req, res) => {
  const { dokument_id, kunden_id } = req.body;

  db.get(`SELECT dateiname FROM kundendokumente WHERE id = ?`, [dokument_id], (err, row) => {
    if (err || !row) return res.send("❌ Datei nicht gefunden");

    // Datei vom Filesystem löschen
    const filePath = path.join(__dirname, '..', 'public', 'kunden_uploads', row.dateiname);
    fs.unlink(filePath, () => {
      // Ignorieren, wenn Datei nicht existiert

      // Dann aus DB löschen
      db.run(`DELETE FROM kundendokumente WHERE id = ?`, [dokument_id], (err2) => {
        if (err2) return res.send("❌ Fehler beim Löschen");
        res.redirect(`/kunden/details/${kunden_id}`);
      });
    });
  });
});



module.exports = router;
