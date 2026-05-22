// ═══════════════════════════════════════════════════════════════
//  PSOTS CHHATH PUJA 2026 - CLOUDFLARE WORKERS API
//  Replaces Google Apps Script + Sheets
//  Clean, simple REST API using D1 database
// ═══════════════════════════════════════════════════════════════

/**
 * Main router for Chhath Puja API
 * Add to main PSOTS Workers at: /api/chhath/*
 */
export async function handleChhathAPI(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/api/chhath', '');
  const method = request.method;

  // CORS headers for frontend
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let response;

    // ──────────────────────────────────────────────────────────
    // PUBLIC ENDPOINTS (No auth required)
    // ──────────────────────────────────────────────────────────
    
    if (path === '/contributors' && method === 'GET') {
      // GET /api/chhath/contributors?year=2026
      response = await getContributors(request, env);
    }
    
    else if (path === '/stats' && method === 'GET') {
      // GET /api/chhath/stats?year=2026
      response = await getStats(request, env);
    }
    
    else if (path === '/announcements' && method === 'GET') {
      // GET /api/chhath/announcements
      response = await getAnnouncements(request, env);
    }
    
    // ──────────────────────────────────────────────────────────
    // USER ENDPOINTS (Requires auth)
    // ──────────────────────────────────────────────────────────
    
    else if (path === '/contribute' && method === 'POST') {
      // POST /api/chhath/contribute
      response = await submitContribution(request, env);
    }
    
    else if (path === '/my-contributions' && method === 'GET') {
      // GET /api/chhath/my-contributions
      response = await getMyContributions(request, env);
    }
    
    else if (path === '/subscribe-whatsapp' && method === 'POST') {
      // POST /api/chhath/subscribe-whatsapp
      response = await subscribeWhatsApp(request, env);
    }
    
    else if (path === '/message' && method === 'POST') {
      // POST /api/chhath/message
      response = await sendMessage(request, env);
    }
    
    // ──────────────────────────────────────────────────────────
    // ADMIN ENDPOINTS (Requires admin auth)
    // ──────────────────────────────────────────────────────────
    
    else if (path === '/admin/verify' && method === 'PATCH') {
      // PATCH /api/chhath/admin/verify/:id
      response = await verifyContribution(request, env);
    }
    
    else if (path === '/admin/reject' && method === 'PATCH') {
      // PATCH /api/chhath/admin/reject/:id
      response = await rejectContribution(request, env);
    }
    
    else if (path === '/admin/contributions' && method === 'GET') {
      // GET /api/chhath/admin/contributions?status=pending
      response = await getAdminContributions(request, env);
    }
    
    else if (path === '/admin/announcements' && method === 'POST') {
      // POST /api/chhath/admin/announcements
      response = await createAnnouncement(request, env);
    }
    
    else if (path.startsWith('/admin/announcements/') && method === 'DELETE') {
      // DELETE /api/chhath/admin/announcements/:id
      response = await deleteAnnouncement(request, env);
    }
    
    else {
      response = { error: 'Not found', path };
      return new Response(JSON.stringify(response), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chhath API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a unique ID with prefix
 */
function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current user from session cookie
 * Returns { residentId, isAdmin, email, name, flatNumber }
 */
async function getCurrentUser(request, env) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  
  const sessionMatch = cookie.match(/psots_session=([^;]+)/);
  if (!sessionMatch) return null;
  
  const sessionId = sessionMatch[1];
  const sessionData = await env.SESSIONS_KV.get(`session_${sessionId}`);
  
  if (!sessionData) return null;
  
  return JSON.parse(sessionData);
}

/**
 * Check if user is admin
 */
async function requireAdmin(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user || !user.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  return user;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/chhath/contributors?year=2026
 * Returns list of verified contributors for public display
 */
async function getContributors(request, env) {
  const url = new URL(request.url);
  const year = url.searchParams.get('year') || 2026;

  const { results } = await env.DB.prepare(`
    SELECT
      name,
      flat_number as flat,
      amount,
      payment_date as date,
      is_anonymous
    FROM chhath_contributions
    WHERE year = ? AND status = 'verified'
    ORDER BY verified_at DESC
  `).bind(year).all();

  // Hide name if anonymous
  const contributors = results.map(c => ({
    name: c.is_anonymous ? 'Anonymous' : c.name,
    flat: c.is_anonymous ? '—' : c.flat,
    amount: c.amount,
    date: c.date
  }));

  return {
    success: true,
    year,
    count: contributors.length,
    contributors
  };
}

/**
 * GET /api/chhath/stats?year=2026
 * Returns aggregated statistics
 */
async function getStats(request, env) {
  const url = new URL(request.url);
  const year = url.searchParams.get('year') || 2026;

  const stats = await env.DB.prepare(`
    SELECT
      COUNT(*) as total_contributors,
      SUM(amount) as total_collected,
      COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_count,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      SUM(CASE WHEN status = 'verified' THEN amount ELSE 0 END) as verified_amount
    FROM chhath_contributions
    WHERE year = ?
  `).bind(year).first();

  return {
    success: true,
    year,
    stats: {
      totalContributors: stats.total_contributors || 0,
      totalCollected: stats.total_collected || 0,
      verifiedCount: stats.verified_count || 0,
      pendingCount: stats.pending_count || 0,
      verifiedAmount: stats.verified_amount || 0
    }
  };
}

/**
 * GET /api/chhath/announcements
 * Returns active announcements
 */
async function getAnnouncements(request, env) {
  const { results } = await env.DB.prepare(`
    SELECT announcement_id as id, tag, meta, text, display_order
    FROM chhath_announcements
    WHERE active = 1
    ORDER BY display_order ASC
  `).all();

  return {
    success: true,
    announcements: results
  };
}

// ═══════════════════════════════════════════════════════════════
// USER ENDPOINTS IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/chhath/contribute
 * Submit a new contribution
 */
async function submitContribution(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    throw new Error('Please login to contribute');
  }

  const body = await request.json();
  const { amount, paymentMethod, utrNumber, paymentDate, notes } = body;

  if (!amount || amount < 1) {
    throw new Error('Invalid amount');
  }

  const contributionId = generateId('c_2026');

  await env.DB.prepare(`
    INSERT INTO chhath_contributions (
      contribution_id, resident_id, name, flat_number, phone, email,
      year, amount, payment_method, utr_number, payment_date, notes, entry_source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online_form')
  `).bind(
    contributionId,
    user.residentId,
    user.name,
    user.flatNumber,
    user.phone || null,
    user.email,
    2026,
    amount,
    paymentMethod || 'UPI',
    utrNumber || null,
    paymentDate || new Date().toISOString().split('T')[0],
    notes || null
  ).run();

  return {
    success: true,
    message: 'Contribution submitted successfully! Awaiting verification.',
    contributionId
  };
}

/**
 * GET /api/chhath/my-contributions
 * Get user's contribution history
 */
async function getMyContributions(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    throw new Error('Please login to view contributions');
  }

  const { results } = await env.DB.prepare(`
    SELECT
      contribution_id as id,
      year,
      amount,
      payment_method as method,
      payment_date as date,
      status,
      verified_at,
      created_at
    FROM chhath_contributions
    WHERE resident_id = ?
    ORDER BY year DESC, created_at DESC
  `).bind(user.residentId).all();

  return {
    success: true,
    contributions: results
  };
}

/**
 * POST /api/chhath/subscribe-whatsapp
 * Subscribe to WhatsApp updates
 */
async function subscribeWhatsApp(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    throw new Error('Please login to subscribe');
  }

  const body = await request.json();
  const { phone, preferences } = body;

  if (!phone) {
    throw new Error('Phone number required');
  }

  const subscriptionId = generateId('ws');

  await env.DB.prepare(`
    INSERT INTO chhath_whatsapp_subscriptions (
      subscription_id, resident_id, name, flat_number, phone, preferences
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(subscription_id) DO UPDATE SET
      active = 1,
      preferences = excluded.preferences,
      unsubscribed_at = NULL
  `).bind(
    subscriptionId,
    user.residentId,
    user.name,
    user.flatNumber,
    phone,
    JSON.stringify(preferences || {})
  ).run();

  return {
    success: true,
    message: 'Subscribed to WhatsApp updates'
  };
}

