/**
 * panel.js — Accent-ladder Chinese HUD (water-blue)
 */
import { STAGES, METHODS } from '../plant/stages.js';

export function initUI({ onSelectStage, onAutoTour }) {
  const stageList = document.getElementById('stage-list');
  const detailTitle = document.getElementById('detail-title');
  const detailAnno = document.getElementById('detail-anno');
  const detailBody = document.getElementById('detail-body');
  const detailMethod = document.getElementById('detail-method');
  const detailChip = document.getElementById('detail-chip');
  const methodLegend = document.getElementById('method-legend');
  const tooltip = document.getElementById('tooltip');
  const btnTour = document.getElementById('btn-tour');
  const btnClose = document.getElementById('btn-close-panel');
  const sidePanel = document.getElementById('side-panel');
  const statSelected = document.getElementById('stat-selected');
  const statStages = document.getElementById('stat-stages');

  if (statStages) statStages.textContent = String(STAGES.length);

  stageList.replaceChildren();
  STAGES.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'stage-btn';
    btn.dataset.index = String(s.index);
    btn.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="name">${s.name}</span>`;
    btn.addEventListener('click', () => {
      onSelectStage(s.index);
      showStage(s.index);
    });
    stageList.appendChild(btn);
  });

  methodLegend.replaceChildren();
  const head = document.createElement('div');
  head.className = 'legend-head';
  head.textContent = '净化程度由低到高';
  methodLegend.appendChild(head);

  const maxDeg = Math.max(...METHODS.map((m) => m.degree));
  METHODS.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'legend-row' + (m.infoOnly ? ' info-only' : '');
    const pct = Math.round((m.degree / maxDeg) * 100);
    row.innerHTML = `
      <div class="meta">
        <strong>${m.name}</strong>
        <p>${m.desc}</p>
      </div>
      <span class="legend-bar" title="${m.degree}/${maxDeg}"><i style="width:${pct}%"></i></span>
    `;
    methodLegend.appendChild(row);
  });

  function setActiveButton(index) {
    stageList.querySelectorAll('.stage-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.index) === index);
    });
  }

  function showStage(index) {
    const s = STAGES[index];
    if (!s) return;
    setActiveButton(index);
    detailTitle.textContent = s.name;
    detailAnno.textContent = s.annotation;
    detailBody.textContent = s.detail;
    if (detailChip) {
      detailChip.hidden = false;
      detailChip.textContent = `第 ${index + 1} 段`;
    }
    if (statSelected) statSelected.textContent = s.short || s.name;
    if (s.method) {
      detailMethod.hidden = false;
      detailMethod.textContent = `相关方法 · ${s.method}`;
    } else {
      detailMethod.hidden = true;
    }
    sidePanel.hidden = false;
    sidePanel.classList.add('open');
  }

  function hidePanel() {
    sidePanel.classList.remove('open');
    sidePanel.hidden = true;
    setActiveButton(-1);
    if (statSelected) statSelected.textContent = '—';
    if (detailChip) detailChip.hidden = true;
  }

  btnClose?.addEventListener('click', () => {
    hidePanel();
    onSelectStage(-1);
  });

  let touring = false;
  btnTour?.addEventListener('click', () => {
    touring = !touring;
    btnTour.classList.toggle('active', touring);
    btnTour.classList.toggle('btn-primary', touring);
    btnTour.classList.toggle('btn-ghost', !touring);
    btnTour.textContent = touring ? '停止巡游' : '自动巡游';
    onAutoTour(touring);
  });

  function showTooltip(text, x, y) {
    if (!tooltip) return;
    tooltip.textContent = text;
    tooltip.style.left = `${x + 14}px`;
    tooltip.style.top = `${y + 14}px`;
    tooltip.hidden = false;
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  return {
    showStage,
    hidePanel,
    setActiveButton,
    showTooltip,
    hideTooltip,
    setTouring(v) {
      touring = v;
      if (btnTour) {
        btnTour.classList.toggle('active', touring);
        btnTour.classList.toggle('btn-primary', touring);
        btnTour.classList.toggle('btn-ghost', !touring);
        btnTour.textContent = touring ? '停止巡游' : '自动巡游';
      }
    },
  };
}
