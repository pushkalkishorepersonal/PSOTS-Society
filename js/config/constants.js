/**
 * constants.js — All magic numbers and configuration.
 * Change values here once — they update everywhere.
 */

// ── SUPER ADMIN ───────────────────────────────────────────
export const SUPER_ADMIN        = 'pushkalkishore@gmail.com';
export const SUPER_ADMIN_TG_UID = '989358143'; // Telegram user ID (matches ADMIN_ID in Worker)

// ── WORKER URL ────────────────────────────────────────────
// Replace with your actual Cloudflare Worker URL
export const WORKER_URL = 'https://telegram.psots.in';

// ── TOWER CONFIGURATION ───────────────────────────────────
// maxFloor: highest floor number (no floor 13)
// maxUnit:  highest unit number per floor
export const TOWERS = {
  1:  { maxFloor: 17, maxUnit: 8  },
  2:  { maxFloor: 17, maxUnit: 8  },
  3:  { maxFloor: 17, maxUnit: 8  },
  4:  { maxFloor: 20, maxUnit: 8  },
  5:  { maxFloor: 20, maxUnit: 4  },
  8:  { maxFloor: 29, maxUnit: 8  },
  9:  { maxFloor: 29, maxUnit: 8  },
  10: { maxFloor: 17, maxUnit: 8  },
  11: { maxFloor: 17, maxUnit: 8  },
  12: { maxFloor: 17, maxUnit: 12 },
  14: { maxFloor: 17, maxUnit: 12 },
  15: { maxFloor: 17, maxUnit: 8  },
  16: { maxFloor: 17, maxUnit: 8  },
  17: { maxFloor: 17, maxUnit: 8  },
};

export const VALID_TOWERS   = Object.keys(TOWERS).map(Number);
export const SKIPPED_FLOORS = [13];

// ── REGISTRATION LIMITS ───────────────────────────────────
export const MAX_RESIDENTS_PER_FLAT = 4;
export const MAX_ATTEMPTS_PER_MIN   = 3;
export const MAX_ATTEMPTS_PER_HOUR  = 5;

// ── LIFECYCLE TIMINGS ─────────────────────────────────────
export const OWNER_NUDGE_INTERVAL_DAYS     = 365;    // 1 year
export const OWNER_SNOOZE_MAX_DAYS         = 1825;   // 5 years
export const TENANT_NUDGE_BEFORE_DAYS      = 30;     // 30 days before lease end
export const TENANT_GRACE_PERIOD_DAYS      = 30;     // after lease end
export const TENANT_DATA_WARNING_DAY       = 20;     // grace day 20 of 30
export const ESCALATION_DAYS              = 7;       // primary/owner no-response
export const DATA_RETENTION_AFTER_SUSPEND  = 365;    // 1 year
export const DATA_PURGE_WARNING_DAYS       = 30;     // warn before purge
export const ACCOUNT_DELETION_COOLOFF_DAYS = 7;      // cooling off period
export const OWNERSHIP_TRANSFER_DEADLINE   = 90;     // days for new owner to register

// ── MARKETPLACE ───────────────────────────────────────────
export const MAX_ACTIVE_LISTINGS     = 5;
export const LISTING_EXPIRY_DAYS     = 30;
export const LISTING_WARNING_DAY     = 25;
export const REPORTS_TO_HIDE_LISTING = 3;

// ── PROFILE ───────────────────────────────────────────────
export const ABOUT_ME_MAX_CHARS       = 300;
export const MAX_RECOMMENDATION_PHOTOS = 5;

// ── RESIDENT TYPES ────────────────────────────────────────
export const RESIDENT_TYPES = {
  OWNER:  'owner',
  TENANT: 'tenant',
  PG:     'pg',
};

export const OWNER_STATUSES = {
  RESIDENT:     'resident',
  NON_RESIDENT: 'non_resident',
  NRI:          'nri',
};

export const RESIDENT_ROLES = {
  PRIMARY:   'primary',
  SECONDARY: 'secondary',
  FAMILY:    'family',
};

export const ACCOUNT_STATUSES = {
  PENDING:         'pending',
  PENDING_PRIMARY: 'pending_primary',
  PENDING_OWNER:   'pending_owner',
  APPROVED:        'approved',
  REJECTED:        'rejected',
  INACTIVE:        'inactive',
  SUSPENDED:       'suspended',
};

// ── REJECTION REASONS ─────────────────────────────────────
export const REJECTION_REASONS = [
  'Wrong flat number',
  'Not found in MyGate',
  'Duplicate registration',
  'Flat already has owner registered',
  'Insufficient information provided',
  'Tenant not validated by owner',
  'Other',
];

// ── CACHE TTL ─────────────────────────────────────────────
export const TTL_5_MIN  = 5  * 60 * 1000;
export const TTL_15_MIN = 15 * 60 * 1000;
export const TTL_1_HOUR = 60 * 60 * 1000;

// ── COLLECTIONS ───────────────────────────────────────────
export const COLLECTIONS = {
  RESIDENTS:       'residents',
  FLATS:           'flats',
  FLAT_MEMBERS:    'members',
  IDENTITIES:      'identities',
  LINKED_ACCOUNTS: 'linkedAccounts',
  ADMINS:          'admins',
  RATE_LIMITS:     'rate_limits',
  AUDIT_LOG:       'audit_log',
  APPEALS:         'appeals',
  NOTIFICATIONS:   'notifications',
  DATA_EXPORTS:    'data_exports',
  EXTENDED_GUESTS: 'extended_guests',
  MARKETPLACE:     'marketplace',
  LOST_FOUND:      'lost_found',
  CARPOOLING:      'carpooling',
  SERVICES:        'services',
  RECOMMENDATIONS: 'recommendations',
  NOTICES:         'notices',
};
