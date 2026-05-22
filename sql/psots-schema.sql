-- ═══════════════════════════════════════════════════════════════
--  PSOTS SOCIETY - CLOUDFLARE D1 DATABASE SCHEMA
--  Migration from Firebase Firestore to Cloudflare D1
--  Date: May 11, 2026
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. RESIDENTS TABLE (Core identity)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE residents (
  resident_id TEXT PRIMARY KEY,           -- r_15167_abc123
  flat_number TEXT,                       -- "15167" (can be NULL during registration)

  -- Personal Info
  name TEXT,                              -- Can be NULL during registration
  email TEXT,
  phone TEXT,
  secondary_email TEXT,
  secondary_phone TEXT,
  telegram_username TEXT,

  -- Resident Classification
  resident_type TEXT CHECK(resident_type IN ('owner', 'tenant', 'family_of_owner', 'family_of_tenant')) NOT NULL,
  role TEXT DEFAULT 'resident' CHECK(role IN ('resident', 'vendor')),
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'removed')) DEFAULT 'pending',

  -- Admin & Access
  is_admin BOOLEAN DEFAULT 0,
  linked_to_resident_id TEXT,             -- For family members
  apps TEXT DEFAULT '["psots_society"]',  -- JSON array
  samiti_roles TEXT DEFAULT '[]',         -- JSON array
  vendor_id TEXT,

  -- Privacy Settings (JSON)
  privacy_settings TEXT DEFAULT '{"allowContact":true,"emailOnContact":true,"showFlat":true,"showNameOnRecommendations":true,"hideFromDirectory":false,"blockedResidentIds":[]}',

  -- Tenant-specific fields
  lease_start_date TEXT,                  -- DD/MM/YYYY
  lease_end_date TEXT,                    -- DD/MM/YYYY
  rent_amount TEXT,

  -- Approval tracking
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME,
  approved_by TEXT,
  rejected_at DATETIME,
  rejected_by TEXT,
  rejection_reason TEXT,
  removed_at DATETIME,
  removed_by TEXT,
  removal_reason TEXT,
  invited_by_flat TEXT,
  document_verified BOOLEAN DEFAULT 0,
  registration_method TEXT,               -- 'google', 'email', 'telegram', 'admin_manual'

  -- Metadata
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT                              -- Admin notes
);

CREATE INDEX idx_residents_flat ON residents(flat_number);
CREATE INDEX idx_residents_status ON residents(status);
CREATE INDEX idx_residents_email ON residents(email);
CREATE INDEX idx_residents_phone ON residents(phone);
CREATE INDEX idx_residents_type ON residents(resident_type);
CREATE INDEX idx_residents_linked ON residents(linked_to_resident_id);

-- ─────────────────────────────────────────────────────────────
-- 2. CREDENTIALS TABLE (Login methods)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE credentials (
  credential_id TEXT PRIMARY KEY,         -- cred_google_pushkal@gmail.com_1234567890
  resident_id TEXT NOT NULL,              -- May reference non-existent residents (orphaned credentials OK)

  type TEXT CHECK(type IN ('google', 'email', 'telegram', 'whatsapp', 'sms')) NOT NULL,
  identifier TEXT NOT NULL,               -- Email or phone (E.164)
  firebase_uid TEXT,                      -- Firebase Auth UID

  verified_at DATETIME,
  last_used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

  -- Note: Foreign key constraint removed to allow orphaned credentials from deleted residents
);

CREATE INDEX idx_credentials_resident ON credentials(resident_id);
CREATE UNIQUE INDEX idx_credentials_type_identifier ON credentials(type, identifier);
CREATE INDEX idx_credentials_identifier ON credentials(identifier);

-- ─────────────────────────────────────────────────────────────
-- 3. FLATS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE flats (
  flat_number TEXT PRIMARY KEY,           -- "15167"

  -- Parsed components (cached for queries)
  tower INTEGER NOT NULL,
  floor INTEGER NOT NULL,
  unit INTEGER NOT NULL,

  -- Owner reference
  owner_resident_id TEXT,                 -- null until owner registers

  -- Flat settings
  has_tenants BOOLEAN DEFAULT 0,
  max_family_members INTEGER DEFAULT 4,
  tenant_count INTEGER DEFAULT 0,
  family_count INTEGER DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (owner_resident_id) REFERENCES residents(resident_id) ON DELETE SET NULL
);

CREATE INDEX idx_flats_owner ON flats(owner_resident_id);
CREATE INDEX idx_flats_tower ON flats(tower);

-- ─────────────────────────────────────────────────────────────
-- 4. ADMINS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE admins (
  admin_id TEXT PRIMARY KEY,              -- Firebase Auth UID
  resident_id TEXT,                       -- Link to residents table

  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  flat_number TEXT,

  is_superadmin BOOLEAN DEFAULT 0,

  -- Permissions (JSON)
  permissions TEXT DEFAULT '{"approveResidents":false,"postAnnouncements":false,"viewFeedback":false,"manageAdmins":false}',
  telegram_groups TEXT DEFAULT '[]',      -- JSON array of group IDs

  added_by TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (resident_id) REFERENCES residents(resident_id) ON DELETE SET NULL
);

