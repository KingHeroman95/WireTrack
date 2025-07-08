const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 📁 Upload-Konfiguration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/quittungen');
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const storageProjektdateien = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/projektdateien');
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + file.originalname;
    cb(null, unique);
  }
});
const uploadProjektdatei = multer({ storage: storageProjektdateien });

// 📡 Material hinzufügen
router.post('/:id/material/hinzufuegen', async (req, res) => {
  const projektId = req.params.id;
  const { artikelnummer, bezeichnung, menge, einzelpreis, quelle } = req.body;

  const preis = parseFloat(einzelpreis);
  const anzahl = parseFloat(menge);
  if (isNaN(preis) || preis <= 0) return res.send("❌ Ungültiger Preis");

  const gesamtpreis = preis * anzahl;

  try {
    const existingResult = await db.query(
      `SELECT id, menge, gesamtpreis FROM projektmaterial WHERE projekt_id = $1 AND artikelnummer = $2`,
      [projektId, artikelnummer]
    );
    const existing = existingResult.rows[0];

    if (existing) {
      const neueMenge = existing.menge + anzahl;
      const neuerGesamtpreis = neueMenge * preis;

      await db.query(
        `UPDATE projektmaterial SET menge = $1, gesamtpreis = $2 WHERE id = $3`,
        [neueMenge, neuerGesamtpreis, existing.id]
      );
    } else {
      await db.query(
        `INSERT INTO projektmaterial (projekt_id, artikelnummer, bezeichnung, menge, einzelpreis, gesamtpreis, quelle)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [projektId, artikelnummer, bezeichnung, anzahl, preis, gesamtpreis, quelle]
      );
    }

    res.redirect(`/projekte/details/${projektId}`);
  } catch (err) {
    console.error("❌ Fehler bei Material speichern:", err.message);
    res.send("❌ Fehler beim Speichern");
  }
});

// 📡 Material löschen
router.post('/:projektId/material/:materialId/loeschen', async (req, res) => {
  const { projektId, materialId } = req.params;
  const user = req.session.user;

  if (!['GL', 'PL', 'Sekretariat'].includes(user.rolle)) {
    return res.status(403).send("🚫 Kein Zugriff");
  }

  try {
    await db.query(`DELETE FROM projektmaterial WHERE id = $1`, [materialId]);
    res.redirect(`/projekte/details/${projektId}`);
  } catch (err) {
    console.error("❌ Fehler beim Löschen:", err.message);
    res.send("❌ Fehler beim Löschen");
  }
});

// 📡 Materialmenge aktualisieren
router.post('/:projektId/material/:materialId/menge', async (req, res) => {
  const { projektId, materialId } = req.params;
  const neueMenge = parseFloat(req.body.menge);

  if (isNaN(neueMenge)) return res.send("❌ Ungültige Menge");

  try {
    const result = await db.query(`SELECT einzelpreis FROM projektmaterial WHERE id = $1`, [materialId]);
    const row = result.rows[0];
    if (!row) return res.send("❌ Eintrag nicht gefunden");

    const neuerGesamtpreis = neueMenge * row.einzelpreis;

    await db.query(
      `UPDATE projektmaterial SET menge = $1, gesamtpreis = $2 WHERE id = $3`,
      [neueMenge, neuerGesamtpreis, materialId]
    );

    res.redirect(`/projekte/details/${projektId}`);
  } catch (err) {
    console.error("❌ Fehler beim Aktualisieren:", err.message);
    res.send("❌ Fehler beim Aktualisieren");
  }
});


// 🧾 Projektübersicht
router.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;
  const { suchbegriff, abteilung, status } = req.query;

  let query = `
    SELECT projekte.*, 
           kunden.vorname || ' ' || kunden.name AS kundenname
    FROM projekte
    LEFT JOIN kunden ON projekte.kunden_id = kunden.id
    WHERE 1=1`;
  const params = [];

  if (abteilung) {
    query += ` AND abteilung = ?`;
    params.push(abteilung);
  }
  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (suchbegriff) {
    query += ` AND (projekte.name LIKE ? OR kunden.name LIKE ?)`;
    params.push(`%${suchbegriff}%`, `%${suchbegriff}%`);
  }

  db.all(query, params, (err, projekte) => {
    if (err) return res.send("Fehler beim Laden");
    res.render('projekte', { user, projekte, filter: req.query });
  });
});


// ➕ Projekt anlegen
router.get('/neu', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const result = await db.query(`SELECT * FROM kunden`);
    res.render('projekt_neu', { kunden: result.rows });
  } catch (err) {
    console.error("❌ Fehler beim Laden der Kunden:", err.message);
    res.send("Fehler beim Laden der Kunden");
  }
});

//  Projekt speichern
router.post('/neu', async (req, res) => {
  const { kunden_id, name, beschreibung, startdatum, enddatum, status, abteilung } = req.body;

  try {
    await db.query(
      `INSERT INTO projekte (kunden_id, name, beschreibung, startdatum, enddatum, status, abteilung)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [kunden_id, name, beschreibung, startdatum, enddatum, status, abteilung]
    );
    res.redirect('/projekte');
  } catch (err) {
    console.error("❌ Fehler beim Projekt-Speichern:", err.message);
    res.send("Fehler beim Speichern");
  }
});


// Datei upload
router.post('/details/:id/upload', uploadProjektdatei.single('projektdatei'), async (req, res) => {
  const projektId = req.params.id;
  const file = req.file;
  const { typ, beschreibung } = req.body;

  if (!file || !typ) return res.send("❌ Datei oder Typ fehlt");

  try {
    await db.query(
      `INSERT INTO projektdateien (projekt_id, dateiname, originalname, typ, beschreibung)
       VALUES ($1, $2, $3, $4, $5)`,
      [projektId, file.filename, file.originalname, typ, beschreibung]
    );
    res.redirect(`/projekte/details/${projektId}`);
  } catch (err) {
    console.error("❌ Fehler beim Speichern der Datei:", err.message);
    res.send("❌ Fehler beim Speichern der Datei");
  }
});



// Datei löschen
router.post('/details/:projektId/delete-file/:fileId', async (req, res) => {
  const { projektId, fileId } = req.params;
  const user = req.session.user;

  const erlaubteRollen = ['GL', 'PL', 'Sekretariat'];
  if (!user || !erlaubteRollen.includes(user.rolle)) {
    return res.status(403).send("🚫 Keine Berechtigung zum Löschen");
  }

  try {
    const result = await db.query(`SELECT dateiname FROM projektdateien WHERE id = $1`, [fileId]);
    const row = result.rows[0];
    if (!row) return res.send("❌ Datei nicht gefunden");

    const filepath = path.join(__dirname, '../public/uploads/projektdateien', row.dateiname);
    fs.unlink(filepath, async () => {
      try {
        await db.query(`DELETE FROM projektdateien WHERE id = $1`, [fileId]);
        res.redirect(`/projekte/details/${projektId}`);
      } catch (err2) {
        console.error("❌ Fehler beim Löschen:", err2.message);
        res.send("❌ Fehler beim Löschen");
      }
    });
  } catch (err) {
    console.error("❌ Fehler beim Suchen:", err.message);
    res.send("❌ Fehler beim Löschen");
  }
});

  // ✅ Zugriffsprüfung
  const erlaubteRollen = ['GL', 'PL', 'Sekretariat'];
  if (!user || !erlaubteRollen.includes(user.rolle)) {
    return res.status(403).send("🚫 Keine Berechtigung zum Löschen");
  }

  db.get(`SELECT dateiname FROM projektdateien WHERE id = ?`, [fileId], (err, row) => {
    if (err || !row) return res.send("❌ Datei nicht gefunden");

    const filepath = path.join(__dirname, '../public/uploads/projektdateien', row.dateiname);
    fs.unlink(filepath, () => {
      db.run(`DELETE FROM projektdateien WHERE id = ?`, [fileId], err2 => {
        if (err2) return res.send("❌ Fehler beim Löschen");
        res.redirect(`/projekte/details/${projektId}`);
      });
    });
  });
});

