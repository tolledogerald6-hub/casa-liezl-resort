/**
 * ============================================================================
 * 🌴 CASA LIEZL PRIVATE RESORT - ENTERPRISE MANAGEMENT & ERP SERVER
 * ============================================================================
 * Features Included:
 *  1. Atomic JSON Database Engine with Auto-Rolling Snapshots
 *  2. Base64 Media Persistence (Auto-heals missing slider/facility/receipt files)
 *  3. Complete Audit Trail & System Activity Logger (Tracks every action & IP)
 *  4. Multi-Shift & Conflict-Free Reservation Engine (Day, Night, 22-Hr Stay)
 *  5. Dynamic Packages, Cottages & Add-ons Inventory Manager
 *  6. Promo Codes & Discount Voucher Engine
 *  7. Walk-In POS & Resort Expense Tracker (Real-time Net Profit Analytics)
 *  8. GCash Receipt Screenshot Upload & Verification System
 *  9. Customer Inquiry / Helpdesk Ticketing System
 * 10. Official Branded PDF Voucher & Financial Report Generator
 * 11. Anti-Spam Rate Limiter, Brute-Force Protection & IP Blacklist
 * 12. Dual Auto-Awakening Engine (Self-Ping + External Heartbeat)
 * ============================================================================
 */

const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const http = require('http');
const https = require('https');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 4000;
const SERVER_START_TIME = Date.now();

// ============================================================================
// 🔑 1. DEFAULT CREDENTIALS & EMAIL CONFIGURATION
// ============================================================================
const DEFAULT_ADMIN_USER = "ADMIN";
const DEFAULT_ADMIN_PASS = "LIEZL2026!";

const RESORT_EMAIL = "tolledogerald6@gmail.com";
const GMAIL_APP_PASS = "hmnechkaznphhbok";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: RESORT_EMAIL,
    pass: GMAIL_APP_PASS
  }
});

// ============================================================================
// 📁 2. PERSISTENT DIRECTORIES & STORAGE INITIALIZATION
// ============================================================================
const dataDir = process.env.DATA_DIR || __dirname;
const dbFile = path.join(dataDir, 'resort_db.json');
const backupFolder = path.join(dataDir, 'backups');

const publicFolder = path.join(__dirname, 'public');
const uploadFolder = path.join(publicFolder, 'uploads');
const sliderFolder = path.join(uploadFolder, 'slider');
const facilityFolder = path.join(uploadFolder, 'facility');
const receiptFolder = path.join(uploadFolder, 'receipts');

[
  dataDir,
  backupFolder,
  publicFolder,
  uploadFolder,
  sliderFolder,
  facilityFolder,
  receiptFolder
].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================================================
// 📦 3. MULTER UPLOAD CONFIGURATIONS (SLIDERS, FACILITIES, GCASH RECEIPTS)
// ============================================================================
const sliderStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, sliderFolder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `slide_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
  }
});

const facilityStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, facilityFolder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `fac_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
  }
});

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, receiptFolder),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `rcpt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
  }
});

const uploadSlider = multer({
  storage: sliderStorage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const uploadFacility = multer({
  storage: facilityStorage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

const uploadReceipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 15 * 1024 * 1024 }
});

// ============================================================================
// ⚙️ 4. EXPRESS MIDDLEWARE & STATIC ROUTES
// ============================================================================
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(publicFolder));
app.use('/slider-images', express.static(sliderFolder));
app.use('/facility-images', express.static(facilityFolder));
app.use('/receipt-images', express.static(receiptFolder));

// Helper to get Client IP
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
}

// ============================================================================
// 💾 5. ENTERPRISE DATABASE ENGINE (LOAD, SAVE, SNAPSHOT, AUTO-HEAL)
// ============================================================================
function getInitialDBSchema() {
  return {
    meta: {
      version: "2.5.0-ENTERPRISE",
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      totalSaves: 0
    },
    adminConfig: {
      username: DEFAULT_ADMIN_USER,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASS),
      resortName: "CASA LIEZL PRIVATE RESORT",
      tagline: "Relax, Refresh, & Reconnect in Our Tropical Sanctuary",
      contactPhone: "0965-524-7530",
      contactEmail: RESORT_EMAIL,
      facebookUrl: "https://www.facebook.com/profile.php?id=100090588501360",
      messengerUrl: "https://m.me/100090588501360",
      googleMapsUrl: "https://maps.app.goo.gl/m8rQJqR2rM5haS4u5",
      wazeUrl: "https://waze.com/ul?q=Casa%20Liezl%20Resort",
      announcementBanner: "🌴 Promo Alert: Book our 22-Hour Exclusive Staycation this month and enjoy FREE Videoke use!",
      showAnnouncement: true,
      downpaymentPercent: 50
    },
    gcashName: "LIEZL RESORT",
    gcashNumber: "0965-524-7530",
    rates: {
      dayTour: 1500,
      nightTour: 2000,
      overnight: 3500,
      extraGuestFee: 150,
      videokeFee: 500
    },
    packages: [
      {
        id: "pkg_cottage",
        name: "Standard Open Cottage",
        price: 0,
        maxPax: 10,
        description: "Spacious poolside open cottage great for day tour groups.",
        available: true
      },
      {
        id: "pkg_aircon_std",
        name: "Aircon Room (2-4 Pax)",
        price: 1000,
        maxPax: 4,
        description: "Cozy air-conditioned room with private bathroom.",
        available: true
      },
      {
        id: "pkg_family",
        name: "Family Aircon Room (6-10 Pax)",
        price: 2000,
        maxPax: 10,
        description: "Large family suite with multiple beds and comfort room.",
        available: true
      },
      {
        id: "pkg_exclusive",
        name: "Private / Exclusive Resort Rental",
        price: 5000,
        maxPax: 35,
        description: "Full exclusive access to all pools, cottages, griller, and rooms.",
        available: true
      }
    ],
    addons: [
      { id: "add_videoke", name: "Unlimited Videoke Rental", price: 500, available: true },
      { id: "add_mattress", name: "Extra Foam Mattress", price: 200, available: true },
      { id: "add_lpg", name: "LPG Gas Stove & Kitchen Use", price: 350, available: true },
      { id: "add_towel", name: "Extra Bath Towel", price: 50, available: true }
    ],
    promos: [
      {
        id: "promo_welcome",
        code: "CASALIEZL2026",
        discountType: "FIXED", // FIXED or PERCENT
        discountValue: 300,
        minSpend: 1500,
        maxUses: 100,
        usedCount: 0,
        active: true,
        expiresAt: "2027-12-31"
      }
    ],
    blockedDates: [], // Format: { date: 'YYYY-MM-DD', reason: 'Pool Maintenance', shift: 'ALL' }
    bookings: [],
    expenses: [], // Format: { id, title, category, amount, date, notes, recordedBy }
    inquiries: [], // Format: { id, name, phone, message, status, adminReply, createdAt }
    reviews: [
      {
        id: 1,
        name: "Maria Clara",
        rating: 5,
        comment: "Napakaganda ng resort! Malinis ang tubig at mabait ang owner.",
        adminReply: "Maraming salamat po sa pagbisita sa Casa Liezl Private Resort! Balik po kayo!",
        featured: true,
        date: "10/24/2026"
      }
    ],
    facilities: [],
    sliders: [],
    sessions: [],
    security: {
      blockedIPs: [],
      failedLogins: {}
    },
    auditLogs: [],
    analytics: {
      pageViews: 0,
      uniqueVisitors: [],
      dailyStats: {}
    }
  };
}

function hashPassword(plainText) {
  return crypto.createHash('sha256').update(String(plainText)).digest('hex');
}

let memoryDBCache = null;

function loadDB() {
  if (memoryDBCache) return memoryDBCache;

  if (!fs.existsSync(dbFile)) {
    const initial = getInitialDBSchema();
    saveDB(initial, true);
    memoryDBCache = initial;
    return initial;
  }

  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    const data = JSON.parse(raw);
    const defaults = getInitialDBSchema();

    // Ensure backward-compatible schema migration
    if (!data.meta) data.meta = defaults.meta;
    if (!data.adminConfig) data.adminConfig = defaults.adminConfig;
    if (!data.gcashName) data.gcashName = defaults.gcashName;
    if (!data.gcashNumber) data.gcashNumber = defaults.gcashNumber;
    if (!data.rates) data.rates = defaults.rates;
    if (!data.packages || !data.packages.length) data.packages = defaults.packages;
    if (!data.addons) data.addons = defaults.addons;
    if (!data.promos) data.promos = defaults.promos;
    if (!data.blockedDates) data.blockedDates = [];
    if (!data.bookings) data.bookings = [];
    if (!data.expenses) data.expenses = [];
    if (!data.inquiries) data.inquiries = [];
    if (!data.reviews) data.reviews = defaults.reviews;
    if (!data.facilities) data.facilities = [];
    if (!data.sliders) data.sliders = [];
    if (!data.sessions) data.sessions = [];
    if (!data.security) data.security = defaults.security;
    if (!data.auditLogs) data.auditLogs = [];
    if (!data.analytics) data.analytics = defaults.analytics;

    memoryDBCache = data;
    return data;
  } catch (err) {
    console.error("⚠️ Database Corrupted or Unreadable! Attempting auto-recovery from backups...", err);
    const recovered = recoverLatestSnapshot();
    if (recovered) {
      memoryDBCache = recovered;
      return recovered;
    }
    const fallback = getInitialDBSchema();
    memoryDBCache = fallback;
    return fallback;
  }
}

function saveDB(data, createSnapshot = false) {
  try {
    if (!data.meta) data.meta = { version: "2.5.0-ENTERPRISE", totalSaves: 0 };
    data.meta.lastUpdated = new Date().toISOString();
    data.meta.totalSaves = (data.meta.totalSaves || 0) + 1;

    memoryDBCache = data;

    const serialized = JSON.stringify(data, null, 2);
    const tempFile = `${dbFile}.tmp`;
    fs.writeFileSync(tempFile, serialized, 'utf8');
    fs.renameSync(tempFile, dbFile);

    // Create rolling snapshot every 20 saves or when explicitly requested
    if (createSnapshot || data.meta.totalSaves % 20 === 0) {
      createRollingBackup(serialized);
    }
  } catch (err) {
    console.error("❌ CRITICAL ERROR SAVING DATABASE:", err);
  }
}

function createRollingBackup(serializedData) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapFile = path.join(backupFolder, `snapshot_${stamp}.json`);
    fs.writeFileSync(snapFile, serializedData, 'utf8');

    // Keep only latest 15 snapshots to save disk space
    const files = fs.readdirSync(backupFolder)
      .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
      .sort();

    while (files.length > 15) {
      const oldest = files.shift();
      fs.unlinkSync(path.join(backupFolder, oldest));
    }
  } catch (e) {
    console.error("⚠️ Rolling Backup Warning:", e.message);
  }
}

function recoverLatestSnapshot() {
  try {
    if (!fs.existsSync(backupFolder)) return null;
    const files = fs.readdirSync(backupFolder)
      .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
      .sort()
      .reverse();

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(backupFolder, file), 'utf8');
        const parsed = JSON.parse(raw);
        console.log(`✅ Recovered database from snapshot: ${file}`);
        fs.writeFileSync(dbFile, raw, 'utf8');
        return parsed;
      } catch (_) {
        continue;
      }
    }
  } catch (e) {
    console.error("❌ Snapshot recovery failed:", e.message);
  }
  return null;
}

// ============================================================================
// 📝 6. AUDIT TRAIL LOGGER (RECORDS EVERYTHING DONE IN THE SYSTEM)
// ============================================================================
function recordAuditLog(action, details, req = null, actor = "ADMIN") {
  try {
    const db = loadDB();
    const ip = req ? getClientIP(req) : "SYSTEM";
    const userAgent = req ? (req.headers['user-agent'] || 'Unknown') : "Internal";

    const logEntry = {
      id: `log_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
      timestamp: new Date().toLocaleString('en-PH'),
      isoTime: new Date().toISOString(),
      actor,
      action,
      details,
      ip,
      userAgent: userAgent.slice(0, 120)
    };

    db.auditLogs.unshift(logEntry);

    // Keep latest 1,500 audit logs so DB stays fast
    if (db.auditLogs.length > 1500) {
      db.auditLogs = db.auditLogs.slice(0, 1500);
    }

    saveDB(db);
  } catch (err) {
    console.error("⚠️ Audit Log Error:", err.message);
  }
}

