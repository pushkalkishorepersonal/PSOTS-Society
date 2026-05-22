/**
 * PSOTS PWA initialization
 */

(function() {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/society/sw.js', {
          scope: '/society/'
        });
        console.log('[PWA] Service worker registered:', reg.scope);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner(newWorker);
            }
          });
        });
      } catch (err) {
        console.warn('[PWA] SW registration failed:', err);
      }
    });
  }

  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;

    const dismissedAt = localStorage.getItem('psots-install-dismissed');
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    if (dismissedAt && parseInt(dismissedAt) > thirtyDaysAgo) return;

    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    deferredInstallPrompt = null;
    hideInstallBanner();
    localStorage.setItem('psots-install-dismissed', String(Date.now()));
  });

  function showInstallBanner() {
    if (document.getElementById('psots-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'psots-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Install PSOTS app');
    banner.style.cssText = `
      position: fixed; bottom: 1rem; left: 1rem; right: 1rem;
      max-width: 420px; margin: 0 auto;
      background: #1a4a3a; color: #f0d898;
      padding: 12px 16px; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.2);
      display: flex; align-items: center; gap: 12px;
      z-index: 9998; font-family: system-ui, sans-serif;
      font-size: 13.5px;
    `;
    banner.innerHTML = `
      <span style="font-size: 24px;">📱</span>
      <div style="flex: 1;">
        <div style="font-weight: 700; margin-bottom: 2px;">Install PSOTS app</div>
        <div style="opacity: 0.8; font-size: 12px;">Faster loads, works offline</div>
      </div>
      <button id="psots-install-btn" style="
        background: #d4a84b; color: #1a1208; border: none;
        padding: 8px 14px; border-radius: 8px;
        font-weight: 700; font-size: 12.5px; cursor: pointer;
      ">Install</button>
      <button id="psots-install-dismiss" aria-label="Dismiss" style="
        background: transparent; color: #f0d898; border: none;
        font-size: 18px; cursor: pointer; padding: 4px 8px;
      ">×</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('psots-install-btn').addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      hideInstallBanner();
    });

    document.getElementById('psots-install-dismiss').addEventListener('click', () => {
      localStorage.setItem('psots-install-dismissed', String(Date.now()));
      hideInstallBanner();
    });
  }

  function hideInstallBanner() {
    const banner = document.getElementById('psots-install-banner');
    if (banner) banner.remove();
  }

  function showUpdateBanner(newWorker) {
    if (document.getElementById('psots-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'psots-update-banner';
    banner.style.cssText = `
      position: fixed; top: 1rem; left: 1rem; right: 1rem;
      max-width: 420px; margin: 0 auto;
      background: #d4a84b; color: #1a1208;
      padding: 12px 16px; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.2);
      display: flex; align-items: center; gap: 12px;
      z-index: 9999; font-family: system-ui, sans-serif;
      font-size: 13.5px; font-weight: 600;
    `;
    banner.innerHTML = `
      <span style="font-size: 20px;">🔄</span>
      <div style="flex: 1;">New version available</div>
      <button id="psots-update-btn" style="
        background: #1a4a3a; color: #f0d898; border: none;
        padding: 8px 14px; border-radius: 8px;
        font-weight: 700; font-size: 12.5px; cursor: pointer;
      ">Refresh</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('psots-update-btn').addEventListener('click', () => {
      newWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    });
  }
})();