// 📝 Projekt bearbeiten
router.get('/bearbeiten/:id', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  try {
    const result = await db.query(`SELECT * FROM projekte WHERE id = $1`, [req.params.id]);
    const projekt = result.rows[0];
    if (!projekt) return res.send("❌ Projekt nicht gefunden");

    res.render('projekt_bearbeiten', { projekt });
  } catch (err) {
    console.error("❌ Fehler beim Laden des Projekts:", err.message);
    res.send("Fehler beim Laden");
  }
});

// 📝 Projekt speichern
router.post('/bearbeiten/:id', async (req, res) => {
  const projektId = req.params.id;
  const { name, beschreibung, startdatum, enddatum, status, abteilung } = req.body;

  try {
    await db.query(
      `UPDATE projekte 
       SET name = $1, beschreibung = $2, startdatum = $3, enddatum = $4, status = $5, abteilung = $6 
       WHERE id = $7`,
      [name, beschreibung, startdatum, enddatum, status, abteilung, projektId]
    );
    res.redirect(`/projekte/details/${projektId}`);
  } catch (err) {
    console.error("❌ Fehler beim Speichern:", err.message);
    res.send("Fehler beim Speichern");
  }
});


// 📌 Status separat speichern
router.post('/status', async (req, res) => {
  const { projekt_id, status } = req.body;

  try {
    await db.query(`UPDATE projekte SET status = $1 WHERE id = $2`, [status, projekt_id]);
    res.redirect(`/projekte/details/${projekt_id}`);
  } catch (err) {
    console.error("❌ Fehler beim Aktualisieren:", err.message);
    res.send("Fehler beim Aktualisieren");
  }
});


