/**
 * Modal.js — Reusable modal dialog.
 *
 * Usage:
 *   Modal.show({
 *     title:    'Reject Resident',
 *     body:     '<p>Are you sure?</p>',
 *     confirm:  { label: 'Reject', danger: true, onClick: () => {} },
 *     cancel:   { label: 'Cancel' }
 *   })
 *   Modal.close()
 */

let _overlay = null;

function getOverlay() {
  if (!_overlay) {
    _overlay = document.createElement('div');
    _overlay.className = 'modal-overlay';
    _overlay.innerHTML = `
      <div class="modal" id="modalBox">
        <h3 id="modalTitle"></h3>
        <div id="modalBody"></div>
        <div class="modal-footer" id="modalFooter"></div>
      </div>`;
    _overlay.addEventListener('click', e => {
      if (e.target === _overlay) Modal.close();
    });
    document.body.appendChild(_overlay);
  }
  return _overlay;
}

const Modal = {
  show({ title, body, confirm, cancel }) {
    const overlay = getOverlay();
    document.getElementById('modalTitle').textContent = title || '';
    document.getElementById('modalBody').innerHTML    = body  || '';

    const footer = document.getElementById('modalFooter');
    footer.innerHTML = '';

    if (confirm) {
      const btn = document.createElement('button');
      btn.className   = `btn ${confirm.danger ? 'btn-danger' : 'btn-jade'} btn-inline`;
      btn.textContent = confirm.label || 'Confirm';
      btn.onclick     = () => { confirm.onClick?.(); };
      footer.appendChild(btn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.className   = 'btn btn-outline btn-inline';
    cancelBtn.textContent = cancel?.label || 'Cancel';
    cancelBtn.onclick     = () => Modal.close();
    footer.appendChild(cancelBtn);

    overlay.classList.add('show');
  },

  close() {
    getOverlay().classList.remove('show');
  },
};

export { Modal };
