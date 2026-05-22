/**
 * Steps.js — Step indicator component.
 *
 * Usage:
 *   const steps = Steps.init('stepsContainer', ['Login','Type','Details','Privacy','Done'])
 *   steps.setActive(2)  // 1-indexed
 */

const Steps = {
  /**
   * Render steps into a container element.
   * @param {string} containerId
   * @param {string[]} labels
   * @returns {{ setActive: Function }}
   */
  init(containerId, labels) {
    const container = document.getElementById(containerId);
    if (!container) return { setActive: () => { } };

    // Build HTML
    const parts = [];
    labels.forEach((label, i) => {
      parts.push(`
        <div class="step faded" id="step_${containerId}_${i + 1}">
          <div class="step-dot">${i + 1}</div>
          <div class="step-label">${label}</div>
        </div>`);
      if (i < labels.length - 1) {
        parts.push(`<div class="step-line" id="line_${containerId}_${i + 1}"></div>`);
      }
    });

    container.className = 'steps';
    container.innerHTML = parts.join('');

    const api = {
      setActive(n) {
        labels.forEach((_, i) => {
          const stepEl = document.getElementById(`step_${containerId}_${i + 1}`);
          const lineEl = document.getElementById(`line_${containerId}_${i + 1}`);

          if (!stepEl) return;
          stepEl.style.opacity = '1';
          stepEl.classList.remove('active', 'done', 'faded');

          if (i + 1 < n) { stepEl.classList.add('done'); }
          else if (i + 1 === n) { stepEl.classList.add('active'); }
          else { stepEl.classList.add('faded'); }

          if (lineEl) lineEl.classList.toggle('done', i + 1 < n);
        });
      }
    };

    api.setActive(1);
    return api;
  }
};

export { Steps };