CREATE INDEX idx_admins_resident ON admins(resident_id);
CREATE INDEX idx_admins_email ON admins(email);



-- ─────────────────────────────────────────────────────────────
-- 5. MARKETPLACE_LISTINGS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE marketplace_listings (
  listing_id TEXT PRIMARY KEY,

  title TEXT NOT NULL,
  price REAL DEFAULT 0,
  description TEXT,
  category TEXT,

  seller_uid TEXT NOT NULL,               -- Firebase Auth UID (legacy)
  seller_resident_id TEXT,                -- New resident_id reference
  seller_name TEXT,
  seller_email TEXT,
  seller_flat TEXT,
  telegram_username TEXT NOT NULL,

  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'sold', 'removed')),
  report_count INTEGER DEFAULT 0,
  reported_by TEXT DEFAULT '[]',          -- JSON array of UIDs

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,

  FOREIGN KEY (seller_resident_id) REFERENCES residents(resident_id) ON DELETE SET NULL
);

CREATE INDEX idx_marketplace_seller ON marketplace_listings(seller_resident_id);
CREATE INDEX idx_marketplace_status ON marketplace_listings(status);
CREATE INDEX idx_marketplace_created ON marketplace_listings(created_at);

-- ─────────────────────────────────────────────────────────────
-- 6. LOST_FOUND TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE lost_found (
  post_id TEXT PRIMARY KEY,

  type TEXT CHECK(type IN ('lost', 'found')) NOT NULL,
  category TEXT NOT NULL,                 -- Keys, Pet, Wallet, Electronics, Documents, Vehicle, Other
  item_name TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  date TEXT NOT NULL,                     -- YYYY-MM-DD

  poster_uid TEXT NOT NULL,               -- Firebase Auth UID (legacy)
  poster_resident_id TEXT,                -- New resident_id reference
  poster_flat TEXT,
  poster_telegram TEXT,

  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'expired')),

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,

  FOREIGN KEY (poster_resident_id) REFERENCES residents(resident_id) ON DELETE SET NULL
);

CREATE INDEX idx_lost_found_poster ON lost_found(poster_resident_id);
CREATE INDEX idx_lost_found_type ON lost_found(type);
CREATE INDEX idx_lost_found_status ON lost_found(status);
CREATE INDEX idx_lost_found_created ON lost_found(created_at);

-- ─────────────────────────────────────────────────────────────
-- 7. CARPOOLING TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE carpooling (
  post_id TEXT PRIMARY KEY,

  type TEXT CHECK(type IN ('offering', 'looking')) NOT NULL,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  date TEXT NOT NULL,                     -- YYYY-MM-DD
  time TEXT NOT NULL,                     -- HH:MM
  seats INTEGER,                          -- null for 'looking'
  recurring TEXT DEFAULT 'one-time' CHECK(recurring IN ('one-time', 'daily', 'weekdays', 'weekends')),
  notes TEXT,

  poster_uid TEXT NOT NULL,               -- Firebase Auth UID (legacy)
  poster_resident_id TEXT,                -- New resident_id reference
  poster_flat TEXT,
  poster_telegram TEXT,

  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'full', 'cancelled')),

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (poster_resident_id) REFERENCES residents(resident_id) ON DELETE SET NULL
);

CREATE INDEX idx_carpooling_poster ON carpooling(poster_resident_id);
CREATE INDEX idx_carpooling_type ON carpooling(type);
CREATE INDEX idx_carpooling_status ON carpooling(status);
CREATE INDEX idx_carpooling_date ON carpooling(date);

-- ─────────────────────────────────────────────────────────────
-- 8. RECOMMENDATIONS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE recommendations (
  recommendation_id TEXT PRIMARY KEY,

  category TEXT NOT NULL,                 -- electrician, plumber, cleaner, etc.
  vendor_name TEXT NOT NULL,
  vendor_phone TEXT NOT NULL,
  description TEXT,

  created_by_uid TEXT NOT NULL,           -- Firebase Auth UID (legacy)
  created_by_resident_id TEXT,            -- New resident_id reference
  creator_name TEXT,
  creator_flat TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (created_by_resident_id) REFERENCES residents(resident_id) ON DELETE SET NULL
);

CREATE INDEX idx_recommendations_creator ON recommendations(created_by_resident_id);
CREATE INDEX idx_recommendations_category ON recommendations(category);

-- ─────────────────────────────────────────────────────────────
-- 9. ANNOUNCEMENTS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE announcements (
  announcement_id TEXT PRIMARY KEY,

  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'general' CHECK(type IN ('general', 'urgent', 'maintenance', 'event')),

  posted_by TEXT NOT NULL,                -- Admin resident_id
  posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,

  is_active BOOLEAN DEFAULT 1,

  FOREIGN KEY (posted_by) REFERENCES admins(admin_id) ON DELETE CASCADE
);

