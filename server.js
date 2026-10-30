const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 4000;

const ADMIN_USER = "ADMIN";
const ADMIN_PASS = "LIEZL2026!";

// 📧 EMAIL CONFIGURATION (AUTO-SEND GMAIL)
const RESORT_EMAIL = "tolledogerald6@gmail.com";
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS || "xtds hcbx rdrv vjbt";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: RESORT_EMAIL, pass: "hmne chka znph hbok" }
});

// 🔒 MULTI-DEVICE ADMIN SESSIONS
let activeSessions = new Set();

const dbFile = path.join(__dirname, 'resort_db.json');
const uploadFolder = path.join(__dirname, 'public', 'uploads');
const sliderFolder = path.join(__dirname, 'public', 'uploads', 'slider');
const facilityFolder = path.join(__dirname, 'public', 'uploads', 'facility');

if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder, { recursive: true });
if (!fs.existsSync(sliderFolder)) fs.mkdirSync(sliderFolder, { recursive: true });
if (!fs.existsSync(facilityFolder)) fs.mkdirSync(facilityFolder, { recursive: true });

const sliderStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, sliderFolder),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const facilityStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, facilityFolder),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const uploadSlider = multer({ storage: sliderStorage });
const uploadFacility = multer({ storage: facilityStorage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/slider-images', express.static(sliderFolder));
app.use('/facility-images', express.static(facilityFolder));

// 🔒 MULTI-DEVICE AUTH MIDDLEWARE
function authAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ success: false, message: "Unauthorized Admin Access!" });
  }
  next();
}

function loadDB() {
  if (!fs.existsSync(dbFile)) {
    const initialData = {
      bookings: [],
      reviews: [{ id: 1, name: "Maria Clara", rating: 5, comment: "Napakaganda ng resort! Malinis ang tubig at mabait ang owner.", date: "10/24/2026" }],
      facilities: [],
      rates: { dayTour: 1500, nightTour: 2000, overnight: 3500 },
      gcashName: "LIEZL RESORT",
      gcashNumber: "0912-345-6789"
    };
    fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  const data = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  if (!data.reviews) data.reviews = [];
  if (!data.facilities) data.facilities = [];
  if (!data.rates) data.rates = { dayTour: 1500, nightTour: 2000, overnight: 3500 };
  if (!data.gcashName) data.gcashName = "LIEZL RESORT";
  if (!data.gcashNumber) data.gcashNumber = "09XX-XXX-XXXX";
  return data;
}

function saveDB(data) { 
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2)); 
}

// 📧 AUTO SEND GMAIL NOTIFICATION FUNCTION
function sendEmailNotification(subject, text) {
  const mailOptions = {
    from: `"Casa Liezl Resort System" <${RESORT_EMAIL}>`,
    to: RESORT_EMAIL,
    subject: subject,
    text: text
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.log("Email Notification Error:", err.message);
    else console.log("Email Sent Successfully:", info.response);
  });
}

// SETTINGS API
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
  res.json({ success: true, message: "Settings updated successfully!" });
});

// PDF VOUCHER
app.get('/api/download-voucher/:id', (req, res) => {
  const db = loadDB();
  const booking = db.bookings.find(b => b.id === parseInt(req.params.id));
  if (!booking) return res.status(404).send("Booking voucher not found.");

  const doc = new PDFDocument({ margin: 50 });
  res.setHeader('Content-disposition', `attachment; filename="Voucher-${booking.id}.pdf"`);
  res.setHeader('Content-type', 'application/pdf');

  doc.pipe(res);
  doc.fillColor('#008080').fontSize(22).text('CASA LIEZL RESORT', { align: 'center' });
  doc.fontSize(12).fillColor('#666').text('Official Booking Receipt & Confirmation Voucher', { align: 'center' });
  doc.moveDown(1.5);
  doc.fillColor('#333').fontSize(12);
  doc.text(`Booking ID: #${booking.id}`);
  doc.text(`Date Issued: ${booking.createdAt}`);
  doc.moveDown(0.5);
  doc.strokeColor('#008080').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
  doc.moveDown(1);
  doc.fontSize(14).fillColor('#004d4d').text('GUEST DETAILS', { underline: true });
  doc.fontSize(12).fillColor('#333');
  doc.text(`Guest Name: ${booking.name}`);
  doc.text(`Contact Phone: ${booking.phone}`);
  doc.moveDown(1);
  doc.fontSize(14).fillColor('#004d4d').text('RESERVATION DETAILS', { underline: true });
  doc.fontSize(12).fillColor('#333');
  doc.text(`Check-in Date: ${booking.checkInDate}`);
  doc.text(`Shift: ${booking.stayType}`);
  doc.text(`Accommodation: ${booking.packageType}`);
  doc.text(`Guests: ${booking.guests} Pax`);
  doc.text(`Special Notes: ${booking.notes || 'N/A'}`);
  doc.moveDown(1);
  doc.fontSize(14).fillColor('#004d4d').text('PAYMENT INFO', { underline: true });
  doc.fontSize(12).fillColor('#333');
  doc.text(`GCash Ref No: ${booking.gcashRef}`);
  doc.text(`Status: ${booking.status}`);
  doc.moveDown(2);
  doc.fontSize(10).fillColor('#888').text('Pakipakita ang PDF Voucher na ito sa entrance ng Casa Liezl Resort.', { align: 'center' });
  doc.end();
});