// 🔍 Projekt-Details anzeigen inkl. Dateien
router.get('/details/:id', async (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;
  const projektId = req.params.id;

  try {
    const projektResult = await db.query(`
      SELECT projekte.*, kunden.vorname || ' ' || kunden.name AS kundenname,
             kunden.adresse AS strasse, kunden.plz, kunden.ort
      FROM projekte
      JOIN kunden ON projekte.kunden_id = kunden.id
      WHERE projekte.id = $1
    `, [projektId]);
    const projekt = projektResult.rows[0];
    if (!projekt) return res.send("❌ Projekt nicht gefunden");

    const eintraegeResult = await db.query(`
      SELECT e.*, u.name AS mitarbeitername, u.rolle AS rolle
      FROM projekt_eintraege e
      JOIN users u ON e.mitarbeiter_id = u.id
      WHERE e.projekt_id = $1
    `, [projektId]);

    // Gruppierung der Einträge
    const grouped = {};
    for (const e of eintraegeResult.rows) {
      const key = `${e.datum}_${e.mitarbeiter_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          id: e.id,
          rolle: e.rolle,
          datum: e.datum,
          mitarbeiter_id: e.mitarbeiter_id,
          mitarbeitername: e.mitarbeitername,
          stunden: parseFloat(e.stunden) || 0,
          spesen: parseFloat(e.spesen) || 0,
          taetigkeit: e.taetigkeit ? [e.taetigkeit] : [],
          quittung: e.quittung || null
        };
      } else {
        grouped[key].stunden += parseFloat(e.stunden) || 0;
        grouped[key].spesen += parseFloat(e.spesen) || 0;
        if (e.taetigkeit) grouped[key].taetigkeit.push(e.taetigkeit);
      }
    }
    const eintraegeGruppiert = Object.values(grouped).sort((a, b) => new Date(a.datum) - new Date(b.datum));

    // Dateien-Filter
    let dateiQuery = `SELECT * FROM projektdateien WHERE projekt_id = $1`;
    const dateiParams = [projektId];

    if (req.query.typ) {
      dateiQuery += ` AND typ = $2`;
      dateiParams.push(req.query.typ);
    }

    if (req.query.suche) {
      dateiQuery += ` AND beschreibung ILIKE $${dateiParams.length + 1}`;
      dateiParams.push(`%${req.query.suche}%`);
    }

    const dateienResult = await db.query(dateiQuery, dateiParams);
    const mitarbeiterResult = await db.query(`SELECT id, name FROM users`);
    const materialResult = await db.query(`SELECT * FROM projektmaterial WHERE projekt_id = $1`, [projektId]);

    // Summen berechnen
    let summeStunden = 0;
    let summeSpesen = 0;
    let summeMaterial = 0;

    eintraegeGruppiert.forEach(e => {
      summeStunden += e.stunden;
      summeSpesen += e.spesen;
    });

    materialResult.rows.forEach(m => {
      summeMaterial += m.gesamtpreis;
    });

    const stundensatzMonteur = 60;
    const stundensatzLehrling = 30;

    let totalPersonalKosten = 0;
    eintraegeGruppiert.forEach(e => {
      totalPersonalKosten += e.stunden * (e.rolle === 'Lehrling' ? stundensatzLehrling : stundensatzMonteur);
    });

    const gesamtkosten = totalPersonalKosten + summeSpesen + summeMaterial;

    res.render('projekt_details', {
      projekt,
      eintraege: eintraegeGruppiert,
      user,
      mitarbeiterListe: mitarbeiterResult.rows,
      projektdateien: dateienResult.rows,
      projektmaterial: materialResult.rows,
      filterTyp: req.query.typ || '',
      suche: req.query.suche || '',
      summeStunden,
      summeSpesen,
      summeMaterial,
      totalPersonalKosten,
      gesamtkosten
    });

  } catch (err) {
    console.error("❌ Fehler in /details:", err.message);
    res.send("Fehler beim Laden der Projektdetails");
  }
});


// 🧾 Eintrag erfassen
router.post('/eintrag', upload.single('quittung'), (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const { projekt_id, mitarbeiter_id, datum, stunden, spesen, taetigkeit } = req.body;
  const quittung = req.file ? req.file.filename : null;

  // Stunden validieren
  const stundenFloat = parseFloat(stunden);
  if (stunden && (stundenFloat * 100) % 25 !== 0) {
    return res.send("❌ Nur 0.25er Schritte erlaubt bei Stunden!");
  }

  db.run(`
    INSERT INTO projekt_eintraege 
    (projekt_id, mitarbeiter_id, datum, stunden, spesen, taetigkeit, quittung)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projekt_id, mitarbeiter_id, datum, stunden || 0, spesen || 0, taetigkeit, quittung],
    err => {
      if (err) {
        console.error("❌ Fehler beim Eintrag speichern:", err.message);
        return res.send("❌ Fehler beim Speichern des Eintrags");
      }
      res.redirect(`/projekte/details/${projekt_id}`);
    });
});


