// rolle.js – zentrale Rollenverwaltung

// 🎭 Definierte Rollen
const erlaubteRollen = {
  GL: 'GL',
  PL: 'PL',
  SEK: 'Sekretariat',
  MIT: 'Mitarbeiter',
  LEHRLING: 'Lehrling',
  ADMIN: 'Admin'
};

// ✅ Admin-Erkennung per E-Mail (falls verwendet)
const ADMIN_EMAIL = 'admin@firma.ch';

// 🔐 Flexible Rollenprüfung
const hatRolle = (user, ...rollen) => {
  if (!user || !user.rolle) return false;
  return rollen.includes(user.rolle);
};

// 👤 Admin-Prüfung (nach Email oder Rolle)
const istAdmin = (user) => {
  return user?.rolle === erlaubteRollen.ADMIN || user?.email === ADMIN_EMAIL;
};

// 👥 Einzelne Rollentests
const istGL = (user) => user?.rolle === erlaubteRollen.GL;
const istPL = (user) => user?.rolle === erlaubteRollen.PL;
const istSekretariat = (user) => user?.rolle === erlaubteRollen.SEK;
const istMitarbeiter = (user) => user?.rolle === erlaubteRollen.MIT;
const istLehrling = (user) => user?.rolle === erlaubteRollen.LEHRLING;

module.exports = {
  erlaubteRollen,
  ADMIN_EMAIL,
  hatRolle,
  istAdmin,
  istGL,
  istPL,
  istSekretariat,
  istMitarbeiter,
  istLehrling
};
