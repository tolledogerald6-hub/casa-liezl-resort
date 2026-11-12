const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 4000;

// 🔑 ADMIN CREDENTIALS
const ADMIN_USER = "ADMIN";
const ADMIN_PASS = "LIEZL2026!";

// 📧 EMAIL CONFIGURATION
const RESORT_EMAIL = "tolledogerald6@gmail.com";
const GMAIL_APP_PASS = "hmnechkaznphhbok";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: RESORT_EMAIL, pass: GMAIL_APP_PASS }
});

// 📁 PERSISTENT DATA DIRECTORIES
const dataDir = process.env.DATA_DIR || __dirname;
const dbFile = path.join(dataDir, 'resort_db.json');
const uploadFolder = path.join(__dirname, 'public', 'uploads');
const sliderFolder = path.join(__dirname, 'public', 'uploads', 'slider');
const facilityFolder = path.join(__dirname, 'public', 'uploads', 'facility');

[uploadFolder, sliderFolder, facilityFolder].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 📦 MULTER STORAGE CONFIG
const sliderStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, sliderFolder),
  filename: (req, file, cb) => cb(null, 'slide_' + Date.now() + path.extname(file.originalname))
});

const facilityStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, facilityFolder),
  filename: (req, file, cb) => cb(null, 'fac_' + Date.now() + path.extname(file.originalname))
});

const uploadSlider = multer({ storage: sliderStorage, limits: { fileSize: 50 * 1024 * 1024 } });
const uploadFacility = multer({ storage: facilityStorage, limits: { fileSize: 100 * 1024 * 1024 } });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));
app.use('/slider-images', express.static(sliderFolder));
app.use('/facility-images', express.static(facilityFolder));

// 💾 ATOMIC DATABASE LOAD & SAVE (WITH AUTO-RESTORE FOR IMAGES)
function loadDB() {
  if (!fs.existsSync(dbFile)) {
    const initialData = {
      bookings: [],
      reviews: [
        { id: 1, name: "Maria Clara", rating: 5, comment: "Napakaganda ng resort! Malinis ang tubig at mabait ang owner.", date: "10/24/2026" }
      ],
      facilities: [],
      sliders: [], // Stores filenames + base64 backups so images never disappear
      rates: { dayTour: 1500, nightTour: 2000, overnight: 3500 },
      gcashName: "LIEZL RESORT",
      gcashNumber: "0965-524-7530",
      sessions: []
    };
    saveDB(initialData);
    return initialData;
  }
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    const data = JSON.parse(raw);
    if (!data.bookings) data.bookings = [];
    if (!data.reviews) data.reviews = [];
    if (!data.facilities) data.facilities = [];
    if (!data.sliders) data.sliders = [];
    if (!data.rates) data.rates = { dayTour: 1500, nightTour: 2000, overnight: 3500 };
    if (!data.gcashName) data.gcashName = "LIEZL RESORT";
    if (!data.gcashNumber) data.gcashNumber = "0965-524-7530";
    if (!data.sessions) data.sessions = [];
    return data;
  } catch (err) {
    console.error("⚠️ Database Read Error, returning safe defaults:", err);
    return { bookings: [], reviews: [], facilities: [], sliders: [], rates: { dayTour: 1500, nightTour: 2000, overnight: 3500 }, gcashName: "LIEZL RESORT", gcashNumber: "0965-524-7530", sessions: [] };
  }
}

function saveDB(data) {
  try {
    const tempFile = dbFile + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, dbFile);
  } catch (err) {
    console.error("❌ Failed to save DB:", err);
  }
}

// 🔄 AUTO-RESTORE MISSING MEDIA FILES FROM DB ON SERVER START
function restoreMediaFromDB() {
  const db = loadDB();
  // Sync existing disk slider files into DB if not yet tracked
  if (fs.existsSync(sliderFolder)) {
    const diskSliders = fs.readdirSync(sliderFolder).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    diskSliders.forEach(filename => {
      if (!db.sliders.some(s => s.filename === filename)) {
        const filePath = path.join(sliderFolder, filename);
        const stat = fs.statSync(filePath);
        const base64 = stat.size < 8 * 1024 * 1024 ? fs.readFileSync(filePath).toString('base64') : null;
        db.sliders.push({ filename, base64 });
      }
    });
  }

  // Restore any missing slider files from DB base64
  db.sliders.forEach(s => {
    const filePath = path.join(sliderFolder, s.filename);
    if (!fs.existsSync(filePath) && s.base64) {
      fs.writeFileSync(filePath, Buffer.from(s.base64, 'base64'));
      console.log(`✅ Auto-restored slider image: ${s.filename}`);
    }
  });

  // Restore any missing facility image files from DB base64
  db.facilities.forEach(f => {
    const filePath = path.join(facilityFolder, f.filename);
    if (!fs.existsSync(filePath) && f.base64) {
      fs.writeFileSync(filePath, Buffer.from(f.base64, 'base64'));
      console.log(`✅ Auto-restored facility media: ${f.filename}`);
    }
  });
  saveDB(db);
}
restoreMediaFromDB();

