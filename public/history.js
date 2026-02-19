/**
 * history.js — 7-day history dashboard
 *
 * Fetches /api/history?days=7 on load and renders day cards.
 * Clock ticks every second. No auto-refresh (user can tap 🔄).
 */

'use strict';

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('current-time');
  const dateEl = document.getElementById('current-date');

  timeEl.textContent = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  dateEl.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

setInterval(updateClock, 1000);
updateClock();

// ---------------------------------------------------------------------------
// Fluid type labels
// ---------------------------------------------------------------------------

const FLUID_LABELS = {
  water: 'Water',
  juice: 'Juice',
  vitamin_water: 'Vitamin Water',
  milk: 'Milk',
  pediasure: 'PediaSure',
  yogurt_drink: 'Yogurt Drink',
  urine: 'Urine',
  poop: 'Poop',
  vomit: 'Vomit',
};

const OUTPUT_ICONS = { urine: '💛', poop: '💩', vomit: '🤢' };

function fluidLabel(type) {
  return FLUID_LABELS[type] || type;
}

// ---------------------------------------------------------------------------
// Data fetch
// ---------------------------------------------------------------------------

async function loadHistory() {
  const container = document.getElementById('history-container');
  container.innerHTML = '<div class="h-loading">Loading history…</div>';

  try {
    const res = await fetch('/api/history?days=7');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.ok || !Array.isArray(data.days)) {
      throw new Error('Invalid response from server');
    }

    renderHistory(data.days);

    document.getElementById('last-updated').textContent = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
    });
  } catch (err) {
    console.error('[history] Fetch error:', err.message);
    container.innerHTML = `<div class="h-error">⚠️ Failed to load history: ${err.message}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function renderHistory(days) {
  const container = document.getElementById('history-container');
  container.innerHTML = '';

  if (!days || days.length === 0) {
    container.innerHTML = '<div class="h-loading">No history found.</div>';
    return;
  }

  days.forEach((day, index) => {
    const prevDay = days[index + 1] || null; // previous day (older)
    const card = buildDayCard(day, prevDay);
    container.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// Day card builder
// ---------------------------------------------------------------------------

function buildDayCard(day, prevDay) {
  const card = document.createElement('div');
  card.className = 'day-card card' + (day.isToday ? ' is-today' : '');

  // ---- Header ----
  const header = document.createElement('div');
  header.className = 'day-card-header';
  header.innerHTML = `
    <span class="day-label">${day.label}</span>
    ${day.isToday ? '<span class="today-badge">Today</span>' : ''}
  `;
  card.appendChild(header);

  // Check if the day is completely empty
  const hasAnyData = (
    day.intake.total_ml > 0 ||
    day.outputs.length > 0 ||
    day.gagCount > 0 ||
    day.wellness.afternoon !== null ||
    day.wellness.evening !== null
  );

  if (!hasAnyData && !day.isToday) {
    card.classList.add('day-card-empty');
    const emptyBody = document.createElement('div');
    emptyBody.className = 'h-empty-body';
    emptyBody.textContent = 'No data logged for this day.';
    card.appendChild(emptyBody);
    return card;
  }

  // ---- Intake ----
  card.appendChild(buildIntakeSection(day.intake));

  // ---- Gags ----
  card.appendChild(buildGagSection(day.gagCount));

  // ---- Outputs ----
  card.appendChild(buildOutputsSection(day.outputs));

  // ---- Wellness ----
  card.appendChild(buildWellnessSection(day.wellness, prevDay ? prevDay.wellness : null));

  return card;
}

// --- Intake section ---

function buildIntakeSection(intake) {
  const section = document.createElement('div');
  section.className = 'day-section';

  const { total_ml, limit_ml, percent, byType } = intake;

  // Clamp bar width at 100% visually
  const barWidth = Math.min(percent, 100);

  // Color class
  let colorClass = '';
  if (total_ml > limit_ml) {
    colorClass = 'over';
  } else if (percent >= 90) {
    colorClass = 'red';
  } else if (percent >= 70) {
    colorClass = 'yellow';
  }

  // Fluid type chips
  const chips = Object.entries(byType || {})
    .filter(([, ml]) => ml > 0)
    .map(([type, ml]) => `<span class="h-fluid-chip">${fluidLabel(type)}: <strong>${ml}ml</strong></span>`)
    .join('');

  section.innerHTML = `
    <div class="day-section-label">💧 Intake</div>
    <div class="h-intake-row">
      <span class="h-intake-numbers">${total_ml} / ${limit_ml}ml</span>
      <div class="h-progress-wrap">
        <div class="h-progress-bar ${colorClass}" style="width:${barWidth}%"></div>
      </div>
      <span class="h-intake-pct">${percent}%</span>
    </div>
    ${chips ? `<div class="h-intake-breakdown">${chips}</div>` : ''}
  `;

  return section;
}

// --- Gag section ---

function buildGagSection(count) {
  const section = document.createElement('div');
  section.className = 'day-section';

  section.innerHTML = `
    <div class="day-section-label">🤢 Gags</div>
    ${count > 0
      ? `<span class="h-gag-count">🤢 ${count} gag episode${count !== 1 ? 's' : ''}</span>`
      : '<span class="h-gag-none">None</span>'
    }
  `;

  return section;
}

// --- Outputs section ---

function buildOutputsSection(outputs) {
  const section = document.createElement('div');
  section.className = 'day-section';

  let content;
  if (outputs.length === 0) {
    content = '<span class="h-none">None logged</span>';
  } else {
    const items = outputs.map((o) => {
      const icon = OUTPUT_ICONS[o.fluid_type] || '🚽';
      const amount = o.amount_ml ? `${o.amount_ml}ml` : '';
      return `<li class="h-output-item">
        <span class="h-output-time">${o.time}</span>
        <span>${icon}</span>
        <span class="h-output-type">${fluidLabel(o.fluid_type)}</span>
        <span class="h-output-amount">${amount}</span>
      </li>`;
    }).join('');
    content = `<ul class="h-output-list">${items}</ul>`;
  }

  section.innerHTML = `<div class="day-section-label">🚽 Outputs</div>${content}`;
  return section;
}

// --- Wellness section ---

function buildWellnessSection(wellness, prevWellness) {
  const section = document.createElement('div');
  section.className = 'day-section';

  const { afternoon, evening } = wellness;

  if (!afternoon && !evening) {
    section.innerHTML = `
      <div class="day-section-label">❤️ Wellness</div>
      <span class="h-wellness-none">No wellness check logged</span>
    `;
    return section;
  }

  // Trend helpers — compare this day's evening vs previous day's evening
  const prevEvening = prevWellness ? prevWellness.evening : null;

  function trendHTML(field) {
    const curr = evening ? evening[field] : null;
    const prev = prevEvening ? prevEvening[field] : null;

    if (curr === null || curr === undefined || prev === null || prev === undefined) return '';

    if (curr > prev) return '<span class="h-trend h-trend-up" title="Improved vs yesterday">↑</span>';
    if (curr < prev) return '<span class="h-trend h-trend-down" title="Declined vs yesterday">↓</span>';
    return '<span class="h-trend h-trend-flat" title="Same as yesterday">→</span>';
  }

  function valCell(check, field, showTrend) {
    if (!check) return '<td class="h-val-dash">—</td>';
    const v = check[field];
    if (v === null || v === undefined) return '<td class="h-val-dash">—</td>';
    const trend = showTrend ? trendHTML(field) : '';
    return `<td><span class="h-val">${v}</span>${trend}</td>`;
  }

  const rows = [
    { key: 'appetite', label: 'Appetite' },
    { key: 'energy',   label: 'Energy', trend: true },
    { key: 'mood',     label: 'Mood' },
    { key: 'cyanosis', label: 'Cyanosis', trend: true },
  ];

  const tableRows = rows.map((r) => `
    <tr>
      <td class="h-row-label">${r.label}</td>
      ${valCell(afternoon, r.key, false)}
      ${valCell(evening, r.key, !!r.trend)}
    </tr>
  `).join('');

  section.innerHTML = `
    <div class="day-section-label">❤️ Wellness</div>
    <div class="h-wellness-scroll">
      <table class="h-wellness-table">
        <thead>
          <tr>
            <th></th>
            <th>Afternoon (5pm)</th>
            <th>Evening (10pm)</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;

  return section;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadHistory();

document.getElementById('refresh-btn').addEventListener('click', loadHistory);
