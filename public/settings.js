/**
 * settings.js — Settings page logic
 *
 * Loads /api/settings on page load and populates all form fields.
 * On save: POSTs to /api/settings, shows success/error inline.
 */

'use strict';

// ---------------------------------------------------------------------------
// Clock
// ---------------------------------------------------------------------------

function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('current-time');
  const dateEl = document.getElementById('current-date');
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }
}
setInterval(updateClock, 1000);
updateClock();

// ---------------------------------------------------------------------------
// Field list
// ---------------------------------------------------------------------------

const FIELD_IDS = [
  'child_name',
  'daily_limit_ml',
  'day_start_hour',
  'warn_threshold_yellow',
  'warn_threshold_red',
  'report_time_1',
  'report_time_2',
  'wellness_check_1',
  'wellness_check_2',
  'timezone',
];

// ---------------------------------------------------------------------------
// Load settings
// ---------------------------------------------------------------------------

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const settings = await res.json();

    // Populate child name in header
    const nameEl = document.getElementById('child-name');
    if (nameEl && settings.child_name) {
      nameEl.textContent = settings.child_name;
    }

    // Populate each field
    for (const key of FIELD_IDS) {
      const value = settings[key];
      if (value === undefined || value === null) continue;

      const el = document.getElementById(key);
      if (!el) continue;

      if (el.tagName === 'SELECT') {
        el.value = String(value);
      } else if (el.type === 'radio') {
        // handled separately
      } else {
        el.value = String(value);
      }
    }

    // Units radio
    const unitsValue = settings.units || 'ml';
    const radios = document.querySelectorAll('input[name="units"]');
    radios.forEach((r) => { r.checked = r.value === unitsValue; });

  } catch (err) {
    console.error('[settings] Load error:', err);
    showStatus('❌ Failed to load settings: ' + err.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// Save settings
// ---------------------------------------------------------------------------

async function saveSettings() {
  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Saving…';
  showStatus('', '');

  const payload = {};
  for (const key of FIELD_IDS) {
    const el = document.getElementById(key);
    if (el) {
      payload[key] = el.value.trim();
    }
  }

  // Units radio
  const selectedUnit = document.querySelector('input[name="units"]:checked');
  if (selectedUnit) {
    payload.units = selectedUnit.value;
  }

  // Basic validation
  const limit = parseInt(payload.daily_limit_ml, 10);
  if (isNaN(limit) || limit < 100 || limit > 5000) {
    showStatus('❌ Daily limit must be between 100 and 5000 ml', 'error');
    btn.disabled = false;
    btn.textContent = '💾 Save Settings';
    return;
  }

  const yellow = parseInt(payload.warn_threshold_yellow, 10);
  const red = parseInt(payload.warn_threshold_red, 10);
  if (isNaN(yellow) || yellow < 10 || yellow > 100 || isNaN(red) || red < 10 || red > 100) {
    showStatus('❌ Warning thresholds must be between 10% and 100%', 'error');
    btn.disabled = false;
    btn.textContent = '💾 Save Settings';
    return;
  }

  if (yellow >= red) {
    showStatus('❌ Yellow threshold must be less than red threshold', 'error');
    btn.disabled = false;
    btn.textContent = '💾 Save Settings';
    return;
  }

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    showStatus('✅ Saved!', 'success');

    // Update child name in header
    const nameEl = document.getElementById('child-name');
    if (nameEl && data.child_name) {
      nameEl.textContent = data.child_name;
    }

  } catch (err) {
    console.error('[settings] Save error:', err);
    showStatus('❌ Error saving: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Save Settings';
  }
}

// ---------------------------------------------------------------------------
// Status display
// ---------------------------------------------------------------------------

function showStatus(message, type) {
  const el = document.getElementById('settings-status');
  if (!el) return;
  el.textContent = message;
  el.className = 'settings-status ' + (type || '');

  // Auto-clear success after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      if (el.textContent === message) {
        el.textContent = '';
        el.className = 'settings-status';
      }
    }, 3000);
  }
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

loadSettings();

document.getElementById('save-btn').addEventListener('click', saveSettings);
