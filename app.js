// app.js — Task list UI logic
// Tasks are loaded from the real API

/** @type {Array<any>} */
let taken = [];

/** Currently active filter: 'alle' | 'wacht_op_akkoord' | 'bezig' | 'klaar' | 'mislukt' */
let activeFilter = 'alle';

/** Current search text (matched case-insensitively against the title) */
let zoekTekst = '';

const STATUS_LABELS = {
  nieuw: 'Nieuw',
  gepland: 'Gepland',
  bezig: 'Bezig',
  wacht_op_akkoord: 'Wacht op akkoord',
  klaar: 'Klaar',
  mislukt: 'Mislukt',
  geannuleerd: 'Geannuleerd'
};

const GESLOTEN_LK = 'verborgen-taken';

/**
 * Get IDs of hidden tasks from localStorage.
 * @returns {string[]}
 */
function verborgenIds() {
  try {
    return JSON.parse(localStorage.getItem(GESLOTEN_LK) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Add a task ID to the hidden set and persist.
 * @param {string|number} id
 */
function voegToeAanVerborgen(id) {
  const ids = verborgenIds();
  ids.push(String(id));
  localStorage.setItem(GESLOTEN_LK, JSON.stringify(ids));
}

/**
 * Toggle hidden state for a task ID.
 * @param {string|number} id
 * @returns {boolean} true if now hidden
 */
function toggleVerborgen(id) {
  const ids = verborgenIds();
  const idx = ids.indexOf(String(id));
  if (idx === -1) {
    ids.push(String(id));
    localStorage.setItem(GESLOTEN_LK, JSON.stringify(ids));
    return true;
  }
  ids.splice(idx, 1);
  localStorage.setItem(GESLOTEN_LK, JSON.stringify(ids));
  return false;
}


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
 * Select the tasks to show: status filter and title search must both match.
 * @param {Array<any>} lijst
 * @param {string} filter
 * @param {string} zoek
 * @param {string[]} verborgen IDs of archived tasks
 * @returns {Array<any>}
 */
function filterTaken(lijst, filter, zoek, verborgen) {
  const naald = zoek.trim().toLowerCase();
  return lijst.filter(t => {
    if (verborgen.indexOf(String(t.id)) !== -1) return false;
    if (naald && !String(t.titel ?? '').toLowerCase().includes(naald)) return false;
    if (filter === 'alle') return true;
    if (filter === 'bezig') return ['nieuw', 'gepland', 'bezig'].includes(t.status);
    if (filter === 'mislukt') return ['mislukt', 'geannuleerd'].includes(t.status);
    return t.status === filter;
  });
}

/**
 * Re-render the visible task list based on the active filter.
 */
function renderLijst() {
  const lijst = document.getElementById('taak-lijst');
  const nietVerborgen = filterTaken(taken, activeFilter, zoekTekst, verborgenIds());

  if (nietVerborgen.length === 0) {
    lijst.textContent = '';
    const li = document.createElement('li');
    li.className = 'status-msg';
    li.textContent = 'Geen taken gevonden';
    lijst.appendChild(li);
    return;
  }

  lijst.textContent = '';
  for (const taak of nietVerborgen) {
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
/**
 * Toggle a task's three-dot menu. Only one menu can be open at a time.
 * @param {HTMLElement} menuEl
 */
function toggleMenu(menuEl) {
  const dropdown = menuEl.querySelector('.taak-dropdown');
  const isOpen = dropdown.classList && dropdown.classList.contains('open');

  // Close all open menus first
  document.querySelectorAll('.taak-dropdown.open').forEach(d => {
    d.classList.remove('open');
  });

  if (!isOpen) {
    dropdown.classList.add('open');
  }
}

/**
 * Close all open menus.
 */
function closeAllMenus() {
  document.querySelectorAll('.taak-dropdown.open').forEach(d => {
    d.classList.remove('open');
  });
}

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

  const acties = document.createElement('div');
  acties.className = 'taak-acties';

  if (taak.akkoord) {

    const btnAkkoord = document.createElement('button');
    btnAkkoord.className = 'btn btn-akkoord';
    btnAkkoord.type = 'button';
    btnAkkoord.textContent = '\u2713 Akkoord';
    btnAkkoord.setAttribute('aria-label', `Akkoord geven aan: ${taak.titel}`);
    btnAkkoord.addEventListener('click', () => stuurAkkoord(taak.akkoord.id, 'akkoord', btnAkkoord, btnAfwijs));

    const btnAfwijs = document.createElement('button');
    btnAfwijs.className = 'btn btn-afwijs';
    btnAfwijs.type = 'button';
    btnAfwijs.textContent = '\u2755 Afwijzen';
    btnAfwijs.setAttribute('aria-label', `Afwijzen: ${taak.titel}`);
    btnAfwijs.addEventListener('click', () => {
      if (window.confirm('Weet je zeker dat je deze taak wilt afwijzen?')) {
        stuurAkkoord(taak.akkoord.id, 'afwijzen', btnAkkoord, btnAfwijs);
      }
    });

    acties.appendChild(btnAkkoord);
    acties.appendChild(btnAfwijs);
  }

  // Archive button for klaar / mislukt tasks
  if (['klaar', 'mislukt'].includes(taak.status)) {
    const btnArchive = document.createElement('button');
    btnArchive.className = 'btn icoon-knop';
    btnArchive.type = 'button';
    btnArchive.title = 'Archiveer';
    btnArchive.setAttribute('aria-label', 'Archiveer: ' + taak.titel);

    // Inline SVG: archive (folder with check)
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="M1 4.5A1.5 1.5 0 0 1 2.5 3h3.172a1.5 1.5 0 0 1 1.06.44l.824.82a1.5 1.5 0 0 0 1.06.44h3.474A1.5 1.5 0 0 1 12.5 6.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 1 12.5v-8z"/><path d="m4 9 2 2 4-4"/>';
    btnArchive.appendChild(svg);

    btnArchive.addEventListener('click', () => {
      voegToeAanVerborgen(taak.id);
      renderLijst();
    });

    acties.appendChild(btnArchive);
  }

  // Three-dot menu button (always present)
  const menuWrapper = document.createElement('div');
  menuWrapper.className = 'taak-menu';

  const menuBtn = document.createElement('button');
  menuBtn.className = 'icoon-knop taak-menu-btn';
  menuBtn.type = 'button';
  menuBtn.textContent = '\u22EE';
  menuBtn.setAttribute('aria-label', 'Meer opties');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu(menuWrapper);
  });

  const dropdown = document.createElement('ul');
  dropdown.className = 'taak-dropdown';

  for (const label of ['Optie 1', 'Optie 2', 'Optie 3']) {
    const optLi = document.createElement('li');
    optLi.textContent = label;
    dropdown.appendChild(optLi);
  }

  menuWrapper.appendChild(menuBtn);
  menuWrapper.appendChild(dropdown);
  acties.appendChild(menuWrapper);

  li.appendChild(acties);

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

  // Wire up search field
  document.getElementById('taak-zoek')?.addEventListener('input', (e) => {
    zoekTekst = e.target.value;
    renderLijst();
  });

  // Wire up refresh button
  document.getElementById('btn-vernieuwen')?.addEventListener('click', laadTaken);

  laadTaken();

  // Close menus when clicking outside
  document.addEventListener('click', closeAllMenus);

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
