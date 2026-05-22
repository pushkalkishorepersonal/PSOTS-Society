/**
 * SocietyNav.js — Shared navigation component for all society pages.
 * Replaces inline nav HTML across all 9 pages.
 * Handles: desktop layout, mobile hamburger, profile dropdown, admin link RBAC
 */

import { auth } from '../../core/firebase.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { db, getDoc, doc } from '../../core/db.js';
import { SUPER_ADMIN } from '../../config/constants.js';

const navStyles = `
  /* ── Global page tokens & body ─────────────────────────── */
  :root {
    --jade:         #1a4a3a;
    --jade-light:   #2d6b54;
    --jade-dark:    #102c22;
    --jade-pale:    rgba(26,74,58,0.07);
    --jade-glow:    rgba(26,74,58,0.14);
    --gold:         #b8882a;
    --gold-light:   #d4a84b;
    --gold-pale:    #f0d898;
    --cream:        #f8f2e8;
    --cream-dark:   #ede5d5;
    --surface:      #fffcf7;
    --white:        #ffffff;
    --ink:          #1a1208;
    --ink-soft:     #3d2f1e;
    --muted:        #8a7a6a;
    --border:       rgba(160,130,90,0.20);
    --terra:        #8b3a1a;
    --shadow-card:  0 6px 28px rgba(139,90,26,0.10), 0 1px 4px rgba(0,0,0,0.04);
    --shadow-lift:  0 14px 44px rgba(139,90,26,0.16), 0 3px 10px rgba(0,0,0,0.05);
    --shadow-jade:  0 8px 24px rgba(26,74,58,0.20);
    --r-md:  12px;
    --r-lg:  16px;
    --r-xl:  20px;
    --r-2xl: 24px;
    --font-serif: 'Playfair Display', Georgia, serif;
    --font-sans:  'Nunito Sans', system-ui, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    font-family: var(--font-sans);
    background: var(--cream);
    color: var(--ink);
    line-height: 1.65;
    /* Subtle warm paper grain */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.022'/%3E%3C/svg%3E");
  }

  /* Global card hover polish */
  .card, [class*="listing-card"], [class*="item-card"], [class*="request-card"] {
    transition: transform 0.20s ease, box-shadow 0.20s ease !important;
  }
  .card:hover, [class*="listing-card"]:hover, [class*="item-card"]:hover, [class*="request-card"]:hover {
    transform: translateY(-2px) !important;
    box-shadow: var(--shadow-lift) !important;
  }

  /* Global button press feel */
  button:not(:disabled):active, .btn:not(:disabled):active {
    transform: translateY(1px) scale(0.985) !important;
  }

  /* Smooth scrollbar */
  ::-webkit-scrollbar       { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--cream); }
  ::-webkit-scrollbar-thumb { background: rgba(160,130,90,0.30); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(160,130,90,0.50); }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
  }

  /* ── Navigation ───────────────────────────────────────── */
  .society-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    height: 62px;
    background: rgba(255, 252, 247, 0.94);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 200;
    transition: box-shadow 0.24s ease;
  }

  .society-nav.scrolled {
    box-shadow: 0 2px 20px rgba(139, 90, 26, 0.10);
  }

  .society-nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--ink);
    flex-shrink: 0;
  }

  .society-nav-logo {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .society-nav-logo img {
    width: 34px;
    height: 34px;
    object-fit: contain;
  }

  .society-nav-brand-text {
    display: none;
  }

  .society-nav-brand-text.visible {
    display: block;
  }

  .society-nav-brand-name {
    font-family: var(--font-serif);
    font-size: 15px;
    font-weight: 600;
    color: var(--jade);
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .society-nav-brand-sub {
    font-size: 9.5px;
    color: var(--muted);
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  /* Desktop nav links */
  .society-nav-links {
    display: flex;
    gap: 4px;
    flex: 1;
    margin-left: 32px;
  }

  .society-nav-link {
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
    text-decoration: none;
    padding: 6px 10px;
    border-radius: 8px;
    transition: color 0.18s, background 0.18s;
    white-space: nowrap;
  }

  .society-nav-link:hover {
    color: var(--jade);
    background: var(--jade-pale);
  }

  .society-nav-link.active {
    color: var(--jade);
    background: var(--jade-pale);
    font-weight: 700;
  }

  /* Auth section */
  .society-nav-auth {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .society-nav-user {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 10px 5px 5px;
    border-radius: 24px;
    border: 1.5px solid var(--border);
    background: var(--surface);
    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
  }

  .society-nav-user:hover {
    border-color: rgba(26,74,58,0.30);
    box-shadow: 0 2px 12px rgba(139,90,26,0.10);
    background: #fffdf9;
  }

  .society-nav-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--jade);
    color: var(--gold-pale);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10.5px;
    font-weight: 700;
    font-family: var(--font-serif);
    flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 0 3px rgba(26,74,58,0.12);
  }

  .society-nav-user-text {
    font-size: 13px;
    font-weight: 700;
    color: var(--jade);
  }

  .society-nav-user-arrow {
    font-size: 8px;
    color: var(--muted);
    margin-left: 1px;
  }

  /* Dropdown */
  .society-nav-dropdown {
    position: absolute;
    top: calc(100% + 10px);
    right: 40px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: 0 12px 36px rgba(26,18,8,0.13), 0 2px 8px rgba(0,0,0,0.04);
    min-width: 172px;
    overflow-y: auto; overflow-x: hidden;
    z-index: 300;
    display: none;
    animation: dropIn 0.18s cubic-bezier(0.22,1,0.36,1);
  }

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
    to   { opacity: 1; transform: none; }
  }

  .society-nav-dropdown.open { display: block; }

  .society-nav-dropdown a,
  .society-nav-dropdown button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 11px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-sans);
    transition: background 0.14s;
    border-bottom: 1px solid var(--border);
  }

  .society-nav-dropdown a:last-child,
  .society-nav-dropdown button:last-child { border-bottom: none; }

  .society-nav-dropdown a:hover,
  .society-nav-dropdown button:hover { background: var(--cream); }

  .society-nav-dropdown button.signout-btn { color: var(--terra); }

  /* Hamburger */
  .society-nav-hamburger {
    display: none;
    width: 36px; height: 36px;
    background: none;
    border: 1.5px solid var(--border);
    border-radius: 9px;
    cursor: pointer;
    color: var(--ink);
    font-size: 16px;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
  }

  .society-nav-hamburger:hover {
    background: var(--cream-dark);
    border-color: rgba(160,130,90,0.40);
  }

  .society-nav-hamburger.visible { display: flex; }

  /* Mobile menu */
  .society-nav-mobile-menu {
    display: none;
    position: fixed;
    top: 62px;
    left: 0; right: 0;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    z-index: 250;
    max-height: 0;
    overflow-y: auto; overflow-x: hidden;
    transition: max-height 0.3s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
  }

  .society-nav-mobile-menu.open {
    display: flex;
    max-height: calc(100vh - 62px);
  }

  .society-nav-mobile-menu a,
  .society-nav-mobile-menu button {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 14px 22px;
    font-size: 14px;
    font-weight: 600;
    color: var(--ink);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-sans);
    border-bottom: 1px solid var(--border);
    transition: background 0.14s;
  }

  .society-nav-mobile-menu a:hover,
  .society-nav-mobile-menu button:hover { background: var(--cream); }

  .society-nav-mobile-menu button.signout-btn {
    color: #c0392b;
    font-weight: 700;
    background: rgba(192,57,43,0.04);
    border-top: 2px solid var(--border);
    margin-top: auto;
  }

  .society-nav-mobile-menu button.signout-btn:hover {
    background: rgba(192,57,43,0.08);
  }

  .society-nav-mobile-profile-section {
    padding: 14px 22px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(26,74,58,0.04), transparent);
  }

  .society-nav-mobile-profile-text { font-size: 13px; }
  .society-nav-mobile-profile-text .name  { font-weight: 700; color: var(--ink); display: block; }
  .society-nav-mobile-profile-text .email { font-size: 11px; color: var(--muted); }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .society-nav { padding: 0 18px; }
    .society-nav-links { display: none; }
    .society-nav-hamburger { display: flex !important; }
    .society-nav-auth { display: none; }
    .society-nav-brand-text { display: block !important; }
    .society-nav-mobile-menu { display: none; }
    .society-nav-mobile-menu.open { display: block; }
  }

  @media (min-width: 769px) {
    .society-nav-hamburger { display: none !important; }
    .society-nav-mobile-menu { display: none !important; }
    .society-nav-brand-text { display: block; }
  }

  /* ── Mobile Bottom Navigation ──────────────────────────── */
  .society-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: none;
    background: var(--surface);
    border-top: 1px solid var(--border);
    padding: 4px 0;
    z-index: 190;
    box-shadow: 0 -2px 12px rgba(26,18,8,0.08);
  }

  @media (max-width: 768px) {
    .society-bottom-nav { display: flex; }
  }

  .bottom-nav-items {
    display: flex;
    justify-content: space-around;
    width: 100%;
    padding-bottom: env(safe-area-inset-bottom);
  }

  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 10px;
    color: var(--muted);
    text-decoration: none;
    font-size: 10px;
    font-weight: 600;
    transition: color var(--t-fast);
    flex: 1;
    text-align: center;
  }

  .bottom-nav-item:active,
  .bottom-nav-item.active {
    color: var(--jade);
  }

  .bottom-nav-icon {
    font-size: 22px;
    line-height: 1;
  }
`;