CREATE INDEX idx_announcements_posted ON announcements(posted_at);
CREATE INDEX idx_announcements_active ON announcements(is_active);
CREATE INDEX idx_announcements_expires ON announcements(expires_at);


-- ─────────────────────────────────────────────────────────────
-- 10. DEVICE_SESSIONS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE device_sessions (
  device_token TEXT PRIMARY KEY,
  resident_id TEXT NOT NULL,

  device_name TEXT,                       -- "Chrome on iPhone"
  user_agent TEXT,
  ip_address TEXT,
  city_hint TEXT,
  fingerprint TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,                    -- 1 year from creation

  revoked BOOLEAN DEFAULT 0,
  revoked_at DATETIME,
  revoked_by TEXT,

  FOREIGN KEY (resident_id) REFERENCES residents(resident_id) ON DELETE CASCADE
);

CREATE INDEX idx_device_sessions_resident ON device_sessions(resident_id);
CREATE INDEX idx_device_sessions_expires ON device_sessions(expires_at);

-- ─────────────────────────────────────────────────────────────
-- 11. INVITES TABLE (Family/Tenant invitations)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE invites (
  token TEXT PRIMARY KEY,
  flat_number TEXT NOT NULL,
  created_by_uid TEXT NOT NULL,           -- Firebase Auth UID (legacy)
  created_by_resident_id TEXT,

  type TEXT CHECK(type IN ('family', 'tenant', 'tenant_family')) NOT NULL,
  status TEXT CHECK(status IN ('pending', 'used', 'expired', 'revoked')) DEFAULT 'pending',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  used_at DATETIME,
  used_by_uid TEXT,

  FOREIGN KEY (created_by_resident_id) REFERENCES residents(resident_id) ON DELETE CASCADE
);

CREATE INDEX idx_invites_flat ON invites(flat_number);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_creator ON invites(created_by_resident_id);

-- ─────────────────────────────────────────────────────────────
-- 12. SETTINGS TABLE (Platform configuration)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,            -- JSON for complex values
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT
);

-- Insert default settings
INSERT INTO settings (setting_key, setting_value) VALUES
  ('contact', '{"adminName":"Pushkal Kishore","adminWhatsapp":"919482088904","adminTelegram":"pushkalkishore","adminEmail":"pushkalkishore@gmail.com"}'),
  ('platform', '{"name":"PSOTS Society","version":"2.0","maintenanceMode":false}');

-- ─────────────────────────────────────────────────────────────
-- 13. GROUP_SETTINGS TABLE (Telegram bot config)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE group_settings (
  chat_id TEXT PRIMARY KEY,

  bot_active BOOLEAN DEFAULT 1,

  -- Thresholds (JSON)
  thresholds TEXT DEFAULT '{"warn":1,"mute":3,"muteDuration":60,"ban":10}',

  -- Gemini AI settings (JSON)
  gemini TEXT DEFAULT '{"enabled":true,"sensitivity":"medium","contextMessages":10}',

  -- Keywords (JSON)
  keywords TEXT DEFAULT '{"predefined":{"spam":true,"abuse":true,"links":false,"ads":false,"hate":true},"custom":[]}',

  -- Warning messages (JSON)
  warning_messages TEXT,

  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- 14. VIOLATIONS TABLE (Telegram moderation)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE violations (
  violation_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  username TEXT,
  name TEXT,
  count INTEGER DEFAULT 1,
  last_violation DATETIME DEFAULT CURRENT_TIMESTAMP,
  muted_until DATETIME,
  banned BOOLEAN DEFAULT 0,

  UNIQUE(chat_id, user_id)
);

CREATE INDEX idx_violations_chat ON violations(chat_id);
CREATE INDEX idx_violations_user ON violations(user_id);

-- ─────────────────────────────────────────────────────────────
-- 15. FEEDBACK TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE feedback (
  feedback_id TEXT PRIMARY KEY,

  resident_id TEXT,
  category TEXT,
  message TEXT NOT NULL,

  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'resolved')),
  admin_response TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (resident_id) REFERENCES residents(resident_id) ON DELETE SET NULL
);

CREATE INDEX idx_feedback_resident ON feedback(resident_id);
CREATE INDEX idx_feedback_status ON feedback(status);

-- ─────────────────────────────────────────────────────────────
-- 16. JOBS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE jobs (
  job_id TEXT PRIMARY KEY,

  title TEXT NOT NULL,
  company TEXT,
  description TEXT,
  location TEXT,
  job_type TEXT,                          -- Full-time, Part-time, Contract, Internship

  posted_by TEXT NOT NULL,                -- resident_id
  posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,

  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'filled', 'expired')),

  FOREIGN KEY (posted_by) REFERENCES residents(resident_id) ON DELETE CASCADE
);

CREATE INDEX idx_jobs_posted ON jobs(posted_by);
CREATE INDEX idx_jobs_status ON jobs(status);