// ✏️ Eintrag bearbeiten (Formular anzeigen)
router.get('/eintrag/bearbeiten/:id', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;
  const eintragId = req.params.id;

  db.get(
    `SELECT e.*, u.name AS mitarbeitername, e.projekt_id
     FROM projekt_eintraege e
     JOIN users u ON e.mitarbeiter_id = u.id
     WHERE e.id = ?`,
    [eintragId],
    (err, eintrag) => {
      if (err || !eintrag) return res.send("❌ Eintrag nicht gefunden");

      const erlaubteRollen = ['GL', 'PL', 'Sekretariat', 'admin'];
      if (!erlaubteRollen.includes(user.rolle) && user.id !== eintrag.mitarbeiter_id) {
        return res.send("🚫 Kein Zugriff");
      }

      db.get(`SELECT * FROM projekte WHERE id = ?`, [eintrag.projekt_id], (err2, projekt) => {
        if (err2 || !projekt) return res.send("❌ Projekt nicht gefunden");
        res.render('eintrag_bearbeiten', { eintrag, projekt, user });
      });
    }
  );
});

// 💾 Eintrag speichern
router.post('/eintrag/bearbeiten/:id', upload.single('neue_quittung'), (req, res) => {
  const id = req.params.id;
  const { datum, stunden, spesen, taetigkeit, quittung_loeschen } = req.body;

  db.get(`SELECT quittung, projekt_id FROM projekt_eintraege WHERE id = ?`, [id], (err, row) => {
    if (err || !row) return res.send("❌ Eintrag nicht gefunden");

    let neueDatei = row.quittung;

    if (req.file) {
      if (row.quittung) {
        const alteDatei = path.join(__dirname, '../public/uploads/quittungen', row.quittung);
        fs.unlink(alteDatei, () => {});
      }
      neueDatei = req.file.filename;
    }

    if (quittung_loeschen && row.quittung && !req.file) {
      const alteDatei = path.join(__dirname, '../public/uploads/quittungen', row.quittung);
      fs.unlink(alteDatei, () => {});
      neueDatei = null;
    }

    db.run(
      `UPDATE projekt_eintraege
       SET datum = ?, stunden = ?, spesen = ?, taetigkeit = ?, quittung = ?
       WHERE id = ?`,
      [datum, stunden || 0, spesen || 0, taetigkeit, neueDatei, id],
      err2 => {
        if (err2) return res.send("❌ Fehler beim Speichern");
        res.redirect(`/projekte/details/${row.projekt_id}`);
      }
    );
  });
});

