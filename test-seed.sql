-- Insert test resident (Pushkal - Flat 15167)
INSERT INTO residents (
  resident_id, flat_number, name, email, phone,
  resident_type, role, status, is_admin, created_at, approved_at
) VALUES (
  'r_15167_test123', '15167', 'Pushkal Kishore', 'pushkal@gmail.com', '+919876543210',
  'owner', 'resident', 'approved', 1, datetime('now'), datetime('now')
);

-- Insert credential for Google login
INSERT INTO credentials (
  credential_id, resident_id, type, identifier, created_at, last_used_at
) VALUES (
  'cred_google_pushkal', 'r_15167_test123', 'google', 'pushkal@gmail.com', datetime('now'), datetime('now')
);

-- Insert flat record
INSERT INTO flats (
  flat_number, tower, floor, unit, owner_resident_id, created_at, updated_at
) VALUES (
  '15167', 1, 51, 67, 'r_15167_test123', datetime('now'), datetime('now')
);
