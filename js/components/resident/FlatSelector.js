/**
 * FlatSelector.js — Flat number text input with live validation.
 *
 * Usage:
 *   const sel = FlatSelector.init('flatSelectorMount', {
 *     onChange: ({ tower, floor, unit, flatNumber, valid }) => {}
 *   })
 *   sel.getValue()  // returns { tower, floor, unit, flatNumber } or null
 *   sel.reset()
 */

import FlatService from '../../services/flat.service.js';

const FlatSelector = {
  /**
   * @param {string} containerId
   * @param {{ onChange: Function, onMemberCheck: Function }} options
   */
  init(containerId, { onChange, onMemberCheck } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="field">
        <label class="field-label">Flat Number</label>
        <input class="field-input" id="fs_input" type="text" placeholder="Enter Valid Flat Number" maxlength="6" autocomplete="off"/>
        <div class="field-hint">Enter your flat number (5 digits)</div>
      </div>
      <div id="fs_validation" style="margin-top:4px"></div>
      <div class="flat-preview" id="fs_preview">
        <div>
          <div style="font-size:9px;color:rgba(255,255,255,.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:1px">Flat Number</div>
          <div class="flat-preview-num" id="fs_flatnum">—</div>
        </div>
        <div class="flat-preview-desc" id="fs_flatdesc">—</div>
      </div>
      <div id="fs_memberinfo" style="margin-top:8px"></div>`;

    const input = document.getElementById('fs_input');
    let _parsed = null;

    async function refresh() {
      const val      = input.value.trim();
      const preview  = document.getElementById('fs_preview');
      const validEl  = document.getElementById('fs_validation');
      const memberEl = document.getElementById('fs_memberinfo');

      if (!val) {
        preview.classList.remove('show');
        validEl.innerHTML  = '';
        memberEl.innerHTML = '';
        _parsed = null;
        return;
      }

      const parts = FlatService.parseFlatNumber(val);
      if (!parts || isNaN(parts.floor) || isNaN(parts.unit)) {
        validEl.innerHTML  = `<div class="info-box warn">Invalid flat number.</div>`;
        preview.classList.remove('show');
        memberEl.innerHTML = '';
        _parsed = null;
        return;
      }

      const result = FlatService.validate(parts.tower, parts.floor, parts.unit);
      if (!result.valid) {
        validEl.innerHTML  = `<div class="info-box warn">${result.error}</div>`;
        preview.classList.remove('show');
        memberEl.innerHTML = '';
        _parsed = null;
        return;
      }

      validEl.innerHTML = '';
      document.getElementById('fs_flatnum').textContent  = result.flatNumber;
      document.getElementById('fs_flatdesc').textContent = '';
      preview.classList.add('show');

      _parsed = { tower: parts.tower, floor: parts.floor, unit: parts.unit, flatNumber: result.flatNumber };

      if (onMemberCheck) {
        memberEl.innerHTML = '<div style="font-size:11.5px;color:var(--muted)">Checking flat occupancy...</div>';
        try {
          await onMemberCheck(result.flatNumber, memberEl);
        } catch (_) {
          memberEl.innerHTML = '';
        }
      }

      onChange?.({ ..._parsed, valid: true });
    }

    input.addEventListener('input', refresh);

    return {
      getValue() { return _parsed; },
      reset() {
        input.value = '';
        _parsed     = null;
        document.getElementById('fs_preview').classList.remove('show');
        document.getElementById('fs_validation').innerHTML  = '';
        document.getElementById('fs_memberinfo').innerHTML = '';
      }
    };
  }
};

export { FlatSelector };