// ============================================================================
// 🔄 7. MEDIA AUTO-RESTORATION ENGINE (SURVIVES EPHEMERAL CLOUD RESETS)
// ============================================================================
function restoreAndSyncMedia() {
  const db = loadDB();
  let modified = false;

  // 1. Sync any existing slider files on disk into DB
  if (fs.existsSync(sliderFolder)) {
    const diskSliders = fs.readdirSync(sliderFolder).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    diskSliders.forEach(filename => {
      if (!db.sliders.some(s => s.filename === filename)) {
        const filePath = path.join(sliderFolder, filename);
        const stat = fs.statSync(filePath);
        const base64 = stat.size < 10 * 1024 * 1024 ? fs.readFileSync(filePath).toString('base64') : null;
        db.sliders.push({
          filename,
          uploadedAt: new Date().toLocaleString('en-PH'),
          base64
        });
        modified = true;
      }
    });
  }

  // 2. Restore missing slider files from DB base64
  db.sliders.forEach(s => {
    const filePath = path.join(sliderFolder, s.filename);
    if (!fs.existsSync(filePath) && s.base64) {
      fs.writeFileSync(filePath, Buffer.from(s.base64, 'base64'));
      console.log(`✅ Auto-healed missing slider image: ${s.filename}`);
    }
  });

  // 3. Restore missing facility files from DB base64
  db.facilities.forEach(f => {
    const filePath = path.join(facilityFolder, f.filename);
    if (!fs.existsSync(filePath) && f.base64) {
      fs.writeFileSync(filePath, Buffer.from(f.base64, 'base64'));
      console.log(`✅ Auto-healed missing facility media: ${f.filename}`);
    }
  });

  // 4. Restore missing GCash receipt screenshots from bookings
  db.bookings.forEach(b => {
    if (b.receiptFilename && b.receiptBase64) {
      const filePath = path.join(receiptFolder, b.receiptFilename);
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, Buffer.from(b.receiptBase64, 'base64'));
        console.log(`✅ Auto-healed missing GCash receipt: ${b.receiptFilename}`);
      }
    }
  });

  if (modified) saveDB(db);
}

restoreAndSyncMedia();

// ============================================================================
// 🛡️ 8. SECURITY, IP BLOCKLIST & RATE LIMITER MIDDLEWARE
// ============================================================================
const rateLimitMap = new Map();

function securityMiddleware(req, res, next) {
  const ip = getClientIP(req);
  const db = loadDB();

  // Check if IP is blacklisted
  if (db.security?.blockedIPs?.includes(ip)) {
    return res.status(403).json({
      success: false,
      message: "Access Denied: Your IP address has been restricted by the Resort Administrator."
    });
  }

  // Track Page Views on public HTML requests
  if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
    const today = new Date().toISOString().split('T')[0];
    db.analytics.pageViews = (db.analytics.pageViews || 0) + 1;
    if (!db.analytics.dailyStats[today]) {
      db.analytics.dailyStats[today] = { views: 0, bookings: 0 };
    }
    db.analytics.dailyStats[today].views += 1;
    if (!db.analytics.uniqueVisitors.includes(ip)) {
      db.analytics.uniqueVisitors.push(ip);
      if (db.analytics.uniqueVisitors.length > 5000) db.analytics.uniqueVisitors.shift();
    }
  }

  // Simple Anti-Spam Rate Limiting for POST API endpoints
  if (req.method === 'POST' && req.path.startsWith('/api/')) {
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const record = rateLimitMap.get(key) || { count: 0, startTime: now };

    if (now - record.startTime > 60 * 1000) {
      record.count = 1;
      record.startTime = now;
    } else {
      record.count += 1;
    }
    rateLimitMap.set(key, record);

    if (record.count > 30) {
      recordAuditLog("RATE_LIMIT_TRIGGERED", `Excessive POST requests to ${req.path}`, req, "SECURITY_GUARD");
      return res.status(429).json({
        success: false,
        message: "Too many requests! Please wait 1 minute before trying again."
      });
    }
  }

  next();
}