// REVIEWS APIS
app.get('/api/reviews', (req, res) => res.json(loadDB().reviews || []));

app.post('/api/reviews', (req, res) => {
  const { name, rating, comment } = req.body;
  if (!name || !comment) return res.json({ success: false, message: "Please enter your name and review!" });

  const db = loadDB();
  db.reviews.unshift({ id: Date.now(), name: name.trim(), rating: parseInt(rating) || 5, comment: comment.trim(), date: new Date().toLocaleDateString() });
  saveDB(db);
  res.json({ success: true, message: "Thank you for your feedback!" });
});

app.delete('/api/reviews/:id', authAdmin, (req, res) => {
  const db = loadDB();
  db.reviews = db.reviews.filter(r => r.id !== parseInt(req.params.id));
  saveDB(db);
  res.json({ success: true });
});

// FACILITIES GALLERY APIS (IMAGES AND VIDEOS)
app.get('/api/facilities', (req, res) => res.json(loadDB().facilities || []));

app.post('/upload-facility', uploadFacility.single('facilityMedia'), (req, res) => {
  if (!req.file) return res.redirect('/admin.html');

  const { facilityTitle, mediaType } = req.body;
  const db = loadDB();

  const isVideo = mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(req.file.originalname);

  const newFacility = {
    id: 'fac_' + Date.now(),
    title: facilityTitle ? facilityTitle.trim() : 'Resort Facility',
    type: isVideo ? 'video' : 'image',
    filename: req.file.filename
  };

  db.facilities.unshift(newFacility);
  saveDB(db);
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

// BOOKED DATES
app.get('/api/booked-dates', (req, res) => {
  const db = loadDB();
  res.json(db.bookings.filter(b => b.status === 'APPROVED').map(b => b.checkInDate));
});

// SLIDER APIS
app.get('/api/sliders', (req, res) => {
  fs.readdir(sliderFolder, (err, files) => {
    res.json((files || []).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f)));
  });
});

app.post('/upload-slider', uploadSlider.single('sliderImage'), (req, res) => res.redirect('/admin.html'));

app.delete('/api/sliders/:name', authAdmin, (req, res) => {
  const filePath = path.join(sliderFolder, req.params.name);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ success: true });
});

// BOOKING SUBMISSION API (AUTO-SENDS EMAIL TO YOU)
app.post('/api/book', (req, res) => {
  const { name, phone, checkInDate, stayType, packageType, guests, notes, gcashRef } = req.body;
  if (!name || !phone || !checkInDate || !gcashRef) return res.json({ success: false, message: "Please complete all required fields!" });

  const db = loadDB();
  if (db.bookings.some(b => b.checkInDate === checkInDate && b.status === 'APPROVED')) {
    return res.json({ success: false, message: "Sorry, this date is already fully booked." });
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
    createdAt: new Date().toLocaleString()
  };

  db.bookings.unshift(bookingObj);
  saveDB(db);

  // AUTO SEND EMAIL NOTIFICATION TO tolledogerald6@gmail.com
  const emailContent = 
    `🌴 BAGONG BOOKING REQUEST - CASA LIEZL RESORT 🌴\n\n` +
    `Name: ${bookingObj.name}\n` +
    `Phone: ${bookingObj.phone}\n` +
    `Check-in Date: ${bookingObj.checkInDate} (${bookingObj.stayType})\n` +
    `Package: ${bookingObj.packageType} (${bookingObj.guests} Pax)\n` +
    `GCash Reference No: ${bookingObj.gcashRef}\n` +
    `Notes: ${bookingObj.notes || 'Wala'}\n\n` +
    `Pakicheck ang Admin Panel para ma-verify ang GCash deposit!`;

  sendEmailNotification(`[CASA LIEZL] New Booking Request from ${bookingObj.name}`, emailContent);

  res.json({ success: true, message: "Reservation request submitted successfully!", bookingId: bookingObj.id });
});

// ADMIN APIS (MULTI-DEVICE LOGIN)
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if ((username || '').trim().toUpperCase() === ADMIN_USER && (password || '').trim() === ADMIN_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.add(token); // Pinapayagan ang multi-device concurrent login

    if (activeSessions.size > 50) {
      const firstToken = activeSessions.values().next().value;
      activeSessions.delete(firstToken);
    }

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

  saveDB(db);

  // AUTO SEND EMAIL NOTIFICATION WHEN STATUS CHANGES
  sendEmailNotification(
    `[CASA LIEZL] Booking ${target.status}: ${target.name}`,
    `Ang reservation ni ${target.name} para sa petsang ${target.checkInDate} ay na-update ang status sa: ${target.status}`
  );

  res.json({ success: true, status: target.status });
});

app.listen(PORT, () => console.log(`Casa Liezl Resort Server running on port ${PORT}`));