export async function renderSocietyNav(containerId, activePage = '') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`SocietyNav: Container #${containerId} not found`);
    return;
  }

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = navStyles;
  document.head.appendChild(styleEl);

  // Create nav structure
  const navHTML = `
    <nav class="society-nav" id="societyNavBar">
      <a class="society-nav-brand" href="/society/">
        <div class="society-nav-logo">
          <img src="/assets/psots-logo.png" alt="PSOTS" />
        </div>
        <div class="society-nav-brand-text">
          <div class="society-nav-brand-name">PSOTS Society</div>
          <div class="society-nav-brand-sub">Prestige Song of the South</div>
        </div>
      </a>

      <!-- Desktop nav links -->
      <div class="society-nav-links">
        <a class="society-nav-link ${activePage === 'dashboard' ? 'active' : ''}" href="/society/">Dashboard</a>
        <a class="society-nav-link ${activePage === 'marketplace' ? 'active' : ''}" href="/society/marketplace.html">Marketplace</a>
        <a class="society-nav-link ${activePage === 'guide' ? 'active' : ''}" href="/society/guide.html">Guide</a>
        <a class="society-nav-link ${activePage === 'lostandfound' ? 'active' : ''}" href="/society/lostandfound.html">Lost & Found</a>
        <a class="society-nav-link ${activePage === 'carpooling' ? 'active' : ''}" href="/society/carpooling.html">Carpooling</a>
        <a class="society-nav-link ${activePage === 'recommendations' ? 'active' : ''}" href="/society/recommendations.html">Recommendations</a>
        <a class="society-nav-link ${activePage === 'jobs' ? 'active' : ''}" href="/society/jobs.html">Jobs</a>
      </div>

      <!-- Desktop auth -->
      <div class="society-nav-auth">
        <div style="position:relative;">
          <div class="society-nav-user" onclick="window.societyNavToggleDropdown(event)">
            <div class="society-nav-avatar" id="societyNavAvatar">NA</div>
            <span class="society-nav-user-text" id="societyNavGreeting">Resident</span>
            <span class="society-nav-user-arrow">▾</span>
          </div>
          <div id="societyNavDropdown" class="society-nav-dropdown">
            <a href="/society/profile.html">👤 My Profile</a>
            <a href="/society/admin.html" id="societyNavAdminLink" style="display:none;">⚙️ Admin Panel</a>
            <button class="signout-btn" onclick="window.societyNavSignOut()">↩ Sign Out</button>
          </div>
        </div>
      </div>

      <!-- Mobile hamburger -->
      <button class="society-nav-hamburger" id="societyNavHamburger" onclick="window.societyNavToggleMobileMenu()">☰</button>

      <!-- Mobile menu -->
      <div id="societyNavMobileMenu" class="society-nav-mobile-menu">
        <div class="society-nav-mobile-profile-section">
          <div class="society-nav-avatar" id="societyNavMobileAvatar">NA</div>
          <div class="society-nav-mobile-profile-text">
            <span class="name" id="societyNavMobileGreeting">Resident</span>
            <span class="email" id="societyNavMobileEmail">email@example.com</span>
          </div>
        </div>
        <a href="/society/">Dashboard</a>
        <a href="/society/marketplace.html">Marketplace</a>
        <a href="/society/guide.html">Guide</a>
        <a href="/society/lostandfound.html">Lost & Found</a>
        <a href="/society/carpooling.html">Carpooling</a>
        <a href="/society/recommendations.html">Recommendations</a>
        <a href="/society/jobs.html">Jobs</a>
        <a href="/society/profile.html">👤 My Profile</a>
        <a href="/society/admin.html" id="societyNavMobileAdminLink" style="display:none;">⚙️ Admin Panel</a>
        <button class="signout-btn" onclick="window.societyNavSignOut()">↩ Sign Out</button>
      </div>
    </nav>

    <!-- Mobile bottom navigation -->
    <nav class="society-bottom-nav" id="societyBottomNav">
      <div class="bottom-nav-items">
        <a href="/society/" class="bottom-nav-item ${activePage === 'dashboard' ? 'active' : ''}">
          <div class="bottom-nav-icon">🏠</div>
          <span>Home</span>
        </a>
        <a href="/society/marketplace.html" class="bottom-nav-item ${activePage === 'marketplace' ? 'active' : ''}">
          <div class="bottom-nav-icon">🛒</div>
          <span>Market</span>
        </a>
        <a href="/society/guide.html" class="bottom-nav-item ${activePage === 'guide' ? 'active' : ''}">
          <div class="bottom-nav-icon">📖</div>
          <span>Guide</span>
        </a>
        <a href="/society/profile.html" class="bottom-nav-item ${activePage === 'profile' ? 'active' : ''}">
          <div class="bottom-nav-icon">👤</div>
          <span>Profile</span>
        </a>
        <button class="bottom-nav-item" id="bottomNavMore" onclick="window.societyNavToggleMobileMenu()" style="background:none;border:none;cursor:pointer;">
          <div class="bottom-nav-icon">≡</div>
          <span>More</span>
        </button>
      </div>
    </nav>
  `;

  container.innerHTML = navHTML;

  // Global functions for dropdown, hamburger, sign out
  window.societyNavToggleDropdown = function(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('societyNavDropdown');
    dropdown.classList.toggle('open');
  };

  window.societyNavToggleMobileMenu = function() {
    const menu = document.getElementById('societyNavMobileMenu');
    menu.classList.toggle('open');
  };

  window.societyNavSignOut = function() {
    signOut(auth).then(() => {
      window.location.href = '/society/login.html';
    }).catch(err => {
      console.error('Sign out error:', err);
      alert('Error signing out. Please try again.');
    });
  };

  // Scroll shadow on nav
  const navBar = document.getElementById('societyNavBar');
  if (navBar) {
    const onScroll = () => navBar.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Close dropdown/menu when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('societyNavDropdown');
    const menu = document.getElementById('societyNavMobileMenu');
    const hamburger = document.getElementById('societyNavHamburger');
    const userButton = document.querySelector('.society-nav-user');

    if (userButton && !userButton.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown?.classList.remove('open');
    }

    if (hamburger && !hamburger.contains(e.target) && !menu.contains(e.target)) {
      menu?.classList.remove('open');
    }
  });

  // Close mobile menu when clicking bottom nav items (except More)
  const bottomNavItems = document.querySelectorAll('.bottom-nav-item:not(#bottomNavMore)');
  bottomNavItems.forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('societyNavMobileMenu')?.classList.remove('open');
    });
  });

  // Wait for auth state and populate user info
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Not logged in — nav won't be visible on login/register pages
        resolve();
        return;
      }

      try {
        // Fetch resident data via unified-login to get proper name (V2 schema)
        let residentName = user.displayName || 'Resident';
        try {
          if (!user.email) return;
          const idToken = await user.getIdToken();
          const residentRes = await fetch(
            'https://telegram.psots.in/auth/unified-login',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                type: 'google',
                identifier: user.email
              })
            }
          );
          const residentData = await residentRes.json();
          if (residentData.resident?.name) {
            residentName = residentData.resident.name;
          }
        } catch (_) {}

        const firstName = residentName.split(' ')[0];
        const initials = residentName
          .split(' ')
          .map(n => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();

        // Update desktop
        document.getElementById('societyNavAvatar').textContent = initials;
        document.getElementById('societyNavGreeting').textContent = `Hi ${firstName}`;

        // Update mobile
        document.getElementById('societyNavMobileAvatar').textContent = initials;
        document.getElementById('societyNavMobileGreeting').textContent = firstName;
        document.getElementById('societyNavMobileEmail').textContent = user.email || '';

        // Check if user is admin and show admin link
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists() || user.email === SUPER_ADMIN) {
            document.getElementById('societyNavAdminLink').style.display = 'block';
            document.getElementById('societyNavMobileAdminLink').style.display = 'block';
          }
        } catch (err) {
          console.debug('Admin check failed:', err);
        }

        resolve();
      } catch (err) {
        console.error('SocietyNav init error:', err);
        resolve();
      }
    });
  });
}