// 🔒 PERSISTENT ADMIN AUTH MIDDLEWARE
function authAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const db = loadDB();
  if (!token || !db.sessions.includes(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized Admin Access! Please login again." });
  }
  next();
}

function sendEmailNotification(subject, text) {
  const mailOptions = {
    from: `"Casa Liezl Private Resort" <${RESORT_EMAIL}>`,
    to: RESORT_EMAIL,
    subject: subject,
    text: text
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("❌ Email Sending Failed:", err.message);
    else console.log("✅ Email Sent Successfully:", info.response);
  });
}

// ⚡ AUTO-AWAKENING / KEEP-ALIVE ENDPOINT
app.get('/api/ping', (req, res) => {
  res.status(200).json({ status: 'awake', timestamp: new Date().toISOString() });
});

// ⚙️ SETTINGS API
app.get('/api/settings', (req, res) => {
  const db = loadDB();
  res.json({ gcashName: db.gcashName, gcashNumber: db.gcashNumber, rates: db.rates });
});

app.post('/api/admin/settings', authAdmin, (req, res) => {
  const { gcashName, gcashNumber, dayTour, nightTour, overnight } = req.body;
  const db = loadDB();
  if (gcashName !== undefined) db.gcashName = String(gcashName).trim();
  if (gcashNumber !== undefined) db.gcashNumber = String(gcashNumber).trim();
  db.rates = {
    dayTour: parseInt(dayTour) || db.rates.dayTour,
    nightTour: parseInt(nightTour) || db.rates.nightTour,
    overnight: parseInt(overnight) || db.rates.overnight
  };
  saveDB(db);
  res.json({ success: true, message: "Resort rates & GCash settings saved!" });
});

// 📄 PDF VOUCHER GENERATOR
app.get('/api/download-voucher/:id', (req, res) => {
  const db = loadDB();
  const booking = db.bookings.find(b => b.id === parseInt(req.params.id));
  if (!booking) return res.status(404).send("Booking voucher not found.");

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-disposition', `attachment; filename="CasaLiezl-Voucher-${booking.id}.pdf"`);
  res.setHeader('Content-type', 'application/pdf');

  doc.pipe(res);
  doc.fillColor('#006666').fontSize(24).text('CASA LIEZL PRIVATE RESORT', { align: 'center' });
  doc.fontSize(11).fillColor('#666').text('Official Booking Receipt & Confirmation Voucher', { align: 'center' });
  doc.moveDown(1.5);

  doc.fillColor('#222').fontSize(12);
  doc.text(`Booking Reference ID: #${booking.id}`);
  doc.text(`Date Issued: ${booking.createdAt}`);
  doc.text(`Reservation Status: ${booking.status}`);
  doc.moveDown(0.8);
  doc.strokeColor('#008080').lineWidth(1.5).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(1);

  doc.fontSize(14).fillColor('#004d4d').text('GUEST INFORMATION', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#333');
  doc.text(`Full Name: ${booking.name}`);
  doc.text(`Contact Number: ${booking.phone}`);
  doc.moveDown(1);

  doc.fontSize(14).fillColor('#004d4d').text('RESERVATION DETAILS', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#333');
  doc.text(`Check-in Date: ${booking.checkInDate}`);
  doc.text(`Shift / Schedule: ${booking.stayType}`);
  doc.text(`Accommodation Package: ${booking.packageType}`);
  doc.text(`Number of Guests: ${booking.guests} Pax`);
  doc.text(`Special Notes: ${booking.notes || 'None'}`);
  doc.moveDown(1);

  doc.fontSize(14).fillColor('#004d4d').text('PAYMENT DETAILS', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#333');
  doc.text(`GCash Reference No: ${booking.gcashRef}`);
  doc.text(`Verification Status: ${booking.status}`);
  doc.moveDown(2.5);

  doc.fontSize(10).fillColor('#777').text('Pakipakita ang PDF Voucher na ito sa entrance ng Casa Liezl Private Resort.', { align: 'center' });
  doc.end();
});

// ⭐ REVIEWS APIS
app.get('/api/reviews', (req, res) => res.json(loadDB().reviews || []));

app.post('/api/reviews', (req, res) => {
  const { name, rating, comment } = req.body;
  if (!name || !comment) return res.json({ success: false, message: "Please enter your name and review!" });

  const db = loadDB();
  db.reviews.unshift({
    id: Date.now(),
    name: name.trim(),
    rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
    comment: comment.trim(),
    date: new Date().toLocaleDateString('en-PH')
  });
  saveDB(db);
  res.json({ success: true, message: "Maraming salamat sa iyong review!" });
});

app.delete('/api/reviews/:id', authAdmin, (req, res) => {
  const db = loadDB();
  db.reviews = db.reviews.filter(r => r.id !== parseInt(req.params.id));
  saveDB(db);
  res.json({ success: true });
});

// 🏊‍♂️ FACILITIES GALLERY APIS
app.get('/api/facilities', (req, res) => {
  const db = loadDB();
  // Strip base64 payload when sending list to keep response fast
  const cleanList = (db.facilities || []).map(({ base64, ...rest }) => rest);
  res.json(cleanList);
});

app.post('/upload-facility', uploadFacility.single('facilityMedia'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No media file uploaded." });
  }

  const { facilityTitle, mediaType } = req.body;
  const db = loadDB();
  const isVideo = mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(req.file.originalname);

  // Save base64 backup if file is under 8MB so it survives free-tier server resets
  let base64Data = null;
  if (req.file.size < 8 * 1024 * 1024) {
    base64Data = fs.readFileSync(req.file.path).toString('base64');
  }

  const newFacility = {
    id: 'fac_' + Date.now(),
    title: facilityTitle ? facilityTitle.trim() : 'Resort Facility',
    type: isVideo ? 'video' : 'image',
    filename: req.file.filename,
    base64: base64Data
  };

  db.facilities.unshift(newFacility);
  saveDB(db);

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, message: "Facility media uploaded!", item: { id: newFacility.id, title: newFacility.title, type: newFacility.type, filename: newFacility.filename } });
  }
  res.redirect('/admin.html');
});