app.use(securityMiddleware);

function authAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  const db = loadDB();

  const validSession = db.sessions.find(s =>
    typeof s === 'string' ? s === token : s.token === token
  );

  if (!token || !validSession) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized Admin Access! Please login again."
    });
  }
  next();
}

// ============================================================================
// 📧 9. EMAIL NOTIFICATION ENGINE (ADMIN & GUEST CONFIRMATIONS)
// ============================================================================
function sendEmailNotification(subject, text, recipientEmail = RESORT_EMAIL, htmlContent = null) {
  const mailOptions = {
    from: `"Casa Liezl Private Resort" <${RESORT_EMAIL}>`,
    to: recipientEmail,
    subject: subject,
    text: text
  };
  if (htmlContent) mailOptions.html = htmlContent;

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error(`❌ Email Sending Failed (${recipientEmail}):`, err.message);
    } else {
      console.log(`✅ Email Sent (${recipientEmail}):`, info.response);
    }
  });
}

// ============================================================================
// 🧮 10. PRICING & AVAILABILITY CALCULATION HELPERS
// ============================================================================
function calculateBookingPrice( { stayType, packageType, guests, addonsList = [], promoCode = "" }) {
  const db = loadDB();
  let baseStayPrice = Number(db.rates.dayTour) || 1500;

  if (stayType && stayType.toLowerCase().includes('night')) {
    baseStayPrice = Number(db.rates.nightTour) || 2000;
  } else if (stayType && (stayType.toLowerCase().includes('22') || stayType.toLowerCase().includes('overnight') || stayType.toLowerCase().includes('exclusive'))) {
    baseStayPrice = Number(db.rates.overnight) || 3500;
  }

  // Package price
  let pkgPrice = 0;
  const matchedPkg = db.packages.find(p => p.name === packageType || p.id === packageType);
  if (matchedPkg) {
    pkgPrice = Number(matchedPkg.price) || 0;
  }

  // Add-ons total
  let addonsTotal = 0;
  const selectedAddonObjects = [];
  if (Array.isArray(addonsList)) {
    addonsList.forEach(addIdOrName => {
      const found = db.addons.find(a => a.id === addIdOrName || a.name === addIdOrName);
      if (found) {
        addonsTotal += Number(found.price) || 0;
        selectedAddonObjects.push({ id: found.id, name: found.name, price: found.price });
      }
    });
  }

  const subtotal = baseStayPrice + pkgPrice + addonsTotal;

  // Promo discount
  let discountAmount = 0;
  let appliedPromo = null;
  if (promoCode) {
    const cleanCode = String(promoCode).trim().toUpperCase();
    const promo = db.promos.find(p => p.code.toUpperCase() === cleanCode && p.active);
    if (promo) {
      const notExpired = !promo.expiresAt || new Date(promo.expiresAt) >= new Date();
      const underLimit = !promo.maxUses || (promo.usedCount || 0) < promo.maxUses;
      const meetsMinSpend = !promo.minSpend || subtotal >= promo.minSpend;

      if (notExpired && underLimit && meetsMinSpend) {
        if (promo.discountType === 'PERCENT') {
          discountAmount = Math.round(subtotal * (Number(promo.discountValue) / 100));
        } else {
          discountAmount = Number(promo.discountValue) || 0;
        }
        appliedPromo = promo.code;
      }
    }
  }

  const grandTotal = Math.max(0, subtotal - discountAmount);
  const downpaymentPercent = Number(db.adminConfig?.downpaymentPercent) || 50;
  const requiredDownpayment = Math.round(grandTotal * (downpaymentPercent / 100));

  return {
    baseStayPrice,
    pkgPrice,
    addonsTotal,
    selectedAddonObjects,
    subtotal,
    discountAmount,
    appliedPromo,
    grandTotal,
    requiredDownpayment
  };
}

function isDateShiftConflict(checkInDate, stayType) {
  const db = loadDB();

  // Check manual blocked dates first
  const manualBlock = db.blockedDates.find(b => b.date === checkInDate);
  if (manualBlock) {
    return { conflict: true, reason: `Date is closed: ${manualBlock.reason || 'Resort Maintenance'}` };
  }

  // Check approved bookings on that date
  const approvedOnDate = db.bookings.filter(b => b.checkInDate === checkInDate && b.status === 'APPROVED');
  if (approvedOnDate.length === 0) return { conflict: false };

  const reqIs22Hr = (stayType || '').toLowerCase().includes('22');
  for (const existing of approvedOnDate) {
    const exIs22Hr = (existing.stayType || '').toLowerCase().includes('22');
    // If either booking is 22-Hour Exclusive, the entire date is locked
    if (reqIs22Hr || exIs22Hr || existing.stayType === stayType) {
      return { conflict: true, reason: `Selected date & shift (${stayType}) is already booked.` };
    }
  }

  return { conflict: false };
}

// ============================================================================
// ⚡ 11. AUTO-AWAKENING & HEALTH DIAGNOSTICS ENDPOINTS
// ============================================================================
app.get('/api/ping', (req, res) => {
  const db = loadDB();
  res.status(200).json({
    status: 'awake',
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    totalBookings: db.bookings.length,
    totalSaves: db.meta?.totalSaves || 0
  });
});

app.get('/api/system-health', authAdmin, (req, res) => {
  const db = loadDB();
  const mem = process.memoryUsage();
  res.json({
    success: true,
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    memoryMB: Math.round(mem.rss / 1024 / 1024),
    platform: `${os.type()} ${os.release()}`,
    dbSizeKB: fs.existsSync(dbFile) ? Math.round(fs.statSync(dbFile).size / 1024) : 0,
    counts: {
      bookings: db.bookings.length,
      reviews: db.reviews.length,
      facilities: db.facilities.length,
      sliders: db.sliders.length,
      expenses: db.expenses.length,
      inquiries: db.inquiries.length,
      auditLogs: db.auditLogs.length,
      pageViews: db.analytics?.pageViews || 0
    }
  });
});

// ============================================================================
// ⚙️ 12. PUBLIC & ADMIN SETTINGS, PACKAGES, ADD-ONS, & PROMOS APIS
// ============================================================================
app.get('/api/settings', (req, res) => {
  const db = loadDB();
  res.json({
    gcashName: db.gcashName,
    gcashNumber: db.gcashNumber,
    rates: db.rates,
    packages: db.packages,
    addons: db.addons,
    resortInfo: {
      resortName: db.adminConfig.resortName,
      tagline: db.adminConfig.tagline,
      contactPhone: db.adminConfig.contactPhone,
      contactEmail: db.adminConfig.contactEmail,
      facebookUrl: db.adminConfig.facebookUrl,
      messengerUrl: db.adminConfig.messengerUrl,
      googleMapsUrl: db.adminConfig.googleMapsUrl,
      wazeUrl: db.adminConfig.wazeUrl,
      announcementBanner: db.adminConfig.announcementBanner,
      showAnnouncement: db.adminConfig.showAnnouncement,
      downpaymentPercent: db.adminConfig.downpaymentPercent
    }
  });
});

