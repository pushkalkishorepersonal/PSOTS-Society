// src/db/pii.js — Privacy masking functions
// All admin views use these to protect resident PII
// Self-view shows full data to the resident themselves

export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return local[0] + '***@' + domain;
}

export function maskPhone(phone) {
  if (!phone) return '';
  const clean = String(phone).replace(/\D/g, '').slice(-10);
  if (clean.length < 10) return '';
  return '+91 ' + clean.slice(0, 2) + 'XXX X' + clean.slice(-4);
}

export function maskName(fullName) {
  if (!fullName || typeof fullName !== 'string') return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
}

/**
 * sanitizeForAdmin — for admin panel views.
 *
 * Policy (Option C):
 * - Full name shown (admins need it for WhatsApp community verification)
 * - Email masked (e.g., "p***@gmail.com")
 * - Phone masked (e.g., "+91 98XXX X5678")
 * - Preserves uid + flatNumber (needed for admin actions)
 *
 * Names in a residential society are not really private (doorplates,
 * directory, WhatsApp group). Email and phone are the high-value PII
 * and remain masked.
 */
// D1's residents table has no accessLevel column — resident_type
// (owner/tenant/family_of_owner/family_of_tenant) already encodes it.
function deriveAccessLevel(r) {
  if (r.accessLevel) return r.accessLevel;
  if (r.residentType === 'family_of_owner' || r.residentType === 'family_of_tenant') return 'family';
  return r.residentType || 'owner';
}

export function sanitizeForAdmin(r) {
  if (!r) return null;
  return {
    uid: r.uid,
    residentId: r.residentId,
    flatNumber: r.flatNumber,
    name: r.name || r.firstName || '',
    displayName: r.name || r.firstName || '',
    email: maskEmail(r.email || r.secondaryEmail || ''),
    phone: maskPhone(r.phone || r.secondaryPhone || ''),
    relation: r.relation || '',
    accessLevel: deriveAccessLevel(r),
    loginMethod: r.loginMethod || '',
    status: r.status || 'pending',
    createdAt: r.createdAt || '',
    invitedByFlat: r.invitedByFlat || '',
  };
}

export function sanitizeForResident(r, requestingUid) {
  if (!r) return null;
  if (r.uid === requestingUid || r.residentId === requestingUid) return r;
  // Mask name for other residents (Option C: admins see full names, residents see masked)
  return {
    uid: r.uid || r.residentId,
    flatNumber: r.flatNumber,
    displayName: maskName(r.name || r.firstName || ''),
    email: maskEmail(r.email || ''),
    phone: maskPhone(r.phone || ''),
    relation: r.relation || '',
    accessLevel: deriveAccessLevel(r),
    loginMethod: r.loginMethod || '',
    status: r.status || 'pending',
    createdAt: r.createdAt || '',
    invitedByFlat: r.invitedByFlat || '',
  };
}

export function sanitizeForPublic(r) {
  if (!r) return null;
  return {
    flatNumber: r.flatNumber,
    displayName: maskName(r.name || ''),
  };
}
