const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

db.serialize(async () => {
  // Tabellen löschen
  db.run(`DROP TABLE IF EXISTS weiterbildungen`);
  db.run(`DROP TABLE IF EXISTS projekt_eintraege`);
  db.run(`DROP TABLE IF EXISTS users`);
  db.run(`DROP TABLE IF EXISTS kunden`);
  db.run(`DROP TABLE IF EXISTS kundendokumente`);
  db.run(`DROP TABLE IF EXISTS projekte`);

  // Tabellen erstellen
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    rolle TEXT,
    profilbild TEXT,
    strasse TEXT,
    plz TEXT,
    ort TEXT
  )`);

  db.run(`CREATE TABLE weiterbildungen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    dateiname TEXT,
    originalname TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE kunden (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    vorname TEXT,
    adresse TEXT,
    plz TEXT,
    ort TEXT,
    telefon TEXT,
    email TEXT
  )`);

  db.run(`CREATE TABLE projekte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kunden_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    beschreibung TEXT,
    startdatum TEXT,
    enddatum TEXT,
    status TEXT DEFAULT 'offen',
    FOREIGN KEY(kunden_id) REFERENCES kunden(id)
  )`);

  db.run(`CREATE TABLE projekt_eintraege (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projekt_id INTEGER,
    mitarbeiter_id INTEGER,
    datum TEXT,
    stunden REAL,
    spesen REAL,
    taetigkeit TEXT,
    FOREIGN KEY(projekt_id) REFERENCES projekte(id),
    FOREIGN KEY(mitarbeiter_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE kundendokumente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kunden_id INTEGER,
    dateiname TEXT,
    originalname TEXT,
    typ TEXT,
    FOREIGN KEY(kunden_id) REFERENCES kunden(id)
  )`);

  

  // User anlegen
 const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('password123', 10);

const userData = [
  { name: 'GL Chef', email: 'admin1@firma.ch', rolle: 'GL' },
  { name: 'Projektleiter Peter', email: 'admin2@firma.ch', rolle: 'PL' },
  { name: 'Mitarbeiter Max', email: 'admin3@firma.ch', rolle: 'Mitarbeiter' },
  { name: 'Mitarbeiterin Mia', email: 'admin4@firma.ch', rolle: 'Mitarbeiter' },
  { name: 'Lehrling Luca', email: 'admin5@firma.ch', rolle: 'Lehrling' },
  { name: 'Lehrling Lara', email: 'admin6@firma.ch', rolle: 'Lehrling' },
  { name: 'Sekretariat Sabine', email: 'admin7@firma.ch', rolle: 'Sekretariat' },
  { name: 'Büro Beni', email: 'admin8@firma.ch', rolle: 'Sekretariat' },
  { name: 'Admin Aline', email: 'admin9@firma.ch', rolle: 'GL' },
  { name: 'Admin Alex', email: 'admin10@firma.ch', rolle: 'PL' },
];

for (const user of userData) {
  db.run(`INSERT INTO users (name, email, password, rolle, profilbild, strasse, plz, ort)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user.name, user.email, hash, user.rolle, null, null, null, null]);
}


  console.log('✅ Datenbank neu erstellt mit 10 Nutzern erstellt.');
  db.close();
});