app.post('/api/admin/settings', authAdmin, (req, res) => {
  const {
    gcashName,
    gcashNumber,
    dayTour,
    nightTour,
    overnight,
    extraGuestFee,
    videokeFee,
    resortName,
    tagline,
    contactPhone,
    announcementBanner,
    showAnnouncement,
    downpaymentPercent
  } = req.body;

  const db = loadDB();
  if (gcashName !== undefined) db.gcashName = String(gcashName).trim();
  if (gcashNumber !== undefined) db.gcashNumber = String(gcashNumber).trim();

  db.rates = {
    dayTour: parseInt(dayTour) || db.rates.dayTour,
    nightTour: parseInt(nightTour) || db.rates.nightTour,
    overnight: parseInt(overnight) || db.rates.overnight,
    extraGuestFee: parseInt(extraGuestFee) || db.rates.extraGuestFee || 150,
    videokeFee: parseInt(videokeFee) || db.rates.videokeFee || 500
  };

  if (resortName !== undefined) db.adminConfig.resortName = String(resortName).trim();
  if (tagline !== undefined) db.adminConfig.tagline = String(tagline).trim();
  if (contactPhone !== undefined) db.adminConfig.contactPhone = String(contactPhone).trim();
  if (announcementBanner !== undefined) db.adminConfig.announcementBanner = String(announcementBanner).trim();
  if (showAnnouncement !== undefined) db.adminConfig.showAnnouncement = Boolean(showAnnouncement);
  if (downpaymentPercent !== undefined) db.adminConfig.downpaymentPercent = parseInt(downpaymentPercent) || 50;

  saveDB(db, true);
  recordAuditLog("UPDATE_SETTINGS", `Updated GCash (${db.gcashNumber}) & Rates (Day: ₱${db.rates.dayTour}, Night: ₱${db.rates.nightTour}, 22Hr: ₱${db.rates.overnight})`, req);

  res.json({ success: true, message: "All Resort & GCash settings saved!" });
});

// DYNAMIC PACKAGES / ROOMS CRUD
app.post('/api/admin/packages', authAdmin, (req, res) => {
  const { id, name, price, maxPax, description, available } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Package name is required." });

  const db = loadDB();
  if (id) {
    const existing = db.packages.find(p => p.id === id);
    if (existing) {
      existing.name = name.trim();
      existing.price = parseInt(price) || 0;
      existing.maxPax = parseInt(maxPax) || 4;
      existing.description = description || "";
      existing.available = available !== false;
      saveDB(db);
      recordAuditLog("UPDATE_PACKAGE", `Updated package: ${existing.name} (₱${existing.price})`, req);
      return res.json({ success: true, message: "Package updated!", packages: db.packages });
    }
  }

  const newPkg = {
    id: `pkg_${Date.now()}`,
    name: name.trim(),
    price: parseInt(price) || 0,
    maxPax: parseInt(maxPax) || 4,
    description: description || "",
    available: true
  };
  db.packages.push(newPkg);
  saveDB(db);
  recordAuditLog("CREATE_PACKAGE", `Added package: ${newPkg.name} (₱${newPkg.price})`, req);
  res.json({ success: true, message: "New accommodation package added!", packages: db.packages });
});

app.delete('/api/admin/packages/:id', authAdmin, (req, res) => {
  const db = loadDB();
  const target = db.packages.find(p => p.id === req.params.id);
  db.packages = db.packages.filter(p => p.id !== req.params.id);
  saveDB(db);
  recordAuditLog("DELETE_PACKAGE", `Deleted package: ${target ? target.name : req.params.id}`, req);
  res.json({ success: true, packages: db.packages });
});

// ADD-ONS CRUD
app.post('/api/admin/addons', authAdmin, (req, res) => {
  const { name, price } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Add-on name is required." });

  const db = loadDB();
  const newAddon = {
    id: `add_${Date.now()}`,
    name: name.trim(),
    price: parseInt(price) || 0,
    available: true
  };
  db.addons.push(newAddon);
  saveDB(db);
  recordAuditLog("CREATE_ADDON", `Added add-on: ${newAddon.name} (₱${newAddon.price})`, req);
  res.json({ success: true, message: "Add-on saved!", addons: db.addons });
});

app.delete('/api/admin/addons/:id', authAdmin, (req, res) => {
  const db = loadDB();
  db.addons = db.addons.filter(a => a.id !== req.params.id);
  saveDB(db);
  recordAuditLog("DELETE_ADDON", `Removed add-on ID: ${req.params.id}`, req);
  res.json({ success: true, addons: db.addons });
});

// PROMO CODES CRUD & VALIDATION
app.get('/api/admin/promos', authAdmin, (req, res) => {
  res.json(loadDB().promos || []);
});

app.post('/api/admin/promos', authAdmin, (req, res) => {
  const { code, discountType, discountValue, minSpend, maxUses, expiresAt } = req.body;
  if (!code || !discountValue) {
    return res.status(400).json({ success: false, message: "Promo code and discount value are required." });
  }

  const db = loadDB();
  const cleanCode = String(code).trim().toUpperCase();
  db.promos = db.promos.filter(p => p.code.toUpperCase() !== cleanCode);

  const newPromo = {
    id: `promo_${Date.now()}`,
    code: cleanCode,
    discountType: discountType === 'PERCENT' ? 'PERCENT' : 'FIXED',
    discountValue: parseInt(discountValue) || 100,
    minSpend: parseInt(minSpend) || 0,
    maxUses: parseInt(maxUses) || 100,
    usedCount: 0,
    active: true,
    expiresAt: expiresAt || "2027-12-31"
  };

  db.promos.unshift(newPromo);
  saveDB(db);
  recordAuditLog("CREATE_PROMO", `Created promo code ${cleanCode} (${newPromo.discountValue} ${newPromo.discountType})`, req);
  res.json({ success: true, message: `Promo code ${cleanCode} created!`, promos: db.promos });
});

app.delete('/api/admin/promos/:id', authAdmin, (req, res) => {
  const db = loadDB();
  db.promos = db.promos.filter(p => p.id !== req.params.id);
  saveDB(db);
  recordAuditLog("DELETE_PROMO", `Deleted promo ID: ${req.params.id}`, req);
  res.json({ success: true, promos: db.promos });
});

app.post('/api/validate-promo', (req, res) => {
  const { stayType, packageType, guests, addonsList, promoCode } = req.body;
  const pricing = calculateBookingPrice({ stayType, packageType, guests, addonsList, promoCode });
  if (promoCode && !pricing.appliedPromo) {
    return res.json({ success: false, message: "Invalid, expired, or minimum spend not met for this promo code.", pricing });
  }
  res.json({ success: true, message: pricing.appliedPromo ? `Promo ${pricing.appliedPromo} applied! (-₱${pricing.discountAmount})` : "Price calculated", pricing });
});