const xlsx = require('xlsx');

// 📡 API-Route für Material-Autocomplete
router.get('/material/autocomplete', (req, res) => {
  const suchbegriff = (req.query.q || '').toLowerCase();
  const workbook = xlsx.readFile('./data/top_1000_artikel.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const daten = xlsx.utils.sheet_to_json(sheet);

  const treffer = daten.filter(e =>
    e['Einheitsnummer']?.toString().toLowerCase().includes(suchbegriff) ||
    e['Bezeichnung 1']?.toLowerCase().includes(suchbegriff)
  ).slice(0, 10);

  const result = treffer.map(e => {
    const basispreis = parseFloat(e['Preis pro 1']) || 0;
    return {
      eNummer: e['Einheitsnummer'],
      bezeichnung: e['Bezeichnung 1'],
      preis: parseFloat((basispreis * 1.6).toFixed(2))
    };
  });

  res.json(result);
});

// Material löschen
router.post('/:projektId/material/:materialId/loeschen', (req, res) => {
  const { projektId, materialId } = req.params;
  const user = req.session.user;

  if (!['GL', 'PL', 'Sekretariat'].includes(user.rolle)) {
    return res.status(403).send("🚫 Kein Zugriff");
  }

  db.run(`DELETE FROM projektmaterial WHERE id = ?`, [materialId], err => {
    if (err) return res.send("❌ Fehler beim Löschen");
    res.redirect(`/projekte/details/${projektId}`);
  });
});

// Materialmenge bearbeiten
router.post('/:projektId/material/:materialId/menge', (req, res) => {
  const { projektId, materialId } = req.params;
  const neueMenge = parseFloat(req.body.menge);

  if (isNaN(neueMenge)) return res.send("❌ Ungültige Menge");

  db.get(`SELECT einzelpreis FROM projektmaterial WHERE id = ?`, [materialId], (err, row) => {
    if (err || !row) return res.send("❌ Eintrag nicht gefunden");

    const neuerGesamtpreis = neueMenge * row.einzelpreis;

    db.run(`
      UPDATE projektmaterial 
      SET menge = ?, gesamtpreis = ?
      WHERE id = ?
    `, [neueMenge, neuerGesamtpreis, materialId], err2 => {
      if (err2) return res.send("❌ Fehler beim Aktualisieren");
      res.redirect(`/projekte/details/${projektId}`);
    });
  });
});




module.exports = router;

