/**
 * SocietyNav.js — Shared navigation component for all society pages.
 * Cookie-based auth (psots_session) — no Firebase dependency.
 */

const WORKER = 'https://telegram.psots.in';
const SUPER_ADMIN = 'pushkalkishore@gmail.com';

const navStyles = `
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
    --r-md:  12px; --r-lg: 16px; --r-xl: 20px; --r-2xl: 24px;
    --font-serif: 'Playfair Display', Georgia, serif;
    --font-sans:  'Nunito Sans', system-ui, sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; }

  body {
    font-family: var(--font-sans);
    background: var(--cream);
    color: var(--ink);
    line-height: 1.65;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.022'/%3E%3C/svg%3E");
  }

  .card:hover, [class*="listing-card"]:hover, [class*="item-card"]:hover, [class*="request-card"]:hover {
    transform: translateY(-2px) !important;
    box-shadow: var(--shadow-lift) !important;
  }

  button:not(:disabled):active, .btn:not(:disabled):active {
    transform: translateY(1px) scale(0.985) !important;
  }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: var(--cream); }
  ::-webkit-scrollbar-thumb { background: rgba(160,130,90,0.30); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(160,130,90,0.50); }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
  }

  .society-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    height: 62px;
    background: rgba(255,252,247,0.94);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 200;
    transition: box-shadow 0.24s ease;
  }
  .society-nav.scrolled { box-shadow: 0 2px 20px rgba(139,90,26,0.10); }

  .society-nav-brand {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; color: var(--ink); flex-shrink: 0;
  }
  .society-nav-logo { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .society-nav-logo img { width: 34px; height: 34px; object-fit: contain; }
  .society-nav-brand-text { display: none; }
  .society-nav-brand-name { font-family: var(--font-serif); font-size: 15px; font-weight: 600; color: var(--jade); line-height: 1.2; letter-spacing: -0.01em; }
  .society-nav-brand-sub { font-size: 9.5px; color: var(--muted); font-weight: 500; letter-spacing: 0.04em; }

  .society-nav-links { display: flex; gap: 4px; flex: 1; margin-left: 32px; }
  .society-nav-link {
    font-size: 13px; font-weight: 600; color: var(--muted);
    text-decoration: none; padding: 6px 10px; border-radius: 8px;
    transition: color 0.18s, background 0.18s; white-space: nowrap;
  }
  .society-nav-link:hover { color: var(--jade); background: var(--jade-pale); }
  .society-nav-link.active { color: var(--jade); background: var(--jade-pale); font-weight: 700; }

  .society-nav-auth { display: flex; align-items: center; gap: 8px; }
  .society-nav-user {
    cursor: pointer; display: flex; align-items: center; gap: 8px;
    padding: 5px 10px 5px 5px; border-radius: 24px;
    border: 1.5px solid var(--border); background: var(--surface);
    transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
  }
  .society-nav-user:hover { border-color: rgba(26,74,58,0.30); box-shadow: 0 2px 12px rgba(139,90,26,0.10); background: #fffdf9; }
  .society-nav-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--jade); color: var(--gold-pale);
    display: flex; align-items: center; justify-content: center;
    font-size: 10.5px; font-weight: 700; font-family: var(--font-serif); flex-shrink: 0;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.8), 0 0 0 3px rgba(26,74,58,0.12);
  }
  .society-nav-user-text { font-size: 13px; font-weight: 700; color: var(--jade); }
  .society-nav-user-arrow { font-size: 8px; color: var(--muted); margin-left: 1px; }

  .society-nav-dropdown {
    position: absolute; top: calc(100% + 10px); right: 40px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: 0 12px 36px rgba(26,18,8,0.13), 0 2px 8px rgba(0,0,0,0.04);
    min-width: 172px; overflow: hidden; z-index: 300; display: none;
    animation: dropIn 0.18s cubic-bezier(0.22,1,0.36,1);
  }
  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
    to   { opacity: 1; transform: none; }
  }
  .society-nav-dropdown.open { display: block; }
  .society-nav-dropdown a, .society-nav-dropdown button {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 11px 16px; font-size: 13px; font-weight: 600; color: var(--ink);
    text-decoration: none; background: none; border: none; cursor: pointer;
    text-align: left; font-family: var(--font-sans); transition: background 0.14s;
    border-bottom: 1px solid var(--border);
  }
  .society-nav-dropdown a:last-child, .society-nav-dropdown button:last-child { border-bottom: none; }
  .society-nav-dropdown a:hover, .society-nav-dropdown button:hover { background: var(--cream); }
  .society-nav-dropdown button.signout-btn { color: var(--terra); }

  .society-nav-hamburger {
    display: none; width: 36px; height: 36px; background: none;
    border: 1.5px solid var(--border); border-radius: 9px; cursor: pointer;
    color: var(--ink); font-size: 16px; align-items: center; justify-content: center;
    transition: background 0.15s, border-color 0.15s;
  }
  .society-nav-hamburger:hover { background: var(--cream-dark); border-color: rgba(160,130,90,0.40); }

  .society-nav-mobile-menu {
    display: none; position: fixed; top: 62px; left: 0; right: 0;
    background: var(--surface); border-bottom: 1px solid var(--border);
    z-index: 250; max-height: 0; overflow-y: auto;
    transition: max-height 0.3s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08); flex-direction: column;
  }
  .society-nav-mobile-menu.open { display: flex; max-height: calc(100vh - 62px); }
  .society-nav-mobile-menu a, .society-nav-mobile-menu button {
    display: flex; align-items: center; gap: 10px; width: 100%;
    padding: 14px 22px; font-size: 14px; font-weight: 600; color: var(--ink);
    text-decoration: none; background: none; border: none; cursor: pointer;
    text-align: left; font-family: var(--font-sans); border-bottom: 1px solid var(--border); transition: background 0.14s;
  }
  .society-nav-mobile-menu a:hover, .society-nav-mobile-menu button:hover { background: var(--cream); }
  .society-nav-mobile-menu button.signout-btn {
    color: #c0392b; font-weight: 700; background: rgba(192,57,43,0.04);
    border-top: 2px solid var(--border); margin-top: auto;
  }
  .society-nav-mobile-menu button.signout-btn:hover { background: rgba(192,57,43,0.08); }
  .society-nav-mobile-profile-section {
    padding: 14px 22px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 12px;
    background: linear-gradient(135deg, rgba(26,74,58,0.04), transparent);
  }
  .society-nav-mobile-profile-text { font-size: 13px; }
  .society-nav-mobile-profile-text .name { font-weight: 700; color: var(--ink); display: block; }
  .society-nav-mobile-profile-text .email { font-size: 11px; color: var(--muted); }

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

  .society-bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; display: none;
    background: var(--surface); border-top: 1px solid var(--border);
    padding: 4px 0; z-index: 190; box-shadow: 0 -2px 12px rgba(26,18,8,0.08);
  }
  @media (max-width: 768px) { .society-bottom-nav { display: flex; } }
  .bottom-nav-items { display: flex; justify-content: space-around; width: 100%; padding-bottom: env(safe-area-inset-bottom); }
  .bottom-nav-item {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px; padding: 10px; color: var(--muted); text-decoration: none;
    font-size: 10px; font-weight: 600; transition: color 0.15s; flex: 1; text-align: center;
  }
  .bottom-nav-item:active, .bottom-nav-item.active { color: var(--jade); }
  .bottom-nav-icon { font-size: 22px; line-height: 1; }
`;

