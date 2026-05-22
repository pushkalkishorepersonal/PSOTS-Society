/**
 * Toast.js — Non-blocking notification toasts.
 *
 * Usage:
 *   Toast.show('Resident approved ✅')
 *   Toast.show('Something failed', 'error')
 *   Toast.show('Check this out', 'warn')
 */

let _el = null;
let _timer = null;

function getEl() {
  if (!_el) {
    _el = document.createElement('div');
    _el.className = 'toast';
    document.body.appendChild(_el);
  }
  return _el;
}

const Toast = {
  /**
   * @param {string} message
   * @param {'success'|'error'|'warn'} type
   * @param {number} duration — ms
   */
  show(message, type = 'success', duration = 3000) {
    const el = getEl();
    el.textContent = message;
    el.className   = `toast show${type !== 'success' ? ` ${type}` : ''}`;

    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(() => { el.className = 'toast'; }, duration);
  },

  success: (msg, ms) => Toast.show(msg, 'success', ms),
  error:   (msg, ms) => Toast.show(msg, 'error',   ms),
  warn:    (msg, ms) => Toast.show(msg, 'warn',    ms),
};

export { Toast };