/**
 * POST /api/chhath/message
 * Send message to admin
 */
async function sendMessage(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    throw new Error('Please login to send messages');
  }

  const body = await request.json();
  const { text } = body;

  if (!text || text.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  const messageId = generateId('msg');

  await env.DB.prepare(`
    INSERT INTO chhath_messages (
      message_id, resident_id, from_type, text
    ) VALUES (?, ?, 'resident', ?)
  `).bind(messageId, user.residentId, text.trim()).run();

  return {
    success: true,
    message: 'Message sent to committee',
    messageId
  };
}

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════

/**
 * PATCH /api/chhath/admin/verify
 * Verify a contribution
 */
async function verifyContribution(request, env) {
  const admin = await requireAdmin(request, env);
  const body = await request.json();
  const { contributionId } = body;

  if (!contributionId) {
    throw new Error('contribution_id required');
  }

  await env.DB.prepare(`
    UPDATE chhath_contributions
    SET status = 'verified',
        verified_by = ?,
        verified_at = datetime('now'),
        updated_at = datetime('now')
    WHERE contribution_id = ?
  `).bind(admin.residentId, contributionId).run();

  // Log admin action
  await logAdminAction(env, admin.residentId, 'verify_payment', contributionId, 'contribution');

  return {
    success: true,
    message: 'Contribution verified successfully'
  };
}

