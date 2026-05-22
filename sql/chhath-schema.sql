-- ═══════════════════════════════════════════════════════════════
--  PSOTS CHHATH PUJA 2026 - CLOUDFLARE D1 DATABASE SCHEMA
--  Clean structure with NO Firebase/Google Sheets legacy
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. CONTRIBUTIONS TABLE
-- Stores all Chhath Puja contributions (current + historical)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE chhath_contributions (
  contribution_id TEXT PRIMARY KEY, -- uuid format: c_2026_abc123
  
  -- Resident Info (from PSOTS main residents table)
  resident_id TEXT NOT NULL, -- Links to main PSOTS residents table
  name TEXT NOT NULL,
  flat_number TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  
  -- Contribution Details
  year INTEGER NOT NULL, -- 2026, 2025, 2024, etc.
  amount INTEGER NOT NULL, -- In rupees (paisa not needed)
  
  -- Payment Info
  payment_method TEXT DEFAULT 'UPI' CHECK(payment_method IN (
    'UPI', 'Bank Transfer', 'Cash'
  )),
  utr_number TEXT, -- UPI transaction reference
  payment_date DATE NOT NULL,
  payment_screenshot_url TEXT, -- Optional: uploaded to Cloudflare R2
  
  -- Verification Status
  status TEXT CHECK(status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
  verified_by TEXT, -- admin resident_id
  verified_at DATETIME,
  rejected_by TEXT, -- admin resident_id
  rejected_at DATETIME,
  rejection_reason TEXT,
  
  -- Admin Notes
  notes TEXT,
  entry_source TEXT CHECK(entry_source IN ('online_form', 'manual_admin', 'bulk_import')) DEFAULT 'online_form',
  is_anonymous BOOLEAN DEFAULT 0,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chhath_year ON chhath_contributions(year);
CREATE INDEX idx_chhath_resident ON chhath_contributions(resident_id);
CREATE INDEX idx_chhath_status ON chhath_contributions(status);
CREATE INDEX idx_chhath_flat ON chhath_contributions(flat_number);
CREATE INDEX idx_chhath_verified_at ON chhath_contributions(verified_at);

-- ─────────────────────────────────────────────────────────────
-- 2. WHATSAPP SUBSCRIPTIONS
-- Track who wants WhatsApp updates
-- ─────────────────────────────────────────────────────────────
CREATE TABLE chhath_whatsapp_subscriptions (
  subscription_id TEXT PRIMARY KEY, -- uuid format: ws_abc123
  
  resident_id TEXT NOT NULL,
  name TEXT NOT NULL,
  flat_number TEXT NOT NULL,
  phone TEXT NOT NULL, -- WhatsApp number
  
  subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at DATETIME,
  active BOOLEAN DEFAULT 1,
  
  -- Preferences (JSON stored as TEXT)
  preferences TEXT DEFAULT '{"events":true,"payment":true,"prasad":true,"announcements":true,"finance":false}'
);

CREATE INDEX idx_chhath_subs_resident ON chhath_whatsapp_subscriptions(resident_id);
CREATE INDEX idx_chhath_subs_active ON chhath_whatsapp_subscriptions(active);
CREATE INDEX idx_chhath_subs_phone ON chhath_whatsapp_subscriptions(phone);

-- ─────────────────────────────────────────────────────────────
-- 3. ANNOUNCEMENTS
-- Dynamic announcements managed by admin
-- ─────────────────────────────────────────────────────────────
CREATE TABLE chhath_announcements (
  announcement_id TEXT PRIMARY KEY, -- uuid format: ann_abc123
  
  tag TEXT NOT NULL, -- '🎊 5th Year', '⏰ Deadline', '🙏 Prasad'
  meta TEXT, -- 'Oct 15, 2026'
  text TEXT NOT NULL,
  
  display_order INTEGER DEFAULT 0, -- For sorting
  active BOOLEAN DEFAULT 1,
  
  created_by TEXT, -- admin resident_id
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chhath_ann_active ON chhath_announcements(active);
CREATE INDEX idx_chhath_ann_order ON chhath_announcements(display_order);

-- ─────────────────────────────────────────────────────────────
-- 4. MESSAGES (Admin-Resident Communication)
-- In-app messaging between residents and committee
-- ─────────────────────────────────────────────────────────────
CREATE TABLE chhath_messages (
  message_id TEXT PRIMARY KEY, -- uuid format: msg_abc123
  
  resident_id TEXT NOT NULL,
  from_type TEXT CHECK(from_type IN ('resident', 'admin')) NOT NULL,
  text TEXT NOT NULL,
  
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  read_by TEXT -- admin resident_id who read it
);

CREATE INDEX idx_chhath_msg_resident ON chhath_messages(resident_id);
CREATE INDEX idx_chhath_msg_sent ON chhath_messages(sent_at);

-- ─────────────────────────────────────────────────────────────
-- 5. ADMIN ACTIONS LOG
-- Audit trail for all admin actions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE chhath_admin_log (
  log_id TEXT PRIMARY KEY, -- uuid format: log_abc123
  
  admin_resident_id TEXT NOT NULL,
  action TEXT NOT NULL, -- 'verify_payment', 'reject_payment', 'update_finance', etc.
  
  target_id TEXT, -- contribution_id, announcement_id, etc.
  target_type TEXT, -- 'contribution', 'announcement', etc.
  
  details TEXT, -- JSON with action-specific details
  
  ip_address TEXT,
  user_agent TEXT,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chhath_log_admin ON chhath_admin_log(admin_resident_id);
CREATE INDEX idx_chhath_log_created ON chhath_admin_log(created_at);
CREATE INDEX idx_chhath_log_action ON chhath_admin_log(action);

-- ═══════════════════════════════════════════════════════════════
-- INITIAL DATA SETUP
-- ═══════════════════════════════════════════════════════════════

-- Insert default announcements
INSERT INTO chhath_announcements (announcement_id, tag, meta, text, display_order, created_at) VALUES
  ('ann_001', '🎊 5th Year', '2026 — Grand', 'पंच वर्ष महोत्सव! Grander ghat, bigger celebration. ₹1,04,670 surplus from 2025.', 1, datetime('now')),
  ('ann_002', '🙏 Prasad', '2026 — Schedule', 'Nov 2 खरना & Nov 4 ठेकुआ प्रसाद for all residents.', 2, datetime('now')),
  ('ann_003', '⏰ Deadline', 'Important', 'Contribute before Oct 25 for prasad list.', 3, datetime('now'));