// ============================================================================
// 📄 13. OFFICIAL BRANDED PDF VOUCHER & FINANCIAL REPORT GENERATOR
// ============================================================================
app.get('/api/download-voucher/:id', (req, res) => {
  const db = loadDB();
  const booking = db.bookings.find(b => b.id === parseInt(req.params.id));
  if (!booking) return res.status(404).send("Booking voucher not found.");

  const doc = new PDFDocument({ margin: 45, size: 'A4' });
  res.setHeader('Content-disposition', `attachment; filename="CasaLiezl-Voucher-${booking.id}.pdf"`);
  res.setHeader('Content-type', 'application/pdf');

  doc.pipe(res);

  // Header Banner Box
  doc.rect(45, 40, 505, 70).fill('#006666');
  doc.fillColor('#ffffff').fontSize(22).text(db.adminConfig.resortName || 'CASA LIEZL PRIVATE RESORT', 45, 55, { align: 'center', width: 505 });
  doc.fontSize(10).fillColor('#e0f2f1').text('Official Reservation Receipt & Entrance Confirmation Pass', 45, 84, { align: 'center', width: 505 });

  doc.moveDown(2.5);
  doc.fillColor('#1e293b').fontSize(11);
  doc.text(`Booking Reference ID: #${booking.id}`, 50, 130);
  doc.text(`Date Issued: ${booking.createdAt}`, 50, 146);
  doc.text(`Verification Status: ${booking.status}`, 350, 130);
  doc.text(`GCash Reference No: ${booking.gcashRef}`, 350, 146);

  doc.moveTo(45, 170).lineTo(550, 170).strokeColor('#cbd5e1').lineWidth(1).stroke();

  // Guest Details
  doc.fontSize(13).fillColor('#004d4d').text('GUEST INFORMATION', 50, 185, { underline: true });
  doc.fontSize(11).fillColor('#334155');
  doc.text(`Guest Name: ${booking.name}`, 50, 205);
  doc.text(`Contact Phone: ${booking.phone}`, 50, 222);
  doc.text(`Email Address: ${booking.email || 'N/A'}`, 50, 239);

  // Reservation Details
  doc.fontSize(13).fillColor('#004d4d').text('RESERVATION SCHEDULE & PACKAGE', 50, 270, { underline: true });
  doc.fontSize(11).fillColor('#334155');
  doc.text(`Check-in Date: ${booking.checkInDate}`, 50, 290);
  doc.text(`Shift / Schedule: ${booking.stayType}`, 50, 307);
  doc.text(`Accommodation: ${booking.packageType}`, 50, 324);
  doc.text(`Number of Guests: ${booking.guests} Pax`, 50, 341);
  if (booking.addons && booking.addons.length) {
    doc.text(`Selected Add-ons: ${booking.addons.map(a => a.name || a).join(', ')}`, 50, 358);
  }
  doc.text(`Special Notes: ${booking.notes || 'None'}`, 50, 375);

  // Financial Breakdown Box
  doc.rect(45, 405, 505, 115).fillAndStroke('#f8fafc', '#cbd5e1');
  doc.fillColor('#004d4d').fontSize(13).text('PAYMENT & BILLING SUMMARY', 60, 418);
  doc.fillColor('#334155').fontSize(11);
  const totalAmt = booking.totalAmount || db.rates.dayTour || 1500;
  const discountAmt = booking.discountAmount || 0;
  const paidAmt = booking.amountPaid || 0;
  const balanceAmt = Math.max(0, totalAmt - paidAmt);

  doc.text(`Total Package Amount: PHP ${Number(totalAmt).toLocaleString()}`, 60, 440);
  if (discountAmt > 0) {
    doc.text(`Promo Discount Applied (${booking.promoCode || 'PROMO'}): -PHP ${Number(discountAmt).toLocaleString()}`, 60, 456);
  }
  doc.text(`Verified Deposit / Amount Paid: PHP ${Number(paidAmt).toLocaleString()}`, 60, 472);
  doc.fillColor('#b91c1c').fontSize(12).text(`Remaining Balance Upon Check-in: PHP ${Number(balanceAmt).toLocaleString()}`, 60, 492);

  // Resort Rules
  doc.fillColor('#475569').fontSize(9.5);
  doc.text('IMPORTANT REMINDERS:', 50, 545, { underline: true });
  doc.text('1. Please present this PDF Voucher (printed or on your phone) upon arrival at Casa Liezl Private Resort.', 50, 560);
  doc.text('2. Outside food and non-alcoholic drinks are allowed with NO corkage fee.', 50, 574);
  doc.text('3. Downpayments are non-refundable but may be rescheduled if requested at least 7 days before check-in.', 50, 588);

  doc.fillColor('#94a3b8').fontSize(9).text(`Generated by Casa Liezl Enterprise System • Contact: ${db.adminConfig.contactPhone}`, 45, 640, { align: 'center', width: 505 });
  doc.end();
});

// ============================================================================
// ⭐ 14. CUSTOMER REVIEWS & ADMIN REPLY APIS
// ============================================================================
app.get('/api/reviews', (req, res) => res.json(loadDB().reviews || []));

app.post('/api/reviews', (req, res) => {
  const { name, rating, comment } = req.body;
  if (!name || !comment) {
    return res.json({ success: false, message: "Pakilagay ang iyong pangalan at komento!" });
  }

  const db = loadDB();
  const newRev = {
    id: Date.now(),
    name: name.trim(),
    rating: Math.min(5, Math.max(1, parseInt(rating) || 5)),
    comment: comment.trim(),
    adminReply: "",
    featured: false,
    date: new Date().toLocaleDateString('en-PH')
  };

  db.reviews.unshift(newRev);
  saveDB(db);
  recordAuditLog("NEW_REVIEW", `Guest ${newRev.name} left a ${newRev.rating}-star review`, req, "GUEST");
  res.json({ success: true, message: "Maraming salamat sa iyong review!" });
});

app.post('/api/admin/reviews/:id/reply', authAdmin, (req, res) => {
  const { replyText } = req.body;
  const db = loadDB();
  const target = db.reviews.find(r => r.id === parseInt(req.params.id));
  if (!target) return res.status(404).json({ success: false, message: "Review not found" });

  target.adminReply = (replyText || '').trim();
  saveDB(db);
  recordAuditLog("REPLY_REVIEW", `Replied to review by ${target.name}`, req);
  res.json({ success: true, message: "Owner reply saved!" });
});

app.delete('/api/reviews/:id', authAdmin, (req, res) => {
  const db = loadDB();
  const target = db.reviews.find(r => r.id === parseInt(req.params.id));
  db.reviews = db.reviews.filter(r => r.id !== parseInt(req.params.id));
  saveDB(db);
  recordAuditLog("DELETE_REVIEW", `Deleted review from ${target ? target.name : req.params.id}`, req);
  res.json({ success: true });
});

// ============================================================================
// 🏊‍♂️ 15. FACILITIES & HERO SLIDER MEDIA MANAGEMENT (WITH BASE64 PERSISTENCE)
// ============================================================================
app.get('/api/facilities', (req, res) => {
  const db = loadDB();
  const cleanList = (db.facilities || []).map(({ base64, ...rest }) => rest);
  res.json(cleanList);
});

app.post('/upload-facility', uploadFacility.single('facilityMedia'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No media file uploaded." });
  }

  const { facilityTitle, mediaType, category } = req.body;
  const db = loadDB();
  const isVideo = mediaType === 'video' || /\.(mp4|webm|mov)$/i.test(req.file.originalname);

  let base64Data = null;
  if (req.file.size < 10 * 1024 * 1024) {
    base64Data = fs.readFileSync(req.file.path).toString('base64');
  }

  const newFacility = {
    id: `fac_${Date.now()}`,
    title: facilityTitle ? facilityTitle.trim() : 'Resort Facility',
    category: category || 'Pools & Rooms',
    type: isVideo ? 'video' : 'image',
    filename: req.file.filename,
    uploadedAt: new Date().toLocaleString('en-PH'),
    base64: base64Data
  };

  db.facilities.unshift(newFacility);
  saveDB(db, true);
  recordAuditLog("UPLOAD_FACILITY", `Uploaded ${newFacility.type}: "${newFacility.title}" (${req.file.filename})`, req);

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    const { base64, ...cleanItem } = newFacility;
    return res.json({ success: true, message: "Facility media uploaded & backed up!", item: cleanItem });
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
    saveDB(db, true);
    recordAuditLog("DELETE_FACILITY", `Deleted facility media: "${target.title}" (${target.filename})`, req);
  }
  res.json({ success: true });
});

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
    return res.status(400).json({ success: false, message: "No banner image selected." });
  }
  const db = loadDB();
  let base64Data = null;
  if (req.file.size < 10 * 1024 * 1024) {
    base64Data = fs.readFileSync(req.file.path).toString('base64');
  }

  db.sliders.unshift({
    filename: req.file.filename,
    uploadedAt: new Date().toLocaleString('en-PH'),
    base64: base64Data
  });
  saveDB(db, true);
  recordAuditLog("UPLOAD_SLIDER", `Uploaded hero slider banner: ${req.file.filename}`, req);

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, filename: req.file.filename, message: "Banner uploaded & permanently saved!" });
  }
  res.redirect('/admin.html');
});

