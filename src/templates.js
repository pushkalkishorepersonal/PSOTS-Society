export const EVENTS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Society Events | PSOTS Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Prata&display=swap" rel="stylesheet">
    <style>
        :root { --sangria: #9f1239; --navy: #0f172a; --glass: rgba(15, 23, 42, 0.7); --glass-border: rgba(255, 255, 255, 0.1); --text-main: #f8fafc; --text-dim: #cbd5e1; --gold: #d4af37; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #020617; color: var(--text-main); min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
        
        .hero-bg {
            position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
            background: linear-gradient(to bottom, rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.98)), 
                        url('https://raw.githubusercontent.com/pushkalkishorepersonal/psots/main/IMG_20260322_050644_641.jpg');
            background-size: cover; background-position: center; z-index: -1;
        }

        header { width: 100%; max-width: 1400px; padding: 30px 60px; display: flex; justify-content: space-between; align-items: center; }
        .logo-box { width: 44px; height: 44px; background: #1e293b; border: 1px solid var(--glass-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: var(--gold); }
        .nav { display: flex; gap: 40px; font-size: 12px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px; }

        .container { width: 100%; max-width: 1000px; padding: 60px 20px 140px; }
        .hero { margin-bottom: 80px; text-align: center; }
        .hero h1 { font-family: 'Prata', serif; font-size: 3.5rem; font-weight: 400; margin-bottom: 15px; }
        .hero p { color: var(--text-dim); font-size: 1.2rem; font-weight: 300; }

        .event-grid { display: grid; gap: 24px; }
        .event-card { 
            background: var(--glass); border: 1px solid var(--glass-border); 
            border-radius: 32px; padding: 40px; display: flex; gap: 40px;
            backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .event-card:hover { transform: translateY(-8px); border-color: var(--gold); background: rgba(15, 23, 42, 0.85); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
        .date-box { 
            background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.2);
            border-radius: 20px; padding: 20px; width: 100px; text-align: center; height: fit-content;
        }
        .date-month { font-size: 13px; text-transform: uppercase; font-weight: 800; color: var(--gold); letter-spacing: 2px; }
        .date-day { font-size: 32px; font-weight: 800; color: #fff; }
        
        .event-info { flex: 1; }
        .event-tag { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: var(--gold); margin-bottom: 12px; }
        .event-title { font-family: 'Prata', serif; font-size: 26px; font-weight: 400; margin-bottom: 12px; }
        .event-desc { color: var(--text-dim); font-size: 15px; line-height: 1.7; font-weight: 300; margin-bottom: 25px; }
        
        .btn { display: inline-block; padding: 12px 28px; background: var(--gold); color: #000; text-decoration: none; border-radius: 10px; font-weight: 750; font-size: 13px; transition: transform 0.2s; }
        .btn:hover { transform: scale(1.05); }

        .empty-state { text-align: center; padding: 100px 40px; background: var(--glass); border-radius: 32px; border: 1px dashed var(--glass-border); backdrop-filter: blur(10px); }
        
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .wow { animation: slideUp 1s cubic-bezier(0.16, 1, 0.3, 1) both; }
    </style>
</head>
<body>
    <div class="hero-bg"></div>
    <header>
        <div style="display:flex; align-items:center; gap:15px;">
            <div class="logo-box">P</div>
            <div style="font-weight:800; font-size:19px; letter-spacing:1px;">PSOTS HUB</div>
        </div>
        <nav class="nav">
            <a href="/" style="text-decoration:none; color:inherit;">Home</a>
            <a href="/market" style="text-decoration:none; color:inherit;">Market</a>
            <a href="/events" style="color:#fff; text-decoration:none;">Events</a>
            <a href="/handbook" style="text-decoration:none; color:inherit;">Guide</a>
        </nav>
    </header>

    <div class="container">
        <div class="hero wow">
            <h1>SOCIETY EVENTS</h1>
            <p>Bringing neighbors together. Upcoming celebrations and gatherings at Prestige Song of the South.</p>
        </div>

        <div id="event-list" class="event-grid">
            <div style="text-align:center; padding:50px; color:var(--text-dim);">🔬 Syncing upcoming society calendar...</div>
        </div>
    </div>

    <script>
        async function loadEvents() {
            try {
                const mockEvents = [
                    { title: "Chhath Puja 2026", date: "2026-11-02", desc: "The grand annual celebration by the ghat. A resident-led vibrant spiritual festival.", approved: true },
                    { title: "Durga Puja Planning", date: "2026-10-01", desc: "Executive committee meeting for festival planning and logistics.", approved: false },
                    { title: "Residents Monthly Meeting", date: "2026-05-15", desc: "Discussing society maintenance, CAM charges, and safety audits.", approved: true }
                ];
                const now = new Date();
                const forwardThreshold = new Date();
                forwardThreshold.setDate(now.getDate() + 90);
                const listEl = document.getElementById('event-list');
                const visibleEvents = mockEvents.filter(e => {
                    const eventDate = new Date(e.date);
                    return (eventDate <= forwardThreshold && eventDate >= now) || e.approved;
                });
                if (visibleEvents.length === 0) {
                    listEl.innerHTML = '<div class="empty-state"><h3>No imminent events</h3><p>Check back later for upcoming community activities.</p></div>';
                    return;
                }
                listEl.innerHTML = visibleEvents.map((e, idx) => {
                    const d = new Date(e.date);
                    return \`
                        <div class="event-card wow" style="animation-delay: \${idx * 0.1}s">
                            <div class="date-box">
                                <div class="date-month">\${d.toLocaleString('default', { month: 'short' })}</div>
                                <div class="date-day">\${d.getDate()}</div>
                            </div>
                            <div class="event-info">
                                <div class="event-tag">\${e.approved ? '⭐ Community Event' : 'Planning Phase'}</div>
                                <div class="event-title">\${e.title}</div>
                                <p class="event-desc">\${e.desc}</p>
                                <a href="#" class="btn">View Details</a>
                            </div>
                        </div>
                    \`;
                }).join('');
            } catch(e) { document.getElementById('event-list').innerHTML = '<p>Error loading events.</p>'; }
        }
        loadEvents();
    </script>
</body>
</html>`;

export const GRAND_LOBBY_HTML = (clientId) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PSOTS | The Grand Lobby</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <style>
        :root {
            --sangria: #9f1239;
            --navy: #0f172a;
            --glass: rgba(15, 23, 42, 0.7);
            --glass-border: rgba(255, 255, 255, 0.1);
            --text-main: #f8fafc;
            --text-dim: #cbd5e1;
            --gold: #d4af37;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Inter', sans-serif; 
            background: #020617;
            color: var(--text-main);
            min-height: 100vh;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .hero-bg {
            position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
            background: linear-gradient(to bottom, rgba(15, 23, 42, 0.3), rgba(15, 23, 42, 0.95)), 
                        url('https://raw.githubusercontent.com/pushkalkishorepersonal/psots/main/IMG_20260322_050644_641.jpg');
            background-size: cover; background-position: center;
            z-index: -1;
        }

        .top-banner { width: 100%; background: rgba(0,0,0,0.6); padding: 10px; text-align: center; font-size: 11px; color: var(--text-dim); border-bottom: 1px solid rgba(255,255,255,0.05); letter-spacing: 0.5px; backdrop-filter: blur(10px); }
        .top-banner strong { color: var(--gold); }

        header {
            width: 100%; max-width: 1400px;
            padding: 30px 60px;
            display: flex; justify-content: space-between; align-items: center;
        }
        .brand { display: flex; align-items: center; gap: 15px; }
        .logo-box { width: 44px; height: 44px; background: #1e293b; border: 1px solid var(--glass-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: var(--gold); box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
        .brand-text h1 { font-size: 19px; font-weight: 800; letter-spacing: 1px; }
        .brand-text p { font-size: 10px; text-transform: uppercase; color: var(--text-dim); letter-spacing: 2.5px; }

        .hero { text-align: center; margin-top: 100px; padding: 0 20px; max-width: 1000px; }
        .hero h1 { font-family: 'Prata', 'Playfair Display', serif; font-size: 5rem; font-weight: 400; line-height: 1.1; margin-bottom: 30px; letter-spacing: -2px; }
        .hero h1 span { font-style: italic; color: var(--gold); }
        .hero p { color: var(--text-dim); font-size: 1.4rem; max-width: 700px; margin: 0 auto 50px; line-height: 1.6; font-weight: 300; }
        
        .auth-actions { display: flex; gap: 24px; justify-content: center; margin-bottom: 120px; }
        .btn-premium { 
            padding: 18px 40px; border-radius: 12px; font-weight: 600; font-size: 15px; 
            display: flex; align-items: center; gap: 12px; text-decoration: none; cursor: pointer;
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid transparent;
        }
        .btn-google { background: #fff; color: #000; }
        .btn-telegram { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.2); backdrop-filter: blur(15px); }
        .btn-premium:hover { transform: translateY(-8px); box-shadow: 0 20px 40px rgba(0,0,0,0.4); border-color: var(--gold); }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
            gap: 30px; width: 100%; max-width: 1400px; padding: 0 60px 140px;
        }
        .feature-card {
            background: var(--glass);
            border: 1px solid var(--glass-border);
            backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
            padding: 50px; border-radius: 32px;
            transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            cursor: pointer; position: relative; overflow: hidden;
        }
        .feature-card::before { content: ""; position: absolute; top:0; left:0; width:100%; height:4px; background: var(--gold); opacity:0; transition:0.3s; }
        .feature-card:hover { transform: translateY(-15px); border-color: var(--gold); background: rgba(15, 23, 42, 0.85); }
        .feature-card:hover::before { opacity:1; }
        .icon-wrap { font-size: 48px; margin-bottom: 30px; }
        .feature-card h2 { font-family: 'Prata', serif; font-size: 28px; font-weight: 400; margin-bottom: 18px; }
        .feature-card p { color: var(--text-dim); line-height: 1.8; font-size: 16px; font-weight: 300; }

        .stats-section {
            width: 100%; background: linear-gradient(to right, #020617, #0f172a, #020617);
            padding: 60px 40px; display: flex; justify-content: center; gap: 100px; flex-wrap: wrap;
            border-top: 1px solid var(--glass-border); border-bottom: 1px solid var(--glass-border);
        }
        .stat-box { text-align: center; }
        .stat-number { font-size: 32px; font-weight: 800; color: #fff; margin-bottom: 6px; }
        .stat-tag { font-size: 11px; text-transform: uppercase; color: var(--gold); letter-spacing: 3px; font-weight: 800; }

        footer { padding: 80px 60px; width: 100%; max-width: 1400px; }
        .footer-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 60px; }
        .footer-brand h2 { font-family: 'Prata', serif; font-size: 22px; margin-bottom: 15px; }
        .footer-brand p { color: var(--text-dim); line-height: 1.7; max-width: 350px; font-size: 14px; font-weight: 300; }
        .footer-links { display: flex; gap: 80px; }
        .link-group h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--gold); margin-bottom: 25px; }
        .link-group ul { list-style: none; }
        .link-group li { margin-bottom: 15px; }
        .link-group a { color: var(--text-dim); text-decoration: none; font-size: 14px; transition: color 0.3s; }
        .link-group a:hover { color: #fff; }

        @keyframes slideUp { from { opacity:0; transform: translateY(40px); } to { opacity:1; transform: translateY(0); } }
        .wow { animation: slideUp 1s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }

        @media (max-width: 768px) {
            .hero h1 { font-size: 3rem; }
            header { padding: 30px 20px; }
            .feature-grid { padding: 0 20px 80px; }
            .stats-section { gap: 40px; }
            .footer-top { flex-direction: column; gap: 50px; }
        }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Prata&display=swap" rel="stylesheet">
</head>
<body>
    <div class="top-banner">
        🛡️ <strong>Resident Initiative</strong> — Independently built by PSOTS residents. Not affiliated with or endorsed by the RWA.
    </div>
    
    <div class="hero-bg"></div>

    <header>
        <div class="brand">
            <div class="logo-box">P</div>
            <div class="brand-text">
                <h1>PSOTS</h1>
                <p>Prestige Song of the South</p>
            </div>
        </div>
        <nav style="display:flex; gap:40px; font-size:12px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:1.5px;">
            <a href="/" style="color:#fff; text-decoration:none;">Home</a>
            <a href="/market" style="text-decoration:none; color:inherit;">Market</a>
            <a href="/events" style="text-decoration:none; color:inherit;">Events</a>
            <a href="/handbook" style="text-decoration:none; color:inherit;">Guide</a>
        </nav>
    </header>

    <div class="hero">
        <h1 class="wow">Your home.<br><span>Our community.</span></h1>
        <p class="wow delay-1">The unified heartbeat of Prestige Song of the South. A resident-built portal for convenience, connection, and celebration.</p>
        
        <div class="auth-actions wow delay-2">
            <div id="g_id_onload"
                data-client_id="${clientId}"
                data-callback="handleCredentialResponse"
                data-auto_prompt="false">
            </div>
            <div class="g_id_signin" data-type="standard" data-shape="pill" data-theme="filled_blue" data-text="continue_with" data-size="large" data-logo_alignment="left"></div>
            
            <a href="https://t.me/PSOTS_Bot" class="btn-premium btn-telegram">
                <img src="https://telegram.org/img/t_logo.png" width="22" height="22">
                Continue with Telegram
            </a>
        </div>
    <div class="feature-grid">
        <div class="feature-card wow delay-1" onclick="location.href='/market'">
            <div class="icon-wrap">🛒</div>
            <h2>Marketplace</h2>
            <p>Direct neighbor-to-neighbor trade. A trusted space for pre-loved items and local services, verified by the community sentinel.</p>
        </div>
        <div class="feature-card wow delay-2" onclick="location.href='/events'">
            <div class="icon-wrap">🏺</div>
            <h2>Event Hub</h2>
            <p>Celebrate our vibrant festivals like Chhath Puja 2026. Manage contributions, view schedules, and participate in community activities.</p>
        </div>
        <div class="feature-card wow delay-3" onclick="location.href='/handbook'">
            <div class="icon-wrap">📖</div>
            <h2>Community Guide</h2>
            <p>Everything our 2,100+ families need in one place. Handbooks, rules, and governance guidelines for modern society living.</p>
        </div>
    </div>

    <div class="stats-section wow">
        <div class="stat-box">
            <div class="stat-number">2,100+</div>
            <div class="stat-tag">Residential Flats</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">14</div>
            <div class="stat-tag">Total Towers</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">33</div>
            <div class="stat-tag">Acres of Greens</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">25+</div>
            <div class="stat-tag">Club Amenities</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">24/7</div>
            <div class="stat-tag">Smart Security</div>
        </div>
    </div>

    <footer>
        <div class="footer-top">
            <div class="footer-brand">
                <h2>Prestige Song of the South</h2>
                <p>A resident-built community portal for the 2,100+ families across 14 towers in Yelenahalli, Bangalore. Built by residents, for residents.</p>
            </div>
            <div class="footer-links">
                <div class="link-group">
                    <h4>Portal</h4>
                    <ul>
                        <li><a href="/">Home</a></li>
                        <li><a href="/events">Events</a></li>
                        <li><a href="/handbook">Guide</a></li>
                        <li><a href="/market">Marketplace</a></li>
                    </ul>
                </div>
                <div class="link-group">
                    <h4>Contact</h4>
                    <ul>
                        <li><a href="mailto:support@psots.in">support@psots.in</a></li>
                        <li><a href="tel:+916366561152">+91 63665 61152</a></li>
                        <li><a href="tel:+918041404804">+91 80 4140 4804</a></li>
                    </ul>
                </div>
            </div>
        </div>
        <div style="padding-top:40px; border-top:1px solid var(--glass-border); font-size:12px; color:var(--text-dim); display:flex; justify-content:space-between;">
            <div>&copy; 2026 PSOTS Community Portal. All rights reserved.</div>
            <div style="display:flex; gap:20px;">
                <span>Self-managed</span>
                <span>No ads</span>
                <span>No spam</span>
            </div>
        </div>
    </footer>

    <!-- REGISTRATION OVERLAY -->
    <div id="reg-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:var(--glass); align-items:center; justify-content:center; backdrop-filter:blur(10px); z-index:100;">
        <div class="reg-card" style="background:#1e293b; padding:40px; border-radius:16px;">
            <h2 style="margin-bottom:20px; font-family:'Prata',serif;">RESIDENT IDENTITY</h2>
            <p style="color:var(--text-dim); text-align:center; font-size:13px; margin-bottom:24px;">Complete your profile to unlock full community access. 🏘️</p>
            <form id="reg-form" onsubmit="registerProfile(event)">
                <input type="hidden" id="reg-userid">
                <select class="reg-input" id="tower" required style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;">
                    <option value="">Select Tower...</option>
                    ${Array.from({length:14}, (_, i) => `<option value="${i+1}">Tower ${i+1}</option>`).join('')}
                </select>
                <input type="text" class="reg-input" id="flat" placeholder="Flat Number (e.g. 101)" required style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;">
                <select class="reg-input" id="role" required style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px;">
                    <option value="owner">Owner</option>
                    <option value="tenant">Tenant</option>
                    <option value="resident">Family Member</option>
                </select>
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px; font-size:13px; color:var(--text-dim);">
                    <input type="checkbox" id="reg-digest" style="width:18px; height:18px; accent-color:var(--sangria);">
                    <label for="reg-digest">Subscribe to Weekly Society Digest 📧</label>
                </div>
                <div id="reg-error" style="color:var(--sangria); font-size:12px; margin-bottom:12px; text-align:center; display:none;"></div>
                <button type="submit" class="reg-btn" style="width:100%; padding:12px; border-radius:8px; background:var(--gold); border:none; font-weight:bold;">REGISTER PROFILE</button>
            </form>
        </div>
    </div>

    <script>
        async function handleCredentialResponse(response) {
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            const userId = payload.sub;
            document.getElementById('reg-userid').value = userId;
            
            // Check if registered
            try {
                const res = await fetch('/api/residents');
                const data = await res.json();
                const exists = (data.residents||[]).find(r => r.userId === userId);
                
                if (!exists) {
                    document.getElementById('reg-overlay').style.display = 'flex';
                } else {
                    location.href = '/market';
                }
            } catch(e) {
                document.getElementById('reg-overlay').style.display = 'flex';
            }
        }

        async function registerProfile(e) {
            e.preventDefault();
            const body = {
                userId: document.getElementById('reg-userid').value,
                tower: document.getElementById('tower').value,
                flat: document.getElementById('flat').value,
                role: document.getElementById('role').value,
                emailDigest: document.getElementById('reg-digest').checked
            };
            
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                location.href = '/market';
            } else {
                const d = await res.json();
                document.getElementById('reg-error').textContent = '⚠️ ' + (d.error || 'Registration failed');
                document.getElementById('reg-error').style.display = 'block';
            }
        }
    </script>
</body>
</html>`;

export const MARKETPLACE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Marketplace | PSOTS Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Prata&display=swap" rel="stylesheet">
    <style>
        :root { --sangria: #9f1239; --navy: #0f172a; --glass: rgba(15, 23, 42, 0.7); --glass-border: rgba(255, 255, 255, 0.1); --text-main: #f8fafc; --text-dim: #cbd5e1; --gold: #d4af37; }
        * { margin:0; padding:0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #020617; color: var(--text-main); min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
        
        .hero-bg {
            position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
            background: linear-gradient(to bottom, rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.98)), 
                        url('https://raw.githubusercontent.com/pushkalkishorepersonal/psots/main/IMG_20260322_050644_641.jpg');
            background-size: cover; background-position: center; z-index: -1;
        }

        header { width: 100%; max-width: 1400px; padding: 30px 60px; display: flex; justify-content: space-between; align-items: center; }
        .logo-box { width: 44px; height: 44px; background: #1e293b; border: 1px solid var(--glass-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: var(--gold); }
        .nav { display: flex; gap: 40px; font-size: 12px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px; }

        .header-section { padding: 60px 20px; text-align: center; }
        .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px 140px; }
        
        .search-box { width: 100%; max-width: 600px; padding: 18px; background: var(--glass); border: 1px solid var(--glass-border); border-radius: 16px; color: #fff; font-size: 16px; margin: -40px auto 60px; display: block; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); transition: border-color 0.3s; }
        .search-box:focus { outline: none; border-color: var(--gold); }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px; }
        .card { 
            background: var(--glass); border: 1px solid var(--glass-border); border-radius: 32px; padding: 40px; 
            transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px);
            position: relative; overflow: hidden;
        }
        .card:hover { transform: translateY(-8px); border-color: var(--gold); background: rgba(15, 23, 42, 0.85); box-shadow: 0 20px 40px rgba(0,0,0,0.3); }
        
        .price { color: #22c55e; font-weight: 800; font-size: 22px; margin-bottom: 12px; font-family: 'Inter', sans-serif; }
        .item-title { font-family: 'Prata', serif; font-size: 22px; font-weight: 400; margin-bottom: 12px; color: #fff; }
        .seller { font-size: 11px; color: var(--gold); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; margin-top: 25px; padding-top: 20px; border-top: 1px solid var(--glass-border); }
        
        .btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 24px; background: var(--gold); color: #000; text-decoration: none; border-radius: 12px; font-weight: 750; font-size: 13px; border: none; cursor: pointer; transition: transform 0.2s; }
        .btn:hover { transform: scale(1.02); }
        .btn-ghost { background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border); color: #fff; }
        
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .wow { animation: slideUp 1s cubic-bezier(0.16, 1, 0.3, 1) both; }
    </style>
</head>
<body>
    <div class="hero-bg"></div>
    <header>
        <div style="display:flex; align-items:center; gap:15px;">
            <div class="logo-box">P</div>
            <div style="font-weight:800; font-size:19px; letter-spacing:1px;">PSOTS HUB</div>
        </div>
        <nav class="nav">
            <a href="/" style="text-decoration:none; color:inherit;">Home</a>
            <a href="/market" style="color:#fff; text-decoration:none;">Market</a>
            <a href="/events" style="text-decoration:none; color:inherit;">Events</a>
            <a href="/handbook" style="text-decoration:none; color:inherit;">Guide</a>
        </nav>
    </header>

    <div class="header-section">
        <h1 style="font-family: 'Prata', serif; font-size: 3.5rem; font-weight:400; margin-bottom: 20px;">COMMUNITY<br>MARKETPLACE</h1>
        <button class="btn" style="background:#fff; color:#000; margin-bottom: 20px;" onclick="showPostForm()">+ POST NEW LISTING</button>
    </div>

    <!-- POST LISTING MODAL -->
    <div id="post-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.95); backdrop-filter:blur(20px); z-index:1000; align-items:center; justify-content:center; padding:20px;">
        <div style="background:#020617; border:1px solid var(--glass-border); padding:50px; border-radius:32px; width:100%; max-width:550px;">
            <h2 style="font-family:'Prata', serif; margin-bottom:30px; font-size:28px;">POST A LISTING</h2>
            <form onsubmit="submitPost(event)">
                <input type="text" id="post-item" placeholder="What are you selling?" class="search-box" style="margin:0 0 16px; width:100%;" required>
                <input type="text" id="post-price" placeholder="Price (₹)" class="search-box" style="margin:0 0 16px; width:100%;" required>
                <textarea id="post-desc" placeholder="Describe the item..." class="search-box" style="margin:0 0 16px; width:100%; min-height:120px; resize:none;" required></textarea>
                <div id="post-error" style="color:var(--sangria); font-size:12px; margin-bottom:12px; display:none;"></div>
                <div style="display:flex; gap:15px;">
                    <button type="submit" class="btn" style="flex:1;">POST NOW</button>
                    <button type="button" class="btn btn-ghost" style="flex:1;" onclick="hidePostForm()">CANCEL</button>
                </div>
            </form>
        </div>
    </div>

    <input type="text" class="search-box" placeholder="Search for items, flats, services..." onkeyup="search(this.value)">
    <div class="container">
        <div id="grid" class="grid">Loading community listings...</div>
    </div>

    <script>
        let allListings = [];
        async function load() {
            try {
                const r = await fetch('/api/marketplace');
                const d = await r.json();
                allListings = d.listings || [];
                render(allListings);
            } catch(e) { console.error(e); }
        }
        function render(list) {
            document.getElementById('grid').innerHTML = list.map((l, index) => \`
                <div class="card wow" style="animation-delay: \${index * 0.05}s">
                    <div class="price">\${l.price ? '₹'+parseInt(l.price).toLocaleString('en-IN') : 'Price on DM'}</div>
                    <div class="item-title">\${l.item || 'Listing'}</div>
                    <p style="margin-bottom: 12px; line-height: 1.7; color:var(--text-dim); font-size:14px; font-weight:300;">\${l.text || l.description}</p>
                    <div style="display:flex; gap:10px; margin-top: 25px; align-items:center;">
                        <a href="https://t.me/\${l.username}" class="btn" style="flex:1">Message</a>
                        <button class="btn btn-ghost" style="width:44px; height:44px; padding:0;" onclick="reportListing('\${l.listingId}')" title="Report Violation">🚩</button>
                        \${l.userId === localStorage.getItem('psots_userid') ? '<button class="btn" style="background:#e74c3c; color:#fff;" onclick="deleteListing(\\'' + l.listingId + '\\')">Delete</button>' : ''}
                    </div>
                    <div class="seller">
                        👤 @\${l.username} • 📅 \${new Date(l.timestamp).toLocaleDateString()}
                    </div>
                </div>
            \`).join('') || '<div class="empty-state"><h3>No listings found</h3><p>Try searching for something else or post a new item.</p></div>';
        }

        function showPostForm() { document.getElementById('post-modal').style.display = 'flex'; }
        function hidePostForm() { document.getElementById('post-modal').style.display = 'none'; }

        async function submitPost(e) {
            e.preventDefault();
            const body = {
                item: document.getElementById('post-item').value, price: document.getElementById('post-price').value, description: document.getElementById('post-desc').value,
                userId: localStorage.getItem('psots_userid'), username: localStorage.getItem('psots_username') || 'Resident'
            };
            const res = await fetch('/api/marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const d = await res.json();
            if (d.error) { document.getElementById('post-error').textContent = '⚠️ ' + d.error; document.getElementById('post-error').style.display = 'block'; }
            else { hidePostForm(); load(); }
        }

        async function deleteListing(id) { if(!confirm('Delete listing?')) return; await fetch('/api/marketplace?id='+id, { method: 'DELETE' }); load(); }
        function reportListing(id) { if(confirm('Report listing?')) alert('Admins notified.'); }
        function search(q) {
            const filtered = allListings.filter(l => (l.text||'').toLowerCase().includes(q.toLowerCase()) || (l.username||'').toLowerCase().includes(q.toLowerCase()));
            render(filtered);
        }
        load();
    </script>
</body>
</html>`;

export const HANDBOOK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resident Handbook | PSOTS Hub</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Prata&display=swap" rel="stylesheet">
    <style>
        :root { --sangria: #9f1239; --navy: #0f172a; --glass: rgba(15, 23, 42, 0.7); --glass-border: rgba(255, 255, 255, 0.1); --text-main: #f8fafc; --text-dim: #cbd5e1; --gold: #d4af37; }
        * { margin:0; padding:0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: #020617; color: var(--text-main); min-height: 100vh; line-height: 1.7; display: flex; flex-direction: column; align-items: center; }
        
        .hero-bg {
            position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
            background: linear-gradient(to bottom, rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.98)), 
                        url('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=2000');
            background-size: cover; background-position: center; z-index: -1;
        }

        header { width: 100%; max-width: 1400px; padding: 30px 60px; display: flex; justify-content: space-between; align-items: center; }
        .logo-box { width: 44px; height: 44px; background: #1e293b; border: 1px solid var(--glass-border); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; color: var(--gold); }
        .nav { display: flex; gap: 40px; font-size: 12px; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px; }

        .container { max-width: 900px; margin: 0 auto; padding: 80px 20px 140px; }
        .hero { margin-bottom: 80px; text-align: center; }
        .hero h1 { font-family: 'Prata', serif; font-size: 4rem; font-weight: 400; margin-bottom: 20px; letter-spacing: -1px; }
        .hero p { color: var(--text-dim); font-size: 1.25rem; font-weight: 300; }

        section { margin-bottom: 80px; width: 100%; }
        h2 { font-family: 'Prata', serif; font-size: 32px; font-weight: 400; color: var(--gold); margin-bottom: 30px; border-bottom: 1px solid var(--glass-border); padding-bottom: 15px; }
        
        .rule-card { 
            background: var(--glass); border: 1px solid var(--glass-border); border-radius: 24px; padding: 40px; 
            backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); margin-bottom: 20px;
            transition: transform 0.3s;
        }
        .rule-card:hover { transform: translateX(10px); border-color: var(--gold); }
        
        .rule-title { font-weight: 800; font-size: 18px; color: #fff; margin-bottom: 12px; display: flex; align-items: center; gap: 15px; }
        .rule-title span { color: var(--gold); }
        .rule-text { color: var(--text-dim); font-size: 15px; font-weight: 300; }

        .tag { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; }
        .tag-core { background: rgba(212, 175, 55, 0.15); color: var(--gold); }
        .tag-amenity { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .wow { animation: fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) both; }
    </style>
</head>
<body>
    <div class="hero-bg"></div>
    <header>
        <div style="display:flex; align-items:center; gap:15px;">
            <div class="logo-box">P</div>
            <div style="font-weight:800; font-size:19px; letter-spacing:1px;">PSOTS HUB</div>
        </div>
        <nav class="nav">
            <a href="/" style="text-decoration:none; color:inherit;">Home</a>
            <a href="/market" style="text-decoration:none; color:inherit;">Market</a>
            <a href="/events" style="text-decoration:none; color:inherit;">Events</a>
            <a href="/handbook" style="color:#fff; text-decoration:none;">Guide</a>
        </nav>
    </header>

    <div class="container">
        <div class="hero wow">
            <h1>COMMUNITY<br>GUIDE</h1>
            <p>The definitive manual for modern living at Prestige Song of the South. Designed for harmony, safety, and resident comfort.</p>
        </div>

        <section class="wow">
            <h2>01. PSOTS Moderation Bot</h2>
            <div class="rule-card">
                <div class="tag tag-core">Essential</div>
                <div class="rule-title"><span>●</span> Commercial & Buy/Sell Messages</div>
                <div class="rule-text">The group is strictly for socializing, not commerce. Selling items, flats for rent, or unsolicited offers will be automatically deleted. Please use our community Marketplace instead.</div>
            </div>
            <div class="rule-card">
                <div class="tag tag-core">Essential</div>
                <div class="rule-title"><span>●</span> Political & Religious Content</div>
                <div class="rule-text">To prevent conflict, all political content or religious solicitation (donation drives) is strictly prohibited. Approved society events (Diwali, Chhath Puja, Eid, etc.) are allowed.</div>
            </div>
            <div class="rule-card">
                <div class="tag tag-core">Essential</div>
                <div class="rule-title"><span>●</span> Abusive Language & Spam</div>
                <div class="rule-text">Spam, promotions, profanities, and personal attacks will be swiftly deleted by the bot to maintain a pleasant neighborhood environment.</div>
            </div>
        </section>

        <section class="wow">
            <h2>02. Violation Tracking & Actions</h2>
            <div class="rule-card">
                <div class="tag tag-amenity">Bot Action</div>
                <div class="rule-title"><span>●</span> Instant Deletion & Warning</div>
                <div class="rule-text">If you violate a rule, the message is instantly deleted and you'll receive a private warning DM. Your violation counts naturally decay after 30 days.</div>
            </div>
            <div class="rule-card">
                <div class="tag tag-amenity">Admin Alert</div>
                <div class="rule-title"><span>●</span> Repeat Offender Policy</div>
                <div class="rule-text">At 3 violations, the admins are silently notified. At 5 violations, a critical warning is issued. At 10 violations, you are subject to administrative removal from the group entirely. You can appeal false flags by contacting an admin via your user portal.</div>
            </div>
        </section>

        <footer style="margin-top:40px; padding-top:40px; border-top:1px solid var(--glass-border); text-align:center; color:var(--text-dim); font-size:13px; font-weight:300;">
            <p>&copy; 2026 PSOTS Community Hub. All rights reserved.</p>
        </footer>
    </div>
</body>
</html>`;

export const ADMIN_DASHBOARD = (clientId) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>PSOTS Admin</title>
<script src="https://accounts.google.com/gsi/client" async defer></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f5;color:#333}
#login-screen{display:flex;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#667eea,#764ba2)}
.login-box{background:white;padding:40px;border-radius:16px;text-align:center;max-width:360px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3)}
.login-box h1{font-size:22px;margin:16px 0 8px}
.login-box p{color:#666;font-size:14px;margin-bottom:24px}
#dashboard{display:none}
header{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:16px 20px;display:flex;justify-content:space-between;align-items:center}
header h1{font-size:20px}
.user-info{font-size:13px;opacity:0.9;margin-right:10px}
.container{max-width:1000px;margin:0 auto;padding:20px}
.tabs{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}
.tab-btn{padding:10px 18px;background:white;border:2px solid #ddd;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;transition:all 0.2s}
.tab-btn.active{background:#667eea;color:white;border-color:#667eea}
.tab{display:none;background:white;padding:24px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
.tab.active{display:block}
.status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.stat-card{background:#f8f0ff;padding:20px;border-radius:10px;border-left:4px solid #667eea;text-align:center}
.stat-card h3{color:#667eea;font-size:13px;margin-bottom:8px}
.stat-card .num{font-size:32px;font-weight:bold}
.item{background:#f9f9f9;padding:14px;border-radius:8px;margin-bottom:10px;border-left:4px solid #667eea}
.item strong{color:#667eea}
.btn{padding:9px 18px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px}
.btn:hover{background:#764ba2}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-red{background:#e74c3c}
.input-row{display:flex;gap:8px;margin-bottom:12px}
.input-row input,.input-row select{flex:1;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:14px}
.tag{display:inline-block;background:#667eea;color:white;padding:5px 10px;border-radius:20px;margin:3px;font-size:12px}
.tag button{background:none;border:none;color:white;cursor:pointer;margin-left:6px;font-size:14px}
.settings-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
.settings-card{background:#f9f9f9;padding:16px;border-radius:8px;border:1px solid #eee}
.settings-card h3{color:#667eea;margin-bottom:12px;font-size:14px}
.settings-card label{display:block;font-size:12px;color:#666;margin-bottom:4px;margin-top:8px}
.settings-card input,.settings-card select{width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:13px}
@media(max-width:600px){.container{padding:10px}.tabs{gap:4px}.tab-btn{padding:8px 12px;font-size:12px}.settings-row{grid-template-columns:1fr}}
</style>
</head>
<body>

<!-- LOGIN SCREEN -->
<div id="login-screen">
  <div class="login-box">
    <div style="font-size:48px">🤖</div>
    <h1>PSOTS Admin</h1>
    <p style="margin-bottom:32px">Sign in to manage the bot</p>

    <!-- Google Login -->
    <div style="margin-bottom:20px">
      <div id="g_id_onload"
        data-client_id="${clientId}"
        data-callback="handleGoogleLogin"
        data-auto_prompt="false">
      </div>
      <div class="g_id_signin"
        data-type="standard"
        data-size="large"
        data-theme="outline"
        data-text="sign_in_with"
        data-shape="rectangular"
        data-logo_alignment="left">
      </div>
    </div>

    <div id="auth-error" style="color:#e74c3c;font-size:13px;margin-top:12px;display:none">
      ❌ Not authorized. Contact admin.
    </div>
  </div>
</div>

<!-- GROUP LOBBY -->
<div id="lobby-screen" style="display:none; padding:40px; background:#f5f5f5; min-height:100vh;">
  <div style="max-width:1200px; margin:0 auto;">
    <header style="margin-bottom: 40px; display:flex; justify-content:space-between; align-items:center; background:linear-gradient(135deg,#667eea,#764ba2); color:white; padding:16px 20px; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
      <h1 style="font-size:20px;">🤖 PSOTS Community Lobby</h1>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="user-info" id="lobby-user-email"></span>
        <button class="btn btn-red btn-sm" onclick="logout()">Logout</button>
      </div>
    </header>
    <h2 style="margin-bottom:20px; color:#333;">Select a Community to Manage</h2>
    <div id="group-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:24px;">
      <!-- Dynamically filled with tiles -->
    </div>
  </div>
</div>

<!-- DASHBOARD -->
<div id="dashboard">
  <header>
    <div style="display:flex;align-items:center;gap:15px">
      <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);" onclick="exitDashboard()">← Back to Lobby</button>
      <h1 style="font-size:20px;" id="active-group-title">🤖 Admin Dashboard</h1>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <span class="user-info" id="user-email"></span>
      <button class="btn btn-red btn-sm" onclick="logout()">Logout</button>
    </div>
  </header>
  <div class="container">
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('status',this)">📊 Status</button>
      <button class="tab-btn" onclick="switchTab('violations',this)">⚠️ Violations</button>
      <button class="tab-btn" onclick="switchTab('keywords',this)">🔑 Keywords</button>
      <button class="tab-btn" onclick="switchTab('admins',this)">👥 Admins</button>
      <button class="tab-btn" onclick="switchTab('residents',this)">🏡 Residents</button>
      <button class="tab-btn" onclick="switchTab('settings',this)">⚙️ Settings</button>
      <button class="tab-btn" onclick="switchTab('logs',this)">📝 Logs</button>
    </div>

    <div id="status" class="tab active">
      <div class="status-grid">
        <div class="stat-card"><h3>Messages Scanned</h3><div class="num" id="scanned">-</div></div>
        <div class="stat-card"><h3>Violations (30d)</h3><div class="num" id="vcount">-</div></div>
        <div class="stat-card"><h3>Users Tracked</h3><div class="num" id="ucount">-</div></div>
        <div class="stat-card"><h3>Admins</h3><div class="num" id="acount">-</div></div>
      </div>
    </div>

    <div id="violations" class="tab">
      <h2 style="margin-bottom:16px">⚠️ Violations (Last 30 Days)</h2>
      <div id="violationsList">Loading...</div>
    </div>

    <div id="keywords" class="tab">
      <h2 style="margin-bottom:16px">🔑 Manage Keywords</h2>
      <div class="input-row">
        <select id="categorySelect" onchange="loadKeywordsForCategory()">
          <option value="buySell">Buy/Sell</option>
          <option value="political">Political</option>
          <option value="religious">Religious</option>
          <option value="spam">Spam</option>
          <option value="abuseEnglish">Abusive (English)</option>
          <option value="abuseHindi">Abusive (Hindi)</option>
          <option value="personalAttacks">Personal Attacks</option>
          <option value="approvedEvents">Approved Events ✅</option>
          <option value="societyFees">Society Fees (Exempt ✅)</option>
        </select>
      </div>
      <div id="keywordsList" style="margin-bottom:16px;min-height:40px"></div>
      <div class="input-row">
        <input type="text" id="newKeyword" placeholder="Add new keyword...">
        <button class="btn" onclick="addKeyword()">Add</button>
      </div>
    </div>

    <div id="admins" class="tab">
      <h2 style="margin-bottom:16px">👥 Admin Management</h2>
      <div id="adminsList" style="margin-bottom:16px"></div>
      <div class="input-row">
        <input type="email" id="newAdmin" placeholder="Add admin email...">
        <button class="btn" onclick="addAdmin()">Add Admin</button>
      </div>
    </div>

    <div id="residents" class="tab">
      <h2 style="margin-bottom:16px">🏡 Resident Ledger</h2>
      <div id="residentsList" style="margin-bottom:16px">Loading...</div>
    </div>

    <div id="settings" class="tab">
      <h2 style="margin-bottom:16px">⚙️ Action Settings</h2>
      <p style="color:#666;font-size:13px;margin-bottom:16px">Configure what happens at each violation count</p>
      <div class="settings-row">
        <div class="settings-card">
          <h3>1st Violation</h3>
          <label>Action</label>
          <select id="action1"><option value="warn">Warn Only</option></select>
          <label>Message</label>
          <input type="text" id="msg1" placeholder="Warning message...">
        </div>
        <div class="settings-card">
          <h3>2nd Violation</h3>
          <label>Action</label>
          <select id="action2"><option value="warn">Warn Only</option></select>
          <label>Message</label>
          <input type="text" id="msg2" placeholder="Warning message...">
        </div>
        <div class="settings-card">
          <h3>3rd Violation</h3>
          <label>Action</label>
          <select id="action3">
            <option value="warn">Warn Only</option>
            <option value="mute" selected>Mute</option>
            <option value="kick">Kick</option>
            <option value="ban">Ban</option>
          </select>
          <label>Mute Duration (minutes)</label>
          <input type="number" id="mute3" value="60" min="1">
          <label>Message</label>
          <input type="text" id="msg3" placeholder="Warning message...">
        </div>
        <div class="settings-card">
          <h3>5th Violation</h3>
          <label>Action</label>
          <select id="action5">
            <option value="warn">Warn Only</option>
            <option value="mute">Mute</option>
            <option value="kick" selected>Kick</option>
            <option value="ban">Ban</option>
          </select>
          <label>Message</label>
          <input type="text" id="msg5" placeholder="Warning message...">
        </div>
        <div class="settings-card">
          <h3>10th Violation</h3>
          <label>Action</label>
          <select id="action10">
            <option value="warn">Warn Only</option>
            <option value="mute">Mute</option>
            <option value="kick">Kick</option>
            <option value="ban" selected>Ban Permanently</option>
          </select>
          <label>Message</label>
          <input type="text" id="msg10" placeholder="Warning message...">
        </div>
      </div>
      <button class="btn" onclick="saveSettings()">💾 Save Settings</button>
      <div id="settings-msg" style="margin-top:10px;color:#27ae60;font-size:13px"></div>
    </div>

    <div id="logs" class="tab">
      <h2 style="margin-bottom:16px">📝 Deleted Messages (Last 30 Days)</h2>
      <div id="logsList">Loading...</div>
    </div>
  </div>
</div>

<script>
const API = '/api';
let currentUserEmail = '';
let allowedAdmins = [];

// GOOGLE LOGIN HANDLER
async function handleGoogleLogin(response) {
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const email = payload.email;
    currentUserEmail = email;
    localStorage.setItem('psots_admin_email', email);
    localStorage.setItem('psots_admin_token', response.credential);

    // Fetch allowed groups via RBAC
    const res = await fetch(API + '/my-groups?email=' + encodeURIComponent(email));
    const data = await res.json();
    const allowedGroups = data.groups;

    if (Object.keys(allowedGroups).length > 0) {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('user-email').textContent = email;
      document.getElementById('lobby-user-email').textContent = email;
      document.getElementById('lobby-screen').style.display = 'block';

      const grid = document.getElementById('group-grid');
      grid.innerHTML = '';
      
      if (!data.tokenSet) {
        grid.innerHTML = \`<div style="grid-column: 1/-1; background:#fff5f5; border:1px solid #feb2b2; padding:15px; border-radius:12px; color:#c53030; margin-bottom:20px; font-size:14px;">
           ⚠️ <strong>Critical Configuration Missing:</strong> Your BOT_TOKEN is not set in KV. The bot cannot hear Telegram messages until this is fixed.
        </div>\` + grid.innerHTML;
      }
      
      for (const [id, data] of Object.entries(allowedGroups)) {
        grid.innerHTML += \`<div style="background:#fff; border-radius:16px; padding:30px; border-top: 5px solid #667eea; box-shadow:0 15px 35px rgba(0,0,0,0.06); cursor:pointer; transition:all 0.3s; display:flex; align-items:center; gap:20px;" 
             onclick="enterDashboard('\${id}', '\${data.title}')" 
             onmouseover="this.style.transform='translateY(-6px)'; this.style.boxShadow='0 20px 45px rgba(0,0,0,0.1)';" 
             onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 15px 35px rgba(0,0,0,0.06)';"
             title="Manage \${data.title}">
          <div style="width:64px; height:64px; border-radius:50%; background:#f0f0f0; overflow:hidden; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            \${data.photo ? \`<img src="\${data.photo}" style="width:100%; height:100%; object-fit:cover;">\` : \`<span style="font-size:24px;">🏘️</span>\`}
          </div>
          <div>
            <h3 style="color:#2d3748; margin-bottom:4px; font-size:18px; font-weight:800;">\${data.title}</h3>
            <p style="font-size:13px; color:#718096; font-family:monospace;">ID: \${id}</p>
          </div>
        </div>\`;
      }
    } else {
      document.getElementById('auth-error').style.display = 'block';
      document.getElementById('auth-error').textContent = '❌ Access Denied: No communities assigned to this email.';
    }
  } catch(e) {
    document.getElementById('auth-error').style.display = 'block';
    document.getElementById('auth-error').textContent = '❌ Login failed. Try again.';
  }
}

function logout() {
  localStorage.removeItem('psots_admin_email');
  localStorage.removeItem('psots_admin_token');
  google.accounts.id.disableAutoSelect();
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'none';
}

function enterDashboard(groupId, groupTitle) {
  activeGroup = groupId;
  document.getElementById('active-group-title').textContent = '🤖 ' + groupTitle;
  document.getElementById('lobby-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadStatus();
  switchTab('status', document.querySelector('.tab-btn'));
}

function exitDashboard() {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('lobby-screen').style.display = 'block';
}

function switchTab(t, btn) {
  document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(e => e.classList.remove('active'));
  document.getElementById(t).classList.add('active');
  btn.classList.add('active');
  if(t==='status') loadStatus();
  if(t==='violations') loadViolations();
  if(t==='keywords') loadKeywordsForCategory();
  if(t==='admins') loadAdmins();
  if(t==='residents') loadResidents();
  if(t==='settings') loadSettings();
  if(t==='logs') loadLogs();
}

let activeGroup = '';



async function loadStatus() {
  try {
    const r = await fetch(API + '/status?group=' + activeGroup);
    const d = await r.json();
    document.getElementById('scanned').textContent = d.totalScanned||0;
    document.getElementById('vcount').textContent = d.violations||0;
    document.getElementById('ucount').textContent = d.users||0;
    document.getElementById('acount').textContent = d.admins||0;
  } catch(e){}
}

async function loadViolations() {
  try {
    const r = await fetch(API + '/violations?group=' + activeGroup);
    const d = await r.json();
    document.getElementById('violationsList').innerHTML = !d.violations.length ? '<p style="color:#999">No violations recorded.</p>' :
      d.violations.map(v => \`<div class="item"><strong>@\${v.username}</strong> — \${v.count} violations<br>
      <small style="color:#888">\${(v.history||[]).slice(-3).map(h=>h.type).join(' • ')}</small>
      <button class="btn btn-sm btn-red" style="float:right" onclick="resetUser('\${v.username}')">Reset</button></div>\`).join('');
  } catch(e){}
}

async function loadAdmins() {
  try {
    const r = await fetch(API + '/admins?group=' + activeGroup);
    const d = await r.json();
    document.getElementById('adminsList').innerHTML = (d.admins||[]).map(e =>
      \`<div class="item">\${e}<button class="btn btn-sm btn-red" style="float:right" onclick="removeAdmin('\${e}')">Remove</button></div>\`
    ).join('');
  } catch(e){}
}

async function loadKeywordsForCategory() {
  try {
    const cat = document.getElementById('categorySelect').value;
    const r = await fetch(API + '/keywords?group=' + activeGroup);
    const d = await r.json();
    document.getElementById('keywordsList').innerHTML = (d.keywords[cat]||[]).map(kw =>
      \`<span class="tag">\${kw}<button onclick="removeKeyword('\${cat}','\${kw}')">×</button></span>\`
    ).join('') || '<span style="color:#999;font-size:13px">No keywords yet</span>';
  } catch(e){}
}

async function addKeyword() {
  const cat = document.getElementById('categorySelect').value;
  const kw = document.getElementById('newKeyword').value.trim();
  if(!kw) return;
  await fetch(API + '/keywords?group=' + activeGroup,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:cat,keyword:kw,action:'add'})});
  document.getElementById('newKeyword').value='';
  loadKeywordsForCategory();
}

async function removeKeyword(cat,kw) {
  await fetch(API + '/keywords?group=' + activeGroup,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:cat,keyword:kw,action:'remove'})});
  loadKeywordsForCategory();
}

async function addAdmin() {
  const email = document.getElementById('newAdmin').value.trim();
  if(!email) return;
  await fetch(API + '/admins?group=' + activeGroup,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,action:'add'})});
  document.getElementById('newAdmin').value='';
  loadAdmins();
}

async function removeAdmin(email) {
  if(!confirm('Remove '+email+'?')) return;
  await fetch(API + '/admins?group=' + activeGroup,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,action:'remove'})});
  loadAdmins();
}

async function resetUser(username) {
  if(!confirm('Reset violations for @'+username+'?')) return;
  await fetch(API + '/violations?group=' + activeGroup,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,action:'reset'})});
  loadViolations();
}

async function loadSettings() {
  try {
    const r = await fetch(API + '/settings?group=' + activeGroup);
    const d = await r.json();
    if(d.settings) {
      const s = d.settings;
      if(s.firstViolation) { document.getElementById('action1').value=s.firstViolation.action||'warn'; document.getElementById('msg1').value=s.firstViolation.message||''; }
      if(s.secondViolation) { document.getElementById('action2').value=s.secondViolation.action||'warn'; document.getElementById('msg2').value=s.secondViolation.message||''; }
      if(s.thirdViolation) { document.getElementById('action3').value=s.thirdViolation.action||'mute'; document.getElementById('mute3').value=s.thirdViolation.duration||60; document.getElementById('msg3').value=s.thirdViolation.message||''; }
      if(s.fifthViolation) { document.getElementById('action5').value=s.fifthViolation.action||'kick'; document.getElementById('msg5').value=s.fifthViolation.message||''; }
      if(s.tenthViolation) { document.getElementById('action10').value=s.tenthViolation.action||'ban'; document.getElementById('msg10').value=s.tenthViolation.message||''; }
    }
  } catch(e){}
}

async function saveSettings() {
  const settings = {
    firstViolation: { action: document.getElementById('action1').value, message: document.getElementById('msg1').value },
    secondViolation: { action: document.getElementById('action2').value, message: document.getElementById('msg2').value },
    thirdViolation: { action: document.getElementById('action3').value, duration: parseInt(document.getElementById('mute3').value)||60, message: document.getElementById('msg3').value },
    fifthViolation: { action: document.getElementById('action5').value, message: document.getElementById('msg5').value },
    tenthViolation: { action: document.getElementById('action10').value, message: document.getElementById('msg10').value }
  };
  await fetch(API + '/settings?group=' + activeGroup,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});
  document.getElementById('settings-msg').textContent = '✅ Settings saved!';
  setTimeout(()=>document.getElementById('settings-msg').textContent='',3000);
}

async function loadResidents() {
  try {
    const r = await fetch(API + '/residents?group=' + activeGroup);
    const d = await r.json();
    document.getElementById('residentsList').innerHTML = !d.residents.length ? '<p style="color:#999">No residents recorded.</p>' :
      d.residents.map(res => \`<div class="item">
        <strong>\${res.flat || 'N/A'}</strong> — \${res.name || res.username}<br>
        <small style="color:#888">UID: \${res.userId} • \${res.verifiedAt ? '✅ Verified' : '⏳ Pending'} • \${res.emailDigest ? '📧 Subscribed' : '🔕 No Email'}</small>
        \${!res.verifiedAt ? \`<button class="btn btn-sm" style="float:right" onclick="approveResident('\${res.userId}')">Approve</button>\` : ''}
      </div>\`).join('');
  } catch(e){}
}

async function approveResident(userId) {
  if(!confirm('Approve resident?')) return;
  const details = { flat: prompt('Enter Flat Number (e.g. A-101):') };
  if(!details.flat) return;
  await fetch(API + '/verify-resident?group=' + activeGroup,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,action:'approve',details})});
  loadResidents();
}

async function loadLogs() {
  try {
    const r = await fetch(API + '/logs?group=' + activeGroup);
    const d = await r.json();
    document.getElementById('logsList').innerHTML = !d.logs.length ? '<p style="color:#999">No logs yet.</p>' :
      d.logs.slice(0,50).map(l => \`<div class="item"><strong>@\${l.username}</strong> — \${l.violationType}<br>
      <small>"\${(l.messageText||'').substring(0,70)}..."</small><br>
      <small style="color:#aaa">\${new Date(l.timestamp).toLocaleString()}</small></div>\`).join('');
  } catch(e){}
}

loadGroups();
// Auto-restore session on page load
const savedToken = localStorage.getItem('psots_admin_token');
if (savedToken) {
  try {
    handleGoogleLogin({ credential: savedToken });
  } catch(e) {
    localStorage.removeItem('psots_admin_email');
    localStorage.removeItem('psots_admin_token');
  }
}
</script>
</body>
</html>`;

export const USER_PANEL = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Violations - PSOTS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 15px; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .stat-card h3 { color: #667eea; margin-bottom: 10px; font-size: 14px; }
    .stat-card .number { font-size: 32px; font-weight: bold; color: #e74c3c; }
    .violation-item { background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #e74c3c; }
    .violation-item h3 { color: #e74c3c; font-size: 14px; margin-bottom: 5px; }
    .violation-item p { font-size: 12px; color: #666; }
    .no-violations { background: white; padding: 40px; border-radius: 8px; text-align: center; }
    .no-violations h2 { color: #27ae60; margin-bottom: 10px; }
    .error { background: #fee; padding: 15px; border-radius: 8px; color: #c33; border: 1px solid #fcc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Your Violations</h1>
      <p>PSOTS Group - Last 30 Days</p>
    </div>
    <div id="content">Loading...</div>
  </div>

  <script>
    async function load() {
      const userId = new URLSearchParams(window.location.search).get('id');
      if (!userId) {
        document.getElementById('content').innerHTML = '<div class="error">Invalid user ID</div>';
        return;
      }

      try {
        const res = await fetch('/api/user-violations?id=' + userId);
        const data = await res.json();

        if (!data.violations) {
          document.getElementById('content').innerHTML = '<div class="no-violations"><h2>✅ Clean Record</h2><p>No violations in the last 30 days</p></div>';
          return;
        }

        let html = '<div class="stat-card"><h3>Total Violations</h3><div class="number">' + data.violations.count + '</div></div>';

        if (data.violations.history && data.violations.history.length > 0) {
          html += '<h3 style="margin-top: 20px; margin-bottom: 10px;">📋 Violation History</h3>';
          data.violations.history.forEach(v => {
            const date = new Date(v.timestamp).toLocaleDateString();
            html += '<div class="violation-item"><h3>' + v.type + '</h3><p>' + date + '</p>';
            if (v.message) {
              html += '<p style="font-style: italic; color: #999; margin-top: 5px;">Message: "' + (v.message.substring(0, 100) + (v.message.length > 100 ? '...' : '')) + '"</p>';
            }
            html += '</div>';
          });
        }

        // Show admin contact list
        if (data.admins && data.admins.length > 0) {
          html += '<div style="margin-top: 30px; padding: 15px; background: #f0f0f0; border-radius: 8px;">';
          html += '<h3 style="margin-bottom: 10px;">📞 Contact Group Admins</h3>';
          html += '<p style="font-size: 13px; color: #666; margin-bottom: 10px;">If you believe this violation was unfair, reach out to a group admin:</p>';
          data.admins.forEach(admin => {
            html += '<div style="padding: 8px; background: white; margin-bottom: 8px; border-radius: 5px; font-size: 13px;">';
            html += '📧 ' + admin.email;
            if (admin.telegram_id) {
              html += ' | 💬 @' + admin.telegram_id;
            }
            html += '</div>';
          });
          html += '</div>';
        }

        document.getElementById('content').innerHTML = html;
      } catch (err) {
        document.getElementById('content').innerHTML = '<div class="error">Error loading violations: ' + err.message + '</div>';
        console.error('Error:', err);
      }
    }

    load();
  </script>
</body>
</html>`;
