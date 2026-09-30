// app.js — Task list UI logic
// Tasks are loaded from the real API

/** @type {Array<any>} */
let taken = [];

/** Currently active filter: 'alle' | 'wacht_op_akkoord' | 'bezig' | 'klaar' | 'mislukt' */
let activeFilter = 'alle';

const STATUS_LABELS = {
  nieuw: 'Nieuw',
  gepland: 'Gepland',
  bezig: 'Bezig',
  wacht_op_akkoord: 'Wacht op akkoord',
  klaar: 'Klaar',
  mislukt: 'Mislukt',
  geannuleerd: 'Geannuleerd'
};

/**
 * Fetch tasks from /api/taken and initialise the list.
 */
async function laadTaken() {
  const lijst = document.getElementById('taak-lijst');
  // Only show loading if empty, otherwise let it update seamlessly
  if (taken.length === 0) {
    lijst.textContent = '';
    const msg = document.createElement('li');
    msg.className = 'status-msg';
    msg.textContent = 'Laden…';
    lijst.appendChild(msg);
  }

  try {
    const response = await fetch('/api/taken');
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Dit apparaat is niet bekend bij de hub.');
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    taken = data.taken;
    
    document.getElementById('app-titel').textContent = `Taken van ${data.eigenaar}`;
    renderLijst();
    updateWachtAkkoordTeller();
  } catch (err) {
    console.error('Fout bij laden taken:', err);
    lijst.textContent = '';
    const li = document.createElement('li');
    li.className = 'status-msg error';
    li.textContent = err.message;
    lijst.appendChild(li);
  }
}

/**
 * Werk de teller bij voor het aantal taken dat op akkoord wacht.
 */
function updateWachtAkkoordTeller() {
  const tellerEl = document.getElementById('wacht-akkoord-teller');
  if (!tellerEl) return;

  const aantal = taken.filter(t => t.status === 'wacht_op_akkoord').length;
  if (aantal > 0) {
    tellerEl.textContent = `wacht op jouw akkoord: ${aantal}`;
    tellerEl.style.display = 'block';
  } else {
    tellerEl.style.display = 'none';
  }
}

/**
 * Re-render the visible task list based on the active filter.
 */
function renderLijst() {
  const lijst = document.getElementById('taak-lijst');
  const zichtbaar = activeFilter === 'alle'
    ? taken
    : taken.filter(t => {
      if (activeFilter === 'bezig') return ['nieuw', 'gepland', 'bezig'].includes(t.status);
      if (activeFilter === 'mislukt') return ['mislukt', 'geannuleerd'].includes(t.status);
      return t.status === activeFilter;
    });

  if (zichtbaar.length === 0) {
    lijst.textContent = '';
    const li = document.createElement('li');
    li.className = 'status-msg';
    li.textContent = 'Geen taken in deze categorie.';
    lijst.appendChild(li);
    return;
  }

  lijst.textContent = '';
  for (const taak of zichtbaar) {
    lijst.appendChild(maakKaart(taak));
  }
}

/**
 * Format a date string for display.
 * Returns the formatted date string, or the original value if invalid.
 * @param {string} waarde
 * @returns {string}
 */
function formatDatum(waarde) {
  const datum = new Date(waarde);
  return isNaN(datum.getTime()) ? waarde : datum.toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });
}


/**
 * Build a task card element for the given task.
 * @param {any} taak
 * @returns {HTMLLIElement}
 */
function maakKaart(taak) {
  const li = document.createElement('li');
  li.className = 'taak-kaart';
  li.dataset.id = taak.id;
  li.dataset.status = taak.status;

  const badge = document.createElement('span');
  badge.className = `status-badge ${taak.status}`;
  badge.textContent = STATUS_LABELS[taak.status] ?? taak.status;

  const titel = document.createElement('p');
  titel.className = 'taak-titel';
  titel.textContent = taak.titel;

  const meta = document.createElement('div');
  meta.className = 'taak-meta';
  
  const datumTekst = formatDatum(taak.bijgewerkt);
  
  let metaText = `Agent: ${taak.agent} • Bijgewerkt: ${datumTekst}`;
  if (taak.repo) {
    metaText += ` • Repo: ${taak.repo}`;
  }
  meta.textContent = metaText;

  li.appendChild(badge);
  li.appendChild(titel);
  li.appendChild(meta);

  if (taak.akkoord) {
    const acties = document.createElement('div');
    acties.className = 'taak-acties';

    const btnAkkoord = document.createElement('button');
    btnAkkoord.className = 'btn btn-akkoord';
    btnAkkoord.type = 'button';
    btnAkkoord.textContent = '✓ Akkoord';
    btnAkkoord.setAttribute('aria-label', `Akkoord geven aan: ${taak.titel}`);
    btnAkkoord.addEventListener('click', () => stuurAkkoord(taak.akkoord.id, 'akkoord', btnAkkoord, btnAfwijs));

    const btnAfwijs = document.createElement('button');
    btnAfwijs.className = 'btn btn-afwijs';
    btnAfwijs.type = 'button';
    btnAfwijs.textContent = '✕ Afwijzen';
    btnAfwijs.setAttribute('aria-label', `Afwijzen: ${taak.titel}`);
    btnAfwijs.addEventListener('click', () => {
      if (window.confirm('Weet je zeker dat je deze taak wilt afwijzen?')) {
        stuurAkkoord(taak.akkoord.id, 'afwijzen', btnAkkoord, btnAfwijs);
      }
    });

    acties.appendChild(btnAkkoord);
    acties.appendChild(btnAfwijs);
    li.appendChild(acties);
  }

  return li;
}

/**
 * Send decision to the hub
 * @param {number} akkoordId 
 * @param {string} besluit 
 * @param {HTMLButtonElement} btn1 
 * @param {HTMLButtonElement} btn2 
 */
async function stuurAkkoord(akkoordId, besluit, btn1, btn2) {
  btn1.disabled = true;
  btn2.disabled = true;
  try {
    const response = await fetch(`/api/akkoorden/${akkoordId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub': 'web'
      },
      body: JSON.stringify({ besluit })
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.fout || `HTTP fout ${response.status}`);
    }
    
    // Succes, lijst herladen
    await laadTaken();
  } catch (err) {
    alert(`Actie mislukt: ${err.message}`);
    btn1.disabled = false;
    btn2.disabled = false;
  }
}

/**
 * Set the active filter and re-render.
 * @param {string} filter
 */
function setFilter(filter) {
  activeFilter = filter;

  // Update button active state
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderLijst();
}

// === Initialise ===

document.addEventListener('DOMContentLoaded', () => {
  // Wire up filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  // Wire up refresh button
  document.getElementById('btn-vernieuwen')?.addEventListener('click', laadTaken);

  laadTaken();

  // Auto-refresh every 30 seconds if page is visible
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      laadTaken();
    }
  }, 30000);
});

// === Service Worker registration ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('Service Worker registratie mislukt:', err);
    });
  });
}