app.delete('/api/facilities/:id', authAdmin, (req, res) => {
  const db = loadDB();
  const target = db.facilities.find(f => f.id === req.params.id);

  if (target) {
    const filePath = path.join(facilityFolder, target.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.facilities = db.facilities.filter(f => f.id !== req.params.id);
    saveDB(db);
  }
  res.json({ success: true });
});

// 📅 BOOKED DATES & PUBLIC BOOKING CHECKER
app.get('/api/booked-dates', (req, res) => {
  const db = loadDB();
  res.json(db.bookings.filter(b => b.status === 'APPROVED').map(b => b.checkInDate));
});

app.get('/api/booking-status/:query', (req, res) => {
  const q = (req.params.query || '').trim().toLowerCase();
  const db = loadDB();
  const matches = db.bookings.filter(b =>
    String(b.id) === q ||
    (b.gcashRef && b.gcashRef.toLowerCase() === q) ||
    (b.phone && b.phone.replace(/\D/g, '').slice(-9) === q.replace(/\D/g, '').slice(-9) && q.length >= 7)
  );
  res.json({ success: true, bookings: matches });
});

// 🖼️ SLIDER APIS
app.get('/api/sliders', (req, res) => {
  const db = loadDB();
  fs.readdir(sliderFolder, (err, files) => {
    const diskFiles = (files || []).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    const dbFiles = (db.sliders || []).map(s => s.filename);
    const combined = Array.from(new Set([...dbFiles, ...diskFiles]));
    res.json(combined);
  });
});

app.post('/upload-slider', uploadSlider.single('sliderImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image selected." });
  }
  const db = loadDB();
  let base64Data = null;
  if (req.file.size < 8 * 1024 * 1024) {
    base64Data = fs.readFileSync(req.file.path).toString('base64');
  }
  db.sliders.unshift({ filename: req.file.filename, base64: base64Data });
  saveDB(db);

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, filename: req.file.filename, message: "Banner uploaded successfully!" });
  }
  res.redirect('/admin.html');
});