app.delete('/api/sliders/:name', authAdmin, (req, res) => {
  const filename = path.basename(req.params.name);
  const filePath = path.join(sliderFolder, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const db = loadDB();
  db.sliders = (db.sliders || []).filter(s => s.filename !== filename);
  saveDB(db, true);
  recordAuditLog("DELETE_SLIDER", `Deleted hero slider banner: ${filename}`, req);
  res.json({ success: true });
});

// ============================================================================
// 📅 16. BOOKED DATES, BLOCKED DATES, & PUBLIC STATUS TRACKER
// ============================================================================
app.get('/api/booked-dates', (req, res) => {
  const db = loadDB();
  const approvedDates = db.bookings
    .filter(b => b.status === 'APPROVED')
    .map(b => b.checkInDate);
  const manualBlocked = (db.blockedDates || []).map(d => d.date);
  const allUnavailable = Array.from(new Set([...approvedDates, ...manualBlocked]));
  res.json(allUnavailable);
});

app.get('/api/admin/blocked-dates', authAdmin, (req, res) => {
  res.json(loadDB().blockedDates || []);
});

app.post('/api/admin/blocked-dates', authAdmin, (req, res) => {
  const { date, reason } = req.body;
  if (!date) return res.status(400).json({ success: false, message: "Date is required." });

  const db = loadDB();
  db.blockedDates = db.blockedDates.filter(d => d.date !== date);
  db.blockedDates.push({
    id: `blk_${Date.now()}`,
    date,
    reason: reason || "Resort Maintenance / Private Event",
    createdAt: new Date().toLocaleString('en-PH')
  });
  saveDB(db);
  recordAuditLog("BLOCK_DATE", `Blocked calendar date ${date} (${reason || 'Maintenance'})`, req);
  res.json({ success: true, message: `Date ${date} blocked on calendar!`, blockedDates: db.blockedDates });
});

app.delete('/api/admin/blocked-dates/:date', authAdmin, (req, res) => {
  const db = loadDB();
  db.blockedDates = db.blockedDates.filter(d => d.date !== req.params.date);
  saveDB(db);
  recordAuditLog("UNBLOCK_DATE", `Unblocked calendar date ${req.params.date}`, req);
  res.json({ success: true, blockedDates: db.blockedDates });
});

app.get('/api/booking-status/:query', (req, res) => {
  const q = (req.params.query || '').trim().toLowerCase();
  const db = loadDB();
  const matches = db.bookings
    .filter(b =>
      String(b.id) === q ||
      (b.gcashRef && b.gcashRef.toLowerCase() === q) ||
      (b.phone && b.phone.replace(/\D/g, '').slice(-9) === q.replace(/\D/g, '').slice(-9) && q.length >= 7)
    )
    .map(({ receiptBase64, ...cleanBooking }) => cleanBooking);

  res.json({ success: true, bookings: matches });
});

// ============================================================================
// 📝 17. RESERVATION SUBMISSION API (WITH GCASH SCREENSHOT & PROMO ENGINE)
// ============================================================================
app.post('/api/book', uploadReceipt.single('receiptImage'), (req, res) => {
  let {
    name,
    phone,
    email,
    checkInDate,
    stayType,
    packageType,
    guests,
    notes,
    gcashRef,
    addons,
    promoCode,
    amountPaid
  } = req.body;

  if (!name || !phone || !checkInDate || !gcashRef) {
    return res.json({ success: false, message: "Pakikumpleto ang lahat ng required fields (Name, Phone, Date, at GCash Ref)!" });
  }

  // Parse addons if sent as JSON string in multipart form
  let parsedAddons = [];
  if (addons) {
    try {
      parsedAddons = typeof addons === 'string' ? JSON.parse(addons) : addons;
    } catch (_) {
      parsedAddons = [];
    }
  }

  const conflictCheck = isDateShiftConflict(checkInDate, stayType);
  if (conflictCheck.conflict) {
    return res.json({ success: false, message: conflictCheck.reason });
  }

  const pricing = calculateBookingPrice({
    stayType,
    packageType,
    guests,
    addonsList: parsedAddons,
    promoCode
  });

  const db = loadDB();

  // Increment promo usage if applied
  if (pricing.appliedPromo) {
    const promoObj = db.promos.find(p => p.code === pricing.appliedPromo);
    if (promoObj) promoObj.usedCount = (promoObj.usedCount || 0) + 1;
  }

  // Save GCash receipt screenshot if uploaded
  let receiptFilename = null;
  let receiptBase64 = null;
  if (req.file) {
    receiptFilename = req.file.filename;
    if (req.file.size < 8 * 1024 * 1024) {
      receiptBase64 = fs.readFileSync(req.file.path).toString('base64');
    }
  }

  const bookingObj = {
    id: Date.now(),
    name: name.trim(),
    phone: phone.trim(),
    email: email ? email.trim() : "",
    checkInDate,
    stayType: stayType || "Day Tour (8:00 AM - 5:00 PM)",
    packageType: packageType || "Standard Cottage",
    guests: parseInt(guests) || 1,
    addons: pricing.selectedAddonObjects,
    promoCode: pricing.appliedPromo || "",
    discountAmount: pricing.discountAmount,
    totalAmount: pricing.grandTotal,
    requiredDownpayment: pricing.requiredDownpayment,
    amountPaid: parseInt(amountPaid) || pricing.requiredDownpayment,
    notes: notes ? notes.trim() : "",
    gcashRef: gcashRef.trim(),
    receiptFilename,
    receiptBase64,
    bookingSource: "ONLINE_WEBSITE",
    status: "PENDING",
    createdAt: new Date().toLocaleString('en-PH'),
    isoDate: new Date().toISOString()
  };

  db.bookings.unshift(bookingObj);

  // Track daily booking analytics
  const today = new Date().toISOString().split('T')[0];
  if (!db.analytics.dailyStats[today]) {
    db.analytics.dailyStats[today] = { views: 0, bookings: 0 };
  }
  db.analytics.dailyStats[today].bookings += 1;

  saveDB(db, true);
  recordAuditLog(
    "NEW_BOOKING",
    `Booking #${bookingObj.id} by ${bookingObj.name} for ${bookingObj.checkInDate} (${bookingObj.stayType}) - Total: ₱${bookingObj.totalAmount}`,
    req,
    "GUEST"
  );

  const adminEmailText =
    `🌴 BAGONG BOOKING REQUEST - CASA LIEZL PRIVATE RESORT 🌴\n\n` +
    `Booking ID: #${bookingObj.id}\n` +
    `Name: ${bookingObj.name}\n` +
    `Phone: ${bookingObj.phone}\n` +
    `Email: ${bookingObj.email || 'N/A'}\n` +
    `Check-in Date: ${bookingObj.checkInDate} (${bookingObj.stayType})\n` +
    `Package: ${bookingObj.packageType} (${bookingObj.guests} Pax)\n` +
    `Total Amount: ₱${bookingObj.totalAmount.toLocaleString()}\n` +
    `GCash Reference No: ${bookingObj.gcashRef}\n` +
    `Notes: ${bookingObj.notes || 'Wala'}\n\n` +
    `Pakicheck ang Admin Panel para ma-verify ang GCash deposit!`;

  sendEmailNotification(`[CASA LIEZL] New Booking #${bookingObj.id} - ${bookingObj.name}`, adminEmailText);

  if (bookingObj.email && bookingObj.email.includes('@')) {
    const guestEmailText =
      `Hello ${bookingObj.name},\n\n` +
      `Natanggap na namin ang iyong reservation request sa Casa Liezl Private Resort!\n\n` +
      `Booking ID: #${bookingObj.id}\n` +
      `Check-in Date: ${bookingObj.checkInDate}\n` +
      `Schedule: ${bookingObj.stayType}\n` +
      `Package: ${bookingObj.packageType}\n` +
      `Total Bill: ₱${bookingObj.totalAmount.toLocaleString()}\n` +
      `GCash Ref: ${bookingObj.gcashRef}\n` +
      `Status: PENDING VERIFICATION\n\n` +
      `Maaari mong i-check ang status at i-download ang iyong PDF Voucher sa aming website gamit ang iyong Booking ID o GCash Reference Number.\n\n` +
      `Maraming Salamat,\nCasa Liezl Private Resort Team`;
    sendEmailNotification(`Casa Liezl Private Resort - Booking Request #${bookingObj.id}`, guestEmailText, bookingObj.email);
  }

  res.json({
    success: true,
    message: "Reservation request submitted successfully!",
    bookingId: bookingObj.id,
    pricing
  });
});

// ============================================================================
// 💸 18. WALK-IN POS BOOKING, EXPENSE TRACKER & FINANCIAL ANALYTICS APIS
// ============================================================================
app.post('/api/admin/walkin-booking', authAdmin, (req, res) => {
  const { name, phone, checkInDate, stayType, packageType, guests, totalAmount, amountPaid, notes } = req.body;
  if (!name || !checkInDate) {
    return res.status(400).json({ success: false, message: "Guest Name and Date are required." });
  }

  const db = loadDB();
  const walkInObj = {
    id: Date.now(),
    name: name.trim(),
    phone: (phone || 'Walk-In').trim(),
    email: "",
    checkInDate,
    stayType: stayType || "Day Tour (8:00 AM - 5:00 PM)",
    packageType: packageType || "Walk-In Guest",
    guests: parseInt(guests) || 1,
    addons: [],
    promoCode: "",
    discountAmount: 0,
    totalAmount: parseInt(totalAmount) || db.rates.dayTour || 1500,
    requiredDownpayment: 0,
    amountPaid: parseInt(amountPaid) || parseInt(totalAmount) || 1500,
    notes: notes ? notes.trim() : "Walk-In POS Booking",
    gcashRef: "WALK-IN / CASH",
    receiptFilename: null,
    receiptBase64: null,
    bookingSource: "ADMIN_WALK_IN",
    status: "APPROVED",
    createdAt: new Date().toLocaleString('en-PH'),
    isoDate: new Date().toISOString()
  };

  db.bookings.unshift(walkInObj);
  saveDB(db, true);
  recordAuditLog("WALKIN_BOOKING", `Recorded Walk-In Booking #${walkInObj.id} for ${walkInObj.name} (₱${walkInObj.totalAmount})`, req);

  res.json({ success: true, message: "Walk-in booking recorded & approved!", booking: walkInObj });
});

app.get('/api/admin/expenses', authAdmin, (req, res) => {
  res.json(loadDB().expenses || []);
});

app.post('/api/admin/expenses', authAdmin, (req, res) => {
  const { title, category, amount, date, notes } = req.body;
  if (!title || !amount) {
    return res.status(400).json({ success: false, message: "Expense title and amount are required." });
  }

  const db = loadDB();
  const exp = {
    id: `exp_${Date.now()}`,
    title: title.trim(),
    category: category || "Maintenance & Utilities",
    amount: parseInt(amount) || 0,
    date: date || new Date().toISOString().split('T')[0],
    notes: notes ? notes.trim() : "",
    createdAt: new Date().toLocaleString('en-PH')
  };

  db.expenses.unshift(exp);
  saveDB(db);
  recordAuditLog("ADD_EXPENSE", `Logged resort expense: ${exp.title} (₱${exp.amount})`, req);
  res.json({ success: true, message: "Expense recorded!", expenses: db.expenses });
});

app.delete('/api/admin/expenses/:id', authAdmin, (req, res) => {
  const db = loadDB();
  const target = db.expenses.find(e => e.id === req.params.id);
  db.expenses = db.expenses.filter(e => e.id !== req.params.id);
  saveDB(db);
  recordAuditLog("DELETE_EXPENSE", `Deleted expense: ${target ? target.title : req.params.id}`, req);
  res.json({ success: true, expenses: db.expenses });
});

app.get('/api/admin/financial-summary', authAdmin, (req, res) => {
  const db = loadDB();
  const approvedBookings = db.bookings.filter(b => b.status === 'APPROVED');

  const grossRevenue = approvedBookings.reduce((sum, b) => {
    const amt = b.totalAmount || (b.stayType?.includes('22') ? db.rates.overnight : b.stayType?.includes('Night') ? db.rates.nightTour : db.rates.dayTour) || 1500;
    return sum + Number(amt);
  }, 0);

  const totalCollected = approvedBookings.reduce((sum, b) => sum + (Number(b.amountPaid) || Number(b.totalAmount) || 0), 0);
  const totalExpenses = (db.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netProfit = grossRevenue - totalExpenses;

  res.json({
    success: true,
    grossRevenue,
    totalCollected,
    totalExpenses,
    netProfit,
    approvedCount: approvedBookings.length,
    pendingCount: db.bookings.filter(b => b.status === 'PENDING').length,
    rejectedCount: db.bookings.filter(b => b.status === 'REJECTED').length,
    pageViews: db.analytics?.pageViews || 0,
    uniqueVisitorsCount: db.analytics?.uniqueVisitors?.length || 0
  });
});

// ============================================================================
// 💬 19. CUSTOMER INQUIRY / DIRECT MESSAGE HELPDESK SYSTEM
// ============================================================================
app.post('/api/inquiries', (req, res) => {
  const { name, phone, message } = req.body;
  if (!name || !phone || !message) {
    return res.status(400).json({ success: false, message: "Please provide your name, phone number, and message." });
  }

  const db = loadDB();
  const inq = {
    id: `inq_${Date.now()}`,
    name: name.trim(),
    phone: phone.trim(),
    message: message.trim(),
    status: "UNREAD",
    adminNotes: "",
    createdAt: new Date().toLocaleString('en-PH')
  };

  db.inquiries.unshift(inq);
  saveDB(db);
  recordAuditLog("NEW_INQUIRY", `Inquiry from ${inq.name} (${inq.phone})`, req, "GUEST");

  sendEmailNotification(
    `[CASA LIEZL INQUIRY] Message from ${inq.name}`,
    `Name: ${inq.name}\nPhone: ${inq.phone}\nMessage:\n${inq.message}`
  );

  res.json({ success: true, message: "Naipadala na ang iyong mensahe! Tatawagan o ite-text ka ng aming staff." });
});

app.get('/api/admin/inquiries', authAdmin, (req, res) => {
  res.json(loadDB().inquiries || []);
});

app.post('/api/admin/inquiries/:id/resolve', authAdmin, (req, res) => {
  const { adminNotes } = req.body;
  const db = loadDB();
  const target = db.inquiries.find(i => i.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, message: "Inquiry not found" });

  target.status = "RESOLVED";
  if (adminNotes !== undefined) target.adminNotes = adminNotes;
  saveDB(db);
  recordAuditLog("RESOLVE_INQUIRY", `Resolved inquiry from ${target.name}`, req);
  res.json({ success: true, inquiries: db.inquiries });
});

app.delete('/api/admin/inquiries/:id', authAdmin, (req, res) => {
  const db = loadDB();
  db.inquiries = db.inquiries.filter(i => i.id !== req.params.id);
  saveDB(db);
  res.json({ success: true, inquiries: db.inquiries });
});

// ============================================================================
// 🔐 20. ADMIN AUTH, BOOKING MANAGEMENT, AUDIT LOGS & BACKUP/RESTORE APIS
// ============================================================================
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  const ip = getClientIP(req);

  const inputUser = (username || '').trim().toUpperCase();
  const inputPass = (password || '').trim();
  const inputHash = hashPassword(inputPass);

  const isDefaultMatch = (inputUser === DEFAULT_ADMIN_USER && inputPass === DEFAULT_ADMIN_PASS);
  const isCustomMatch = (
    inputUser === (db.adminConfig?.username || DEFAULT_ADMIN_USER).toUpperCase() &&
    inputHash === db.adminConfig?.passwordHash
  );

  if (isDefaultMatch || isCustomMatch) {
    const token = crypto.randomBytes(32).toString('hex');
    db.sessions.push({
      token,
      ip,
      loginAt: new Date().toLocaleString('en-PH')
    });
    if (db.sessions.length > 50) db.sessions.shift();
    if (db.security.failedLogins[ip]) delete db.security.failedLogins[ip];

    saveDB(db);
    recordAuditLog("ADMIN_LOGIN_SUCCESS", `Admin logged in from IP ${ip}`, req);
    res.json({ success: true, token });
  } else {
    db.security.failedLogins[ip] = (db.security.failedLogins[ip] || 0) + 1;
    saveDB(db);
    recordAuditLog("ADMIN_LOGIN_FAILED", `Failed login attempt (${inputUser}) from IP ${ip}`, req, "UNKNOWN");
    res.status(401).json({ success: false, message: "Invalid Admin Username or Password!" });
  }
});

