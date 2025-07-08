const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const multer = require('multer');
const fs = require('fs');

const uploadFolder = path.join(__dirname, 'public', 'uploads', 'quittungen');
fs.mkdirSync(uploadFolder, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });
app.locals.upload = upload;


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));


// ✅ Session immer VOR den Routen!
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// ⬇️ Jetzt die Routen laden
const auth = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const profilRoutes = require('./routes/profil');
const kundenRoutes = require('./routes/kunden');
const projekteRoutes = require('./routes/projekte');

app.use('/', auth.router);
app.use('/dashboard', dashboardRoutes);
app.use('/profil', profilRoutes);
app.use('/kunden', kundenRoutes);
app.use('/projekte', projekteRoutes);

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.listen(3000, () => {
  console.log('✅ App läuft auf http://localhost:3000');
});