/**
 * PATCH /api/chhath/admin/reject
 * Reject a contribution
 */
async function rejectContribution(request, env) {
  const admin = await requireAdmin(request, env);
  const body = await request.json();
  const { contributionId, reason } = body;

  if (!contributionId) {
    throw new Error('contribution_id required');
  }

  await env.DB.prepare(`
    UPDATE chhath_contributions
    SET status = 'rejected',
        rejected_by = ?,
        rejected_at = datetime('now'),
        rejection_reason = ?,
        updated_at = datetime('now')
    WHERE contribution_id = ?
  `).bind(admin.residentId, reason || null, contributionId).run();

  // Log admin action
  await logAdminAction(env, admin.residentId, 'reject_payment', contributionId, 'contribution', { reason });

  return {
    success: true,
    message: 'Contribution rejected'
  };
}

/**
 * GET /api/chhath/admin/contributions?status=pending&year=2026
 * Get all contributions for admin review
 */
async function getAdminContributions(request, env) {
  await requireAdmin(request, env);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'all';
  const year = url.searchParams.get('year') || 2026;

  let query = `
    SELECT
      contribution_id as id,
      name,
      flat_number as flat,
      phone,
      email,
      amount,
      payment_method as method,
      utr_number as utr,
      payment_date as date,
      status,
      notes,
      entry_source,
      created_at,
      verified_at,
      verified_by
    FROM chhath_contributions
    WHERE year = ?
  `;

  const params = [year];

  if (status !== 'all') {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY created_at DESC`;

  const { results } = await env.DB.prepare(query).bind(...params).all();

  return {
    success: true,
    year,
    status,
    count: results.length,
    contributions: results
  };
}

/**
 * POST /api/chhath/admin/announcements
 * Create a new announcement
 */
async function createAnnouncement(request, env) {
  const admin = await requireAdmin(request, env);
  const body = await request.json();
  const { tag, meta, text, displayOrder } = body;

  if (!tag || !text) {
    throw new Error('tag and text required');
  }

  const announcementId = generateId('ann');

  await env.DB.prepare(`
    INSERT INTO chhath_announcements (
      announcement_id, tag, meta, text, display_order, created_by
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    announcementId,
    tag,
    meta || null,
    text,
    displayOrder || 0,
    admin.residentId
  ).run();

  // Log admin action
  await logAdminAction(env, admin.residentId, 'create_announcement', announcementId, 'announcement');

  return {
    success: true,
    message: 'Announcement created',
    announcementId
  };
}

/**
 * DELETE /api/chhath/admin/announcements/:id
 * Delete (deactivate) an announcement
 */
async function deleteAnnouncement(request, env) {
  const admin = await requireAdmin(request, env);
  const url = new URL(request.url);
  const announcementId = url.pathname.split('/').pop();

  if (!announcementId) {
    throw new Error('announcement_id required');
  }

  await env.DB.prepare(`
    UPDATE chhath_announcements
    SET active = 0, updated_at = datetime('now')
    WHERE announcement_id = ?
  `).bind(announcementId).run();

  // Log admin action
  await logAdminAction(env, admin.residentId, 'delete_announcement', announcementId, 'announcement');

  return {
    success: true,
    message: 'Announcement deleted'
  };
}

/**
 * Helper: Log admin actions
 */
async function logAdminAction(env, adminResidentId, action, targetId, targetType, details = {}) {
  const logId = generateId('log');

  await env.DB.prepare(`
    INSERT INTO chhath_admin_log (
      log_id, admin_resident_id, action, target_id, target_type, details
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    logId,
    adminResidentId,
    action,
    targetId || null,
    targetType || null,
    JSON.stringify(details)
  ).run();
}