/**
 * Renders the full society navigation bar.
 * @param {string} containerId - ID of the container div
 * @param {string} activePage  - Active page key for link highlighting
 * @param {object|null} session - Session from /auth/me. If null, fetches automatically.
 */
export async function renderSocietyNav(containerId, activePage, session) {
  activePage = activePage || '';
  session = session || null;

  const container = document.getElementById(containerId);
  if (!container) return;

  if (!session) {
    try {
      const r = await fetch(WORKER + '/auth/me', { credentials: 'include' });
      const d = await r.json();
      if (!d.ok || !d.user) { window.location.href = '/society/login.html'; return; }
      session = d.user;
    } catch (_) { window.location.href = '/society/login.html'; return; }
  }

  const styleEl = document.createElement('style');
  styleEl.textContent = navStyles;
  document.head.appendChild(styleEl);

  function lnk(page, href, label) {
    var cls = 'society-nav-link' + (activePage === page ? ' active' : '');
    return '<a class="' + cls + '" href="' + href + '">' + label + '</a>';
  }

  function blnk(page, href, icon, label) {
    var cls = 'bottom-nav-item' + (activePage === page ? ' active' : '');
    return '<a href="' + href + '" class="' + cls + '"><div class="bottom-nav-icon">' + icon + '</div><span>' + label + '</span></a>';
  }

  container.innerHTML =
    '<nav class="society-nav" id="societyNavBar">'
    + '<a class="society-nav-brand" href="/society/">'
    +   '<div class="society-nav-logo"><img src="/assets/psots-logo.png" alt="PSOTS"></div>'
    +   '<div class="society-nav-brand-text">'
    +     '<div class="society-nav-brand-name">PSOTS Society</div>'
    +     '<div class="society-nav-brand-sub">Prestige Song of the South</div>'
    +   '</div>'
    + '</a>'
    + '<div class="society-nav-links">'
    +   lnk('dashboard',       '/society/',                        'Dashboard')
    +   lnk('marketplace',     '/society/marketplace.html',        'Marketplace')
    +   lnk('guide',           '/society/guide.html',              'Guide')
    +   lnk('lostandfound',    '/society/lostandfound.html',       'Lost & Found')
    +   lnk('carpooling',      '/society/carpooling.html',         'Carpooling')
    +   lnk('recommendations', '/society/recommendations.html',    'Recommendations')
    +   lnk('jobs',            '/society/jobs.html',               'Jobs')
    + '</div>'
    + '<div class="society-nav-auth"><div style="position:relative">'
    +   '<div class="society-nav-user" id="snUserBtn">'
    +     '<div class="society-nav-avatar" id="snAvatar">?</div>'
    +     '<span class="society-nav-user-text" id="snGreeting">Resident</span>'
    +     '<span class="society-nav-user-arrow">&#9660;</span>'
    +   '</div>'
    +   '<div id="snDropdown" class="society-nav-dropdown">'
    +     '<a href="/society/profile.html">&#128100; My Profile</a>'
    +     '<a href="/society/admin.html" id="snAdminLink" style="display:none">&#9881; Admin Panel</a>'
    +     '<button class="signout-btn" id="snSignOut">&#8617; Sign Out</button>'
    +   '</div>'
    + '</div></div>'
    + '<button class="society-nav-hamburger" id="snHamburger">&#9776;</button>'
    + '<div id="snMobileMenu" class="society-nav-mobile-menu">'
    +   '<div class="society-nav-mobile-profile-section">'
    +     '<div class="society-nav-avatar" id="snMobileAvatar">?</div>'
    +     '<div class="society-nav-mobile-profile-text">'
    +       '<span class="name" id="snMobileName">Resident</span>'
    +       '<span class="email" id="snMobileEmail"></span>'
    +     '</div>'
    +   '</div>'
    +   '<a href="/society/">&#127968; Dashboard</a>'
    +   '<a href="/society/marketplace.html">&#128722; Marketplace</a>'
    +   '<a href="/society/guide.html">&#128216; Guide</a>'
    +   '<a href="/society/lostandfound.html">&#128269; Lost & Found</a>'
    +   '<a href="/society/carpooling.html">&#128663; Carpooling</a>'
    +   '<a href="/society/recommendations.html">&#11088; Recommendations</a>'
    +   '<a href="/society/jobs.html">&#128188; Jobs</a>'
    +   '<a href="/society/profile.html">&#128100; My Profile</a>'
    +   '<a href="/society/admin.html" id="snMobileAdminLink" style="display:none">&#9881; Admin Panel</a>'
    +   '<button class="signout-btn" id="snMobileSignOut">&#8617; Sign Out</button>'
    + '</div>'
    + '</nav>'
    + '<nav class="society-bottom-nav"><div class="bottom-nav-items">'
    +   blnk('dashboard',   '/society/',                     '&#127968;', 'Home')
    +   blnk('marketplace', '/society/marketplace.html',     '&#128722;', 'Market')
    +   blnk('guide',       '/society/guide.html',           '&#128216;', 'Guide')
    +   blnk('profile',     '/society/profile.html',         '&#128100;', 'Profile')
    +   '<button class="bottom-nav-item" id="snBottomMore" style="background:none;border:none;cursor:pointer"><div class="bottom-nav-icon">&#8801;</div><span>More</span></button>'
    + '</div></nav>';

  // Populate session data
  var name = session.name || 'Resident';
  var firstName = name.split(' ')[0];
  var initials = name.split(' ').map(function(n) { return n[0] || ''; }).join('').substring(0, 2).toUpperCase();

  document.getElementById('snAvatar').textContent       = initials;
  document.getElementById('snGreeting').textContent     = 'Hi ' + firstName;
  document.getElementById('snMobileAvatar').textContent = initials;
  document.getElementById('snMobileName').textContent   = firstName;
  document.getElementById('snMobileEmail').textContent  = session.email || '';

  // Admin links
  if (session.isAdmin || session.email === SUPER_ADMIN) {
    document.getElementById('snAdminLink').style.display       = 'flex';
    document.getElementById('snMobileAdminLink').style.display = 'flex';
  }

  // Sign out
  function doSignOut() {
    fetch(WORKER + '/auth/logout', { method: 'POST', credentials: 'include' })
      .finally(function() { window.location.href = '/society/login.html'; });
  }
  document.getElementById('snSignOut').addEventListener('click', doSignOut);
  document.getElementById('snMobileSignOut').addEventListener('click', doSignOut);

  // Dropdown
  document.getElementById('snUserBtn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('snDropdown').classList.toggle('open');
  });

  // Hamburger + bottom More
  function toggleMobile() { document.getElementById('snMobileMenu').classList.toggle('open'); }
  document.getElementById('snHamburger').addEventListener('click', toggleMobile);
  document.getElementById('snBottomMore').addEventListener('click', toggleMobile);

  // Close on outside click
  document.addEventListener('click', function(e) {
    var userBtn  = document.getElementById('snUserBtn');
    var dropdown = document.getElementById('snDropdown');
    var hamburger = document.getElementById('snHamburger');
    var mobileMenu = document.getElementById('snMobileMenu');
    if (userBtn && !userBtn.contains(e.target) && dropdown) dropdown.classList.remove('open');
    if (hamburger && !hamburger.contains(e.target) && mobileMenu && !mobileMenu.contains(e.target)) {
      mobileMenu.classList.remove('open');
    }
  });

  // Close mobile menu on link click
  document.querySelectorAll('#snMobileMenu a').forEach(function(a) {
    a.addEventListener('click', function() {
      document.getElementById('snMobileMenu').classList.remove('open');
    });
  });

  // Scroll shadow
  var navBar = document.getElementById('societyNavBar');
  if (navBar) {
    function onScroll() { navBar.classList.toggle('scrolled', window.scrollY > 8); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
}