app.post('/api/admin/change-password', authAdmin, (req, res) => {
  const { newUsername, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
  }
  const db = loadDB();
  if (newUsername) db.adminConfig.username = newUsername.trim().toUpperCase();
  db.adminConfig.passwordHash = hashPassword(newPassword.trim());
  saveDB(db, true);
  recordAuditLog("CHANGE_ADMIN_PASSWORD", `Updated admin credentials`, req);
  res.json({ success: true, message: "Admin password updated successfully!" });
});

app.get('/api/admin/bookings', authAdmin, (req, res) => {
  const db = loadDB();
  const cleanBookings = (db.bookings || []).map(({ receiptBase64, ...rest }) => rest);
  res.json(cleanBookings);
});

app.post('/api/admin/process-booking', authAdmin, (req, res) => {
  const { id, action, amountPaid, adminNotes } = req.body;
  const db = loadDB();
  const target = db.bookings.find(b => b.id === parseInt(id));
  if (!target) return res.status(404).json({ success: false, message: "Booking not found" });

  if (action === 'APPROVE') target.status = 'APPROVED';
  else if (action === 'REJECT') target.status = 'REJECTED';
  else if (action === 'PENDING') target.status = 'PENDING';

  if (amountPaid !== undefined) target.amountPaid = parseInt(amountPaid) || target.amountPaid;
  if (adminNotes !== undefined) target.adminNotes = String(adminNotes).trim();

  saveDB(db, true);
  recordAuditLog("PROCESS_BOOKING", `Booking #${target.id} (${target.name}) marked as ${target.status}`, req);

  sendEmailNotification(
    `[CASA LIEZL PRIVATE] Booking ${target.status}: ${target.name}`,
    `Ang reservation ni ${target.name} (#${target.id}) para sa petsang ${target.checkInDate} ay na-update ang status sa: ${target.status}`
  );

  if (target.email && target.email.includes('@')) {
    sendEmailNotification(
      `Casa Liezl Private Resort - Reservation ${target.status} (#${target.id})`,
      `Hello ${target.name},\n\nAng iyong reservation (#${target.id}) para sa ${target.checkInDate} (${target.stayType}) ay ${target.status} na!\n\nMaaari mo nang i-download ang iyong Official PDF Voucher sa aming website.\n\nKitakits sa Casa Liezl Private Resort!`,
      target.email
    );
  }

  res.json({ success: true, status: target.status });
});

