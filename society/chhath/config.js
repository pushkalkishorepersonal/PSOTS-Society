/**
 * ════════════════════════════════════════════════════
 *  PSOTS CHHATH 2026 — CENTRAL CONFIGURATION
 *  Edit THIS ONE FILE to update everything site-wide.
 *
 *  Only 2 values need filling after setup:
 *    1. scriptUrl      → after Google Sheet setup
 *    2. googleClientId → after Google Cloud setup
 * ════════════════════════════════════════════════════
 */
window.PSOTS = {

  /* ── PAYMENT ──────────────────── */
  upiId:     '9482088904-3@ybl',
  upiMobile: '9482088904',
  payeeName: 'ChhathPuja2026PSOTS',

  /* ── CONTACTS ─────────────────── */
  waOrg:  '919482088904',
  waOrg2: '919902837002',
  phone1: '9482088904',
  phone2: '9902837002',

  /* ── EVENT ────────────────────── */
  eventName:  'PSOTS Chhath Puja 2026 — पंच वर्ष महोत्सव',
  society:    'Prestige Song of the South, Bengaluru',
  eventStart: '2026-11-01T06:00:00',
  deadline:   '2026-10-25T23:59:00',
  venue:      'Society Ghat — Prestige Song of the South',

  arghyaEvening: { time: '5:45 PM', date: 'Nov 3, 2026' },
  arghyaMorning: { time: '6:15 AM', date: 'Nov 4, 2026' },
  kharnaTime:    { time: '7:00 PM', date: 'Nov 2, 2026', location: 'Community Hall' },

  /* ── COMMITTEE ────────────────── */
  committee: [
    { name:'Pushkal Kishore', role:'Chief Organiser',  phone:'9482088904', wa:'919482088904', initial:'P' },
    { name:'Treasurer',       role:'Finance',           phone:'9902837002', wa:'919902837002', initial:'T' },
    { name:'Decoration Head', role:'Ghat & Lighting',   phone:'',           wa:'',             initial:'D' },
    { name:'Prasad Coord.',   role:'Prasad & Food',     phone:'',           wa:'',             initial:'P' },
  ],

  /* ── 2025 FINANCE (actual) ────── */
  fin25: {
    contributors: 141, vratis: 15,
    collected: 235553, expenses: 198383, carry: 104670, budget: 282000,
    tent: 62801, kharna: 60201, thekua: 52908, misc: 22473,
    yoy: { 2022:125300, 2023:183630, 2024:217048, 2025:198383 },
  },

  /* ── DOMAIN ───────────────────── */
  domain:  'chhath.psots.in',
  siteUrl: 'https://chhath.psots.in',

  /* ── ADMIN EMAILS ─────────────── */
  adminEmails: ['pushkalkishore@gmail.com'],

  /* ══ API CONFIGURATION ═══════════ */
  apiBase: '/api/chhath',  // Cloudflare Workers endpoint

  /* ══ FILL THESE AFTER SETUP ══════
     See README.md for exact steps.   */
  scriptUrl:      '',   // Paste Apps Script URL here (DEPRECATED - using D1 now)
  googleClientId: '681152691156-g1q8bmionkcim033fhjhtn57jbiq1nij.apps.googleusercontent.com',
};

/* Helpers */
window.PSOTS.fmt      = n => '₹' + parseInt(n||0).toLocaleString('en-IN');
window.PSOTS.daysLeft = () => Math.max(0, Math.ceil((new Date(PSOTS.eventStart)-new Date())/86400000));
