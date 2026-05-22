// ============================================================
// js/pages/marketplace/index.js
// Marketplace page orchestrator
// ============================================================

import { auth }          from '../../core/firebase.js';
import { signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import session from '../../core/auth.js';
import marketplaceService from '../../services/marketplace.service.js';
import { renderSocietyNav } from '../../components/shared/SocietyNav.js';

// ── STATE ─────────────────────────────────────────────────
const state = {
  user:       null,
  resident:   null,
  listings:   [],
  category:   'All',
  search:     '',
  loading:    true,
  posting:    false,
};

const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Services', 'Vehicle', 'Other'];

// ── DOM REFS ──────────────────────────────────────────────
const $  = id => document.getElementById(id);
const el = (tag, cls, html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

// ── BOOT ──────────────────────────────────────────────────
// Load listings immediately — no auth needed for public listings
loadListings();

// Render shared nav
await renderSocietyNav('societyNav', 'marketplace');

session.onChange(({ user, resident }) => {
  state.user = user;
  state.resident = resident;
  // Pre-fill Telegram from profile
  if (resident?.telegramUsername) {
    const tgField = document.getElementById('fTelegram');
    if (tgField && !tgField.value) tgField.value = resident.telegramUsername;
  }
});

async function loadListings() {
  state.loading = true;
  renderGrid();
  try {
    state.listings = await marketplaceService.getListings();
  } catch (e) {
    showToast(e.message, 'error');
    state.listings = [];
  }
  state.loading = false;
  renderGrid();
}

// ── AUTH UI ───────────────────────────────────────────────
function updateAuthUI() {
  const postBtn = $('btnPost');
  const banner  = $('mkt-auth-banner');

  if (postBtn) {
    if (state.resident && state.resident.status === 'approved') {
      postBtn.style.display = 'inline-flex';
    } else {
      postBtn.style.display = 'none';
    }
  }

  if (banner) {
    if (!state.user) {
      banner.innerHTML = `
        <span>Sign in to post items or contact sellers.</span>
        <a href="/residents.html" class="mkt-banner-link">Sign in →</a>
      `;
      banner.style.display = 'flex';
    } else if (state.resident && state.resident.status !== 'approved') {
      banner.innerHTML = `<span>Get your resident verification to post listings.</span>
        <a href="/residents.html" class="mkt-banner-link">Get verified →</a>`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }
}

// ── GRID RENDER ───────────────────────────────────────────
function renderGrid() {
  const grid = $('mkt-grid');
  if (!grid) return;

  if (state.loading) {
    grid.innerHTML = `
      <div class="mkt-empty">
        <div class="mkt-spinner"></div>
        <p>Loading listings…</p>
      </div>`;
    return;
  }

  const q   = state.search.trim().toLowerCase();
  const cat = state.category;

  const filtered = state.listings.filter(l => {
    const matchCat  = cat === 'All' || l.category === cat;
    const matchSearch = !q ||
      l.title.toLowerCase().includes(q) ||
      (l.description || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="mkt-empty">
        <div class="mkt-empty-icon">🛒</div>
        <p class="mkt-empty-title">No listings yet</p>
        <p class="mkt-empty-sub">${
          cat !== 'All' || q
            ? 'Try a different category or search term.'
            : 'Be the first to post something!'
        }</p>
      </div>`;
    return;
  }

  grid.innerHTML = '';
  filtered.forEach(listing => {
    grid.appendChild(buildCard(listing));
  });
}

function buildCard(l) {
  const isOwner = state.user && state.user.uid === l.sellerUid;
  const price   = l.price > 0
    ? `₹${Number(l.price).toLocaleString('en-IN')}`
    : 'Free / Negotiable';

  const card = el('div', 'mkt-card');
  card.innerHTML = `
    <div class="mkt-card-top">
      <span class="mkt-cat-badge mkt-cat-${(l.category || 'Other').toLowerCase()}">${l.category || 'Other'}</span>
      ${isOwner ? '<span class="mkt-own-badge">Your listing</span>' : ''}
    </div>
    <h3 class="mkt-card-title">${escHtml(l.title)}</h3>
    <div class="mkt-card-price">${price}</div>
    <p class="mkt-card-desc">${escHtml(l.description || '')}</p>
    <div class="mkt-card-meta">
      <span class="mkt-tower-tag">🏠 Flat ${escHtml(l.sellerFlat || '—')}</span>
      <span class="mkt-card-date">${formatDate(l.createdAt)}</span>
    </div>
    <div class="mkt-card-actions">
      ${!isOwner ? `<button class="mkt-btn mkt-btn-email" data-id="${l.id}" data-seller-uid="${escHtml(l.sellerUid || '')}" data-seller-flat="${escHtml(l.sellerFlat || '')}" data-title="${escHtml(l.title)}" data-post-type="marketplace">💬 Contact Resident</button>` : ''}
      ${isOwner
        ? `<button class="mkt-btn mkt-btn-delete" data-id="${l.id}">Delete</button>`
        : `<button class="mkt-btn mkt-btn-report" data-id="${l.id}">Report</button>`
      }
    </div>
  `;

  // Delete handler
  const delBtn = card.querySelector('.mkt-btn-delete');
  if (delBtn) {
    delBtn.onclick = () => handleDelete(l.id, delBtn);
  }

  // Report handler
  const repBtn = card.querySelector('.mkt-btn-report');
  if (repBtn) {
    repBtn.onclick = () => handleReport(l.id, repBtn);
  }

  // Email contact handler
  const emailBtn = card.querySelector('.mkt-btn-email');
  if (emailBtn) {
    emailBtn.onclick = () => openContactModal(emailBtn.dataset);
  }

  return card;
}

// ── ACTIONS ───────────────────────────────────────────────
async function handleDelete(id, btn) {
  if (!state.user) return;
  if (!confirm('Delete this listing? This cannot be undone.')) return;
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  try {
    await marketplaceService.deleteListing(id, state.user.uid);
    state.listings = state.listings.filter(l => l.id !== id);
    renderGrid();
    showToast('Listing deleted.');
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Delete';
  }
}

async function handleReport(id, btn) {
  if (!state.user) {
    showToast('Sign in to report listings.', 'warn');
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Reporting…';
  try {
    await marketplaceService.reportListing(id, state.user.uid);
    showToast('Listing reported. Thank you.');
    btn.textContent = 'Reported';
  } catch (e) {
    showToast(e.message, 'warn');
    btn.disabled = false;
    btn.textContent = 'Report';
  }
}

// ── POST MODAL ────────────────────────────────────────────
function openModal() {
  const overlay = $('mkt-modal-overlay');
  if (!overlay) return;
  overlay.classList.add('open');
  $('fTitle').focus();
}

function closeModal() {
  const overlay = $('mkt-modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  $('postForm').reset();
  setFormError('');
}

async function handlePost(e) {
  e.preventDefault();
  if (!state.resident || state.resident.status !== 'approved') {
    showToast('Only verified residents can post.', 'error');
    return;
  }
  const btn = $('btnSubmitPost');
  btn.disabled = true;
  btn.innerHTML = '<span class="mkt-spinner-sm"></span> Posting…';
  setFormError('');

  try {
    const data = {
      title:           $('fTitle').value,
      price:           $('fPrice').value,
      description:     $('fDesc').value,
      category:        $('fCategory').value,
      telegramUsername: $('fTelegram').value,
    };
    await marketplaceService.createListing(data, state.resident);
    closeModal();
    showToast('Listing posted!');
    await loadListings();
  } catch (err) {
    setFormError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Listing';
  }
}

function setFormError(msg) {
  const el = $('formError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
}

// ── CONTACT MODAL ─────────────────────────────────────────
function openContactModal(data) {
  if (!state.user) {
    showToast('Sign in to contact sellers.', 'warn');
    return;
  }
  state.contactTarget = data;
  const contactOverlay = $('mkt-contact-overlay');
  if (contactOverlay) {
    contactOverlay.classList.add('open');
    $('contactMessage').focus();
  }
}

function closeContactModal() {
  const contactOverlay = $('mkt-contact-overlay');
  if (contactOverlay) {
    contactOverlay.classList.remove('open');
    const form = $('contactForm');
    if (form) form.reset();
  }
}

async function handleContact(e) {
  e.preventDefault();
  const data = state.contactTarget;
  if (!data || !state.user) {
    showToast('Invalid request.', 'error');
    return;
  }

  const btn = $('btnSendContact');
  const message = $('contactMessage').value.trim();

  if (!message) {
    showToast('Message cannot be empty.', 'warn');
    return;
  }
  if (message.length > 500) {
    showToast('Message must be 500 characters or less.', 'warn');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="mkt-spinner-sm"></span> Sending…';

  try {
    const idToken = await state.user.getIdToken();
    const res = await fetch('https://telegram.psots.in/contact/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({
        targetUid: data.sellerUid,
        postType: data.postType || 'marketplace',
        postId: data.id,
        message,
      }),
    });
    const result = await res.json();
    if (!result.ok) {
      if (result.error === 'rate_limited') {
        showToast('You\'ve reached today\'s contact limit (5/day). Try again tomorrow.', 'warn');
      } else {
        showToast(result.error || 'Failed to send message.', 'error');
      }
      btn.disabled = false;
      btn.textContent = 'Send Message';
      return;
    }
    closeContactModal();
    showToast('Message sent! They\'ll reply via email.');
  } catch (err) {
    showToast('Failed to send message. Please try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'Send Message';
  }
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let t = $('mkt-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'mkt-toast';
    t.className = 'mkt-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `mkt-toast mkt-toast-${type} show`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ── HELPERS ───────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── INIT ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Category pills
  document.querySelectorAll('.mkt-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.mkt-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.category = pill.dataset.cat;
      renderGrid();
    });
  });

  // Search
  const searchInput = $('mkt-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value;
      renderGrid();
    });
  }

  // Post button
  const postBtn = $('btnPost');
  if (postBtn) postBtn.onclick = openModal;

  // Modal close
  const overlay = $('mkt-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal();
    });
  }
  const closeBtn = $('mkt-modal-close');
  if (closeBtn) closeBtn.onclick = closeModal;

  // Post form submit
  const form = $('postForm');
  if (form) form.addEventListener('submit', handlePost);

  // Contact modal handlers
  const contactOverlay = $('mkt-contact-overlay');
  if (contactOverlay) {
    contactOverlay.addEventListener('click', e => {
      if (e.target === contactOverlay) closeContactModal();
    });
  }
  const contactCloseBtn = $('mkt-contact-close');
  if (contactCloseBtn) contactCloseBtn.onclick = closeContactModal;

  // Contact form submit
  const contactForm = $('contactForm');
  if (contactForm) contactForm.addEventListener('submit', handleContact);

  // Load listings - called after DOMContentLoaded setup
  // actual call moved below
});

// loadListings() already called at boot