app.post('/api/admin/reschedule-booking', authAdmin, (req, res) => {
  const { id, newDate, newShift } = req.body;
  const db = loadDB();
  const target = db.bookings.find(b => b.id === parseInt(id));
  if (!target) return res.status(404).json({ success: false, message: "Booking not found." });

  const oldInfo = `${target.checkInDate} (${target.stayType})`;
  if (newDate) target.checkInDate = newDate;
  if (newShift) target.stayType = newShift;

  saveDB(db, true);
  recordAuditLog("RESCHEDULE_BOOKING", `Rescheduled #${target.id} (${target.name}) from ${oldInfo} to ${target.checkInDate} (${target.stayType})`, req);
  res.json({ success: true, message: "Booking rescheduled successfully!", booking: target });
});

app.delete('/api/admin/bookings/:id', authAdmin, (req, res) => {
  const db = loadDB();
  const target = db.bookings.find(b => b.id === parseInt(req.params.id));
  if (target && target.receiptFilename) {
    const filePath = path.join(receiptFolder, target.receiptFilename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.bookings = db.bookings.filter(b => b.id !== parseInt(req.params.id));
  saveDB(db, true);
  recordAuditLog("DELETE_BOOKING", `Deleted booking #${req.params.id} (${target ? target.name : 'Unknown'})`, req);
  res.json({ success: true, message: "Booking record deleted." });
});

// EXPORT BOOKINGS AS EXCEL-COMPATIBLE CSV
app.get('/api/admin/export-csv', authAdmin, (req, res) => {
  const db = loadDB();
  const headers = ["Booking ID", "Created At", "Guest Name", "Phone", "Email", "Check-In Date", "Shift", "Package", "Pax", "Total Amount", "Amount Paid", "GCash Ref", "Status", "Source", "Notes"];
  const rows = (db.bookings || []).map(b => [
    b.id,
    `"${(b.createdAt || '').replace(/"/g, '""')}"`,
    `"${(b.name || '').replace(/"/g, '""')}"`,
    `"${(b.phone || '').replace(/"/g, '""')}"`,
    `"${(b.email || '').replace(/"/g, '""')}"`,
    b.checkInDate,
    `"${(b.stayType || '').replace(/"/g, '""')}"`,
    `"${(b.packageType || '').replace(/"/g, '""')}"`,
    b.guests,
    b.totalAmount || 0,
    b.amountPaid || 0,
    `"${(b.gcashRef || '').replace(/"/g, '""')}"`,
    b.status,
    b.bookingSource || "ONLINE",
    `"${(b.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  recordAuditLog("EXPORT_CSV", `Exported ${rows.length} bookings to CSV`, req);

  res.setHeader('Content-disposition', `attachment; filename="CasaLiezl_Bookings_${new Date().toISOString().split('T')[0]}.csv"`);
  res.setHeader('Content-type', 'text/csv');
  res.send(csvContent);
});

// AUDIT LOGS VIEWER & SECURITY IP MANAGEMENT
app.get('/api/admin/audit-logs', authAdmin, (req, res) => {
  const db = loadDB();
  res.json((db.auditLogs || []).slice(0, 300));
});

app.post('/api/admin/security/block-ip', authAdmin, (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, message: "IP address required." });
  const db = loadDB();
  if (!db.security.blockedIPs.includes(ip.trim())) {
    db.security.blockedIPs.push(ip.trim());
    saveDB(db);
    recordAuditLog("BLOCK_IP", `Blocked IP address: ${ip}`, req);
  }
  res.json({ success: true, blockedIPs: db.security.blockedIPs });
});

app.post('/api/admin/security/unblock-ip', authAdmin, (req, res) => {
  const { ip } = req.body;
  const db = loadDB();
  db.security.blockedIPs = (db.security.blockedIPs || []).filter(item => item !== ip);
  saveDB(db);
  recordAuditLog("UNBLOCK_IP", `Unblocked IP address: ${ip}`, req);
  res.json({ success: true, blockedIPs: db.security.blockedIPs });
});

// FULL JSON BACKUP & RESTORE
app.get('/api/admin/backup', authAdmin, (req, res) => {
  const db = loadDB();
  recordAuditLog("EXPORT_FULL_BACKUP", `Downloaded full JSON database & media backup`, req);
  res.setHeader('Content-disposition', `attachment; filename="CasaLiezl_FullBackup_${new Date().toISOString().split('T')[0]}.json"`);
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
  saveDB(backupData, true);
  restoreAndSyncMedia();
  recordAuditLog("RESTORE_FULL_BACKUP", `Restored full database backup (${backupData.bookings.length} bookings)`, req);
  res.json({ success: true, message: "Full Database & Media successfully restored!" });
});

// ============================================================================
// 🚀 21. SERVER STARTUP & 24/7 AUTO-AWAKENING ENGINE
// ============================================================================
app.listen(PORT, () => {
  console.log(`====================================================================`);
  console.log(`🌴 CASA LIEZL ENTERPRISE SERVER RUNNING ON PORT ${PORT}`);
  console.log(`💾 Database Path: ${dbFile}`);
  console.log(`🛡️ Auto-Heal Media & Rolling Snapshots: ACTIVE`);
  console.log(`====================================================================`);

  recordAuditLog("SERVER_BOOT", `Enterprise Server started on port ${PORT}`, null, "SYSTEM");

  // ⏰ AUTO-AWAKENING SELF-PINGER (Pings every 4 minutes to prevent cloud sleep)
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    const client = RENDER_URL.startsWith('https') ? https : http;
    client.get(`${RENDER_URL}/api/ping`, (res) => {
      console.log(`⚡ [Auto-Awake Heartbeat] Status ${res.statusCode} at ${new Date().toLocaleTimeString('en-PH')}`);
    }).on('error', (err) => {
      console.error('⚠️ [Auto-Awake Warning]:', err.message);
    });
  }, 4 * 60 * 1000);
});