app.delete('/api/sliders/:name', authAdmin, (req, res) => {
  const filename = path.basename(req.params.name);
  const filePath = path.join(sliderFolder, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const db = loadDB();
  db.sliders = (db.sliders || []).filter(s => s.filename !== filename);
  saveDB(db);
  res.json({ success: true });
});

// 📝 BOOKING SUBMISSION API
app.post('/api/book', (req, res) => {
  const { name, phone, checkInDate, stayType, packageType, guests, notes, gcashRef } = req.body;
  if (!name || !phone || !checkInDate || !gcashRef) {
    return res.json({ success: false, message: "Pakikumpleto ang lahat ng required fields!" });
  }

  const db = loadDB();
  if (db.bookings.some(b => b.checkInDate === checkInDate && b.status === 'APPROVED')) {
    return res.json({ success: false, message: "Paumanhin, fully booked na ang petsang ito. Pumili ng ibang petsa." });
  }

  const bookingObj = {
    id: Date.now(),
    name: name.trim(),
    phone: phone.trim(),
    checkInDate,
    stayType,
    packageType,
    guests: parseInt(guests) || 1,
    notes: notes ? notes.trim() : "",
    gcashRef: gcashRef.trim(),
    status: "PENDING",
    createdAt: new Date().toLocaleString('en-PH')
  };

  db.bookings.unshift(bookingObj);
  saveDB(db);

  const emailContent =
    `🌴 BAGONG BOOKING REQUEST - CASA LIEZL PRIVATE RESORT 🌴\n\n` +
    `Booking ID: #${bookingObj.id}\n` +
    `Name: ${bookingObj.name}\n` +
    `Phone: ${bookingObj.phone}\n` +
    `Check-in Date: ${bookingObj.checkInDate} (${bookingObj.stayType})\n` +
    `Package: ${bookingObj.packageType} (${bookingObj.guests} Pax)\n` +
    `GCash Reference No: ${bookingObj.gcashRef}\n` +
    `Notes: ${bookingObj.notes || 'Wala'}\n\n` +
    `Pakicheck ang Admin Panel para ma-verify ang GCash deposit!`;

  sendEmailNotification(`[CASA LIEZL PRIVATE] New Booking Request from ${bookingObj.name}`, emailContent);

  res.json({ success: true, message: "Reservation request submitted successfully!", bookingId: bookingObj.id });
});

// 🔐 ADMIN APIS
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if ((username || '').trim().toUpperCase() === ADMIN_USER && (password || '').trim() === ADMIN_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    const db = loadDB();
    db.sessions.push(token);
    if (db.sessions.length > 50) db.sessions.shift();
    saveDB(db);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Invalid Username or Password!" });
  }
});

app.get('/api/admin/bookings', authAdmin, (req, res) => res.json(loadDB().bookings || []));

app.post('/api/admin/process-booking', authAdmin, (req, res) => {
  const { id, action } = req.body;
  const db = loadDB();
  const target = db.bookings.find(b => b.id === parseInt(id));
  if (!target) return res.status(404).json({ success: false, message: "Booking not found" });

  if (action === 'APPROVE') target.status = 'APPROVED';
  else if (action === 'REJECT') target.status = 'REJECTED';
  else if (action === 'PENDING') target.status = 'PENDING';

  saveDB(db);

  sendEmailNotification(
    `[CASA LIEZL PRIVATE] Booking ${target.status}: ${target.name}`,
    `Ang reservation ni ${target.name} para sa petsang ${target.checkInDate} ay na-update ang status sa: ${target.status}`
  );

  res.json({ success: true, status: target.status });
});

app.delete('/api/admin/bookings/:id', authAdmin, (req, res) => {
  const db = loadDB();
  db.bookings = db.bookings.filter(b => b.id !== parseInt(req.params.id));
  saveDB(db);
  res.json({ success: true, message: "Booking record deleted." });
});

// 💾 ADMIN FULL BACKUP EXPORT & IMPORT (PROTECTS AGAINST CLOUD REDEPLOY RESETS)
app.get('/api/admin/backup', authAdmin, (req, res) => {
  const db = loadDB();
  res.setHeader('Content-disposition', `attachment; filename="CasaLiezl_Backup_${new Date().toISOString().split('T')[0]}.json"`);
  res.setHeader('Content-type', 'application/json');
  res.send(JSON.stringify(db, null, 2));
});

app.post('/api/admin/restore', authAdmin, (req, res) => {
  const backupData = req.body;
  if (!backupData || !Array.isArray(backupData.bookings)) {
    return res.status(400).json({ success: false, message: "Invalid backup file format!" });
  }
  const currentDB = loadDB();
  backupData.sessions = currentDB.sessions; // Keep current admin logged in
  saveDB(backupData);
  restoreMediaFromDB();
  res.json({ success: true, message: "Database & Media successfully restored!" });
});

app.listen(PORT, () => {
  console.log(`🌴 Casa Liezl Private Resort Server running on port ${PORT}`);

  // ⏰ AUTO-AWAKENING SELF-PINGER (Runs every 5 minutes to prevent server sleep)
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    const client = RENDER_URL.startsWith('https') ? https : http;
    client.get(`${RENDER_URL}/api/ping`, (res) => {
      console.log(`⚡ Auto-Awakening Ping: Status ${res.statusCode} at ${new Date().toLocaleTimeString()}`);
    }).on('error', (err) => {
      console.error('⚠️ Auto-Awakening Ping Error:', err.message);
    });
  }, 5 * 60 * 1000); // 5 minutes
});
