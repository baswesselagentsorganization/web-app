// app.js — Task list UI logic
// Tasks are loaded from the real API

/** @type {Array<any>} */
let taken = [];

/** Currently active filter: 'alle' | 'wacht_op_akkoord' | 'bezig' | 'klaar' | 'mislukt' */
let activeFilter = 'alle';

/** Current search text (matched case-insensitively against the title) */
let zoekTekst = '';

/** Owner filter: 'alle' | 'eigen' */
let eigenaarFilter = 'alle';

/** Number of open approvals for the viewer, from the API (null if the API does not send it) */
let openAkkoorden = null;

/** Whether archived tasks are shown in the list (default: hidden) */
let toonGearchiveerd = false;

/** Task IDs whose approval details are expanded. */
const openAkkoordDetails = new Set();
/** Task IDs whose failure/cancellation details are expanded. */
const openTaakDetails = new Set();

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

const AFGEROND = ['klaar', 'mislukt', 'geannuleerd'];

// === Toasts ===

const TOAST_DUUR_MS = 4000;
const TOAST_MAX = 3;

/**
 * Show a short outcome message in the aria-live toast container.
 * @param {string} tekst
 * @param {'ok' | 'fout'} [soort]
 * @returns {any} the toast element, or null if there is no container
 */
function toonToast(tekst, soort = 'ok') {
  const houder = document.getElementById('toasts');
  if (!houder) return null;
  const toast = document.createElement('div');
  toast.className = `toast toast-${soort}`;
  // Errors interrupt the screen reader; other outcomes wait for a pause
  toast.setAttribute('role', soort === 'fout' ? 'alert' : 'status');
  toast.textContent = tekst;
  houder.appendChild(toast);
  while (houder.children && houder.children.length > TOAST_MAX) {
    houder.removeChild(houder.children[0]);
  }
  if (typeof setTimeout === 'function') {
    setTimeout(() => {
      if (houder.removeChild && houder.children && houder.children.includes(toast)) houder.removeChild(toast);
    }, TOAST_DUUR_MS);
  }
  return toast;
}

// === Reject sheet ===

/** Resolver of the open reject sheet (null when closed) */
let afwijsResolve = null;
let afwijsGebonden = false;
let afwijsTerugFocus = null;

/** Close the sheet and settle the promise: reason string on confirm, null on cancel. */
function sluitAfwijsSheet(reden) {
  const sheet = document.getElementById('afwijs-sheet');
  if (sheet) sheet.hidden = true;
  const resolve = afwijsResolve;
  afwijsResolve = null;
  if (afwijsTerugFocus && typeof afwijsTerugFocus.focus === 'function') afwijsTerugFocus.focus();
  afwijsTerugFocus = null;
  if (resolve) resolve(reden);
}

function bindAfwijsSheet() {
  if (afwijsGebonden) return;
  afwijsGebonden = true;
  document.getElementById('afwijs-annuleer')?.addEventListener('click', () => sluitAfwijsSheet(null));
  document.getElementById('afwijs-backdrop')?.addEventListener('click', () => sluitAfwijsSheet(null));
  document.getElementById('afwijs-bevestig')?.addEventListener('click', () => {
    const veld = document.getElementById('afwijs-reden');
    sluitAfwijsSheet(veld ? String(veld.value ?? '').trim() : '');
  });
  document.getElementById('afwijs-sheet')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      sluitAfwijsSheet(null);
    }
  });
}

/**
 * Open the reject bottom sheet for a task.
 * @param {any} taak
 * @returns {Promise<string | null>} the (possibly empty) reason, or null if cancelled
 */
function vraagAfwijsReden(taak) {
  const sheet = document.getElementById('afwijs-sheet');
  if (!sheet) return Promise.resolve(null);
  bindAfwijsSheet();
  if (afwijsResolve) sluitAfwijsSheet(null);
  afwijsTerugFocus = document.activeElement || null;
  const taakEl = document.getElementById('afwijs-taak');
  if (taakEl) taakEl.textContent = taak.titel ?? '';
  const veld = document.getElementById('afwijs-reden');
  if (veld) veld.value = '';
  sheet.hidden = false;
  if (veld && typeof veld.focus === 'function') veld.focus();
  return new Promise(resolve => { afwijsResolve = resolve; });
}

/**
 * Get IDs of archived tasks (as sent by the API).
 * @returns {string[]}
 */
function gearchiveerdeIds() {
  return taken.filter(t => t.gearchiveerd === true).map(t => String(t.id));
}

/**
 * Archive or restore a task on the server. The list is only updated after a 200 response.
 * @param {any} taak
 * @param {boolean} gearchiveerd
 */
async function zetGearchiveerd(taak, gearchiveerd) {
  try {
    const response = await fetch(`/api/taken/${taak.id}/archief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub': 'web'
      },
      body: JSON.stringify({ gearchiveerd })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.fout || `HTTP fout ${response.status}`);
    }
    taak.gearchiveerd = gearchiveerd;
    renderLijst();
    toonToast(gearchiveerd ? 'Taak gearchiveerd' : 'Taak teruggezet');
  } catch (err) {
    toonToast(`Archiveren mislukt: ${err.message}`, 'fout');
  }
}

/**
 * One-time move of the old localStorage archive list to the server.
 * @returns {Promise<boolean>} true if the key was removed and the list should be reloaded
 */
async function migreerVerborgen() {
  try {
    const raw = localStorage.getItem(GESLOTEN_LK);
    if (raw === null || raw === undefined) return false;
    let ids = [];
    try { ids = JSON.parse(raw); } catch { /* corrupt value: just drop it */ }
    if (Array.isArray(ids)) {
      for (const id of ids.map(String)) {
        const taak = taken.find(t => String(t.id) === id);
        if (!taak || taak.gearchiveerd === true || !AFGEROND.includes(taak.status)) continue;
        await fetch(`/api/taken/${taak.id}/archief`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub': 'web'
          },
          body: JSON.stringify({ gearchiveerd: true })
        });
      }
    }
    localStorage.removeItem(GESLOTEN_LK);
    return true;
  } catch (err) {
    console.error('Overzetten van verborgen taken mislukt:', err);
    return false;
  }
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
    // Backward compatibility: if the API does not send "kleuren", treat every task as own
    const eigenaarKleuren = data.kleuren || {};
    if (!data.kleuren) {
      for (const t of taken) { t.eigen = true; }
    }
    
    openAkkoorden = typeof data.open_akkoorden === 'number' ? data.open_akkoorden : null;

    document.getElementById('app-titel').textContent = `Taken van ${data.eigenaar}`;
    renderLijst();
    updateWachtAkkoordTeller();
    if (await migreerVerborgen()) await laadTaken();
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

  const aantal = openAkkoorden ?? taken.filter(t => t.status === 'wacht_op_akkoord' && t.eigen !== false).length;
  if (aantal > 0) {
    tellerEl.textContent = `wacht op akkoord: ${aantal}`;
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
 * @param {string} [eigenaarFilter] 'alle' | 'eigen'
 * @param {boolean} [toonGearchiveerd] show archived tasks too (default: false)
 * @returns {Array<any>}
 */
function filterTaken(lijst, filter, zoek, verborgen, eigenaarFilter, toonGearchiveerd) {
  const naald = zoek.trim().toLowerCase();
  return lijst.filter(t => {
    if (!toonGearchiveerd && verborgen.indexOf(String(t.id)) !== -1) return false;
    if (naald && !String(t.titel ?? '').toLowerCase().includes(naald)) return false;
    if (eigenaarFilter === 'eigen' && t.eigen === false) return false;
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
  const nietVerborgen = filterTaken(taken, activeFilter, zoekTekst, gearchiveerdeIds(), eigenaarFilter, toonGearchiveerd);

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
 * Format a timestamp as relative time ("5 min geleden"). Falls back to the full
 * date for invalid, future or older-than-a-week values.
 * @param {string} waarde
 * @param {Date|string|number} [nu]
 * @returns {string}
 */
function formatRelatief(waarde, nu = new Date()) {
  const tijd = new Date(waarde).getTime();
  const current = new Date(nu).getTime();
  if (!Number.isFinite(tijd) || !Number.isFinite(current) || tijd > current + 60000) return formatDatum(waarde);
  const minuten = Math.floor(Math.max(0, current - tijd) / 60000);
  if (minuten < 1) return 'zojuist';
  if (minuten < 60) return `${minuten} min geleden`;
  const uren = Math.floor(minuten / 60);
  if (uren < 24) return `${uren} u geleden`;
  const dagen = Math.floor(uren / 24);
  if (dagen < 7) return `${dagen} d geleden`;
  return formatDatum(waarde);
}

/** Update relative time labels in place. */
function verversRelatieveTijden(nu = new Date()) {
  document.querySelectorAll('.taak-tijd').forEach(el => {
    el.textContent = formatRelatief(el.dataset.tijd, nu);
  });
}

/** Format elapsed time since a task started. @param {string} startIso @param {Date|string|number} [nu] @returns {string} */
function formatLooptijd(startIso, nu = new Date()) {
  if (!startIso) return '';
  const start = new Date(startIso).getTime();
  const current = new Date(nu).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(current)) return '';
  const minuten = Math.floor(Math.max(0, current - start) / 60000);
  if (minuten < 1) return '<1 min';
  if (minuten < 60) return `${minuten} min`;
  const uren = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest === 0 ? `${uren} u` : `${uren} u ${rest} min`;
}

/** Update existing duration labels without rebuilding cards or touching menus. */
function verversLooptijden(nu = new Date()) {
  document.querySelectorAll('.taak-looptijd').forEach(el => {
    el.textContent = `Bezig: ${formatLooptijd(el.dataset.start, nu)}`;
  });
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
function openMenu(menuEl) {
  const dropdown = menuEl.querySelector('.taak-dropdown');

  // Close all open menus first
  closeAllMenus();

  // Always show the dropdown
  dropdown.style.display = 'block';

  // Try to position it; if measurements fail (e.g. SSR/hidden), fall back to CSS defaults
  if (typeof dropdown.getBoundingClientRect === 'function') {
    try {
      const rect = menuEl.getBoundingClientRect();
      // Use the smaller of innerHeight and clientHeight for robust viewport height
      const vh = Math.min(window.innerHeight, document.documentElement.clientHeight);
      const vw = window.innerWidth || document.documentElement.clientWidth;
      const ddRect = dropdown.getBoundingClientRect();

      // Only position if we got real measurements (non-zero)
      if (rect.width > 0 && rect.height > 0 && ddRect.width > 0) {
        // Position to the right of the button
        let left = rect.right + 4;
        let top = rect.top;

        // If the dropdown would overflow right, show to the left
        if (left + ddRect.width > vw) {
          left = rect.left - ddRect.width - 4;
        }

        // If the dropdown would overflow bottom, show above the button
        if (top + ddRect.height > vh) {
          top = rect.bottom - ddRect.height - 4;
        }

        dropdown.style.left = left + 'px';
        dropdown.style.top = top + 'px';

        // Clamp to viewport after positioning
        const finalRect = dropdown.getBoundingClientRect();
        if (finalRect.bottom > vh) {
          dropdown.style.top = Math.max(0, vh - ddRect.height) + 'px';
        }
        if (finalRect.left < 0) {
          dropdown.style.left = '4px';
        }
      }
    } catch (_) {
      // Measurement failed; keep CSS default positioning
    }
  }

  dropdown.classList.add('open');
  const menuBtn = menuEl.querySelector('.taak-menu-btn');
  menuBtn.setAttribute('aria-expanded', 'true');
}

function closeMenu(dropdown) {
  dropdown.classList.remove('open');
  dropdown.style.display = '';
  dropdown.style.top = '';
  dropdown.style.right = '';
  dropdown.style.bottom = '';
  dropdown.style.left = '';
  const menuBtn = dropdown._menuButton;
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
}

function toggleMenu(menuEl) {
  const dropdown = menuEl.querySelector('.taak-dropdown');
  if (!dropdown) return;
  const isOpen = dropdown.classList && dropdown.classList.contains('open');

  if (isOpen) {
    closeMenu(dropdown);
  } else {
    openMenu(menuEl);
  }
}

/**
 * Close all open menus.
 */
function closeAllMenus() {
  document.querySelectorAll('.taak-dropdown.open').forEach(d => {
    closeMenu(d);
  });
}

function maakKaart(taak) {
  const li = document.createElement('li');
  li.className = 'taak-kaart';
  li.dataset.id = taak.id;
  li.dataset.status = taak.status;

  // Colored left border based on owner color
  const kleur = taak.kleur ?? '';
  if (/^#[0-9a-fA-F]{6}$/.test(kleur)) {
    li.style.setProperty("--eigenaar-kleur", kleur);
  } else {
    li.style.setProperty("--eigenaar-kleur", "#6b7280");
  }

  const badge = document.createElement('span');
  badge.className = `status-badge ${taak.status}`;
  badge.textContent = STATUS_LABELS[taak.status] ?? taak.status;

  const titel = document.createElement('p');
  titel.className = 'taak-titel';
  titel.textContent = taak.titel;

  const meta = document.createElement('div');
  meta.className = 'taak-meta';
  
  meta.textContent = `Agent: ${taak.agent} • Bijgewerkt: `;
  const tijd = document.createElement('span');
  tijd.className = 'taak-tijd';
  tijd.dataset.tijd = taak.bijgewerkt;
  tijd.title = formatDatum(taak.bijgewerkt);
  tijd.textContent = formatRelatief(taak.bijgewerkt);
  meta.appendChild(tijd);
  if (taak.repo) {
    const repo = document.createElement('span');
    repo.textContent = ` • Repo: ${taak.repo}`;
    meta.appendChild(repo);
  }

  if (taak.status === 'bezig' && taak.bezig_sinds) {
    const looptijd = document.createElement('span');
    looptijd.className = 'taak-looptijd';
    looptijd.dataset.start = taak.bezig_sinds;
    looptijd.textContent = `Bezig: ${formatLooptijd(taak.bezig_sinds)}`;
    meta.appendChild(looptijd);
  }

  li.appendChild(badge);
  li.appendChild(titel);
  if (taak.herstart_van != null || taak.plan != null) {
    const extra = document.createElement('small');
    extra.className = 'taak-submeta';
    const regels = [];
    if (taak.herstart_van != null) regels.push(`opnieuw gestart uit taak ${taak.herstart_van}`);
    if (taak.plan != null) regels.push(`plan: ${taak.plan}`);
    extra.textContent = regels.join(' • ');
    li.appendChild(extra);
  }
  li.appendChild(meta);

  // "van [eigenaar]" label for non-owner tasks
  if (taak.eigen !== true && taak.eigenaar) {
    const label = document.createElement('span');
    label.className = 'eigenaar-label';
    label.textContent = `van ${taak.eigenaar}`;
    const labelKleur = (taak.kleur && /^#[0-9a-fA-F]{6}$/.test(taak.kleur)) ? taak.kleur : '#6b7280';
    label.style.color = labelKleur;
    li.appendChild(label);
  }

  const acties = document.createElement('div');
  acties.className = 'taak-acties';
  let akkoordDetailsElement = null;
  let taakDetailsElement = null;

  if (typeof taak.details === 'string' && taak.details.length > 0) {
    const taakId = String(taak.id);
    const detailsId = `taak-mislukt-details-${taakId}`;
    const btnDetails = document.createElement('button');
    btnDetails.className = 'btn btn-details';
    btnDetails.type = 'button';
    btnDetails.textContent = 'Details';
    btnDetails.setAttribute('aria-controls', detailsId);
    const details = document.createElement('div');
    details.className = 'taak-details';
    details.id = detailsId;
    details.textContent = taak.details;
    details.hidden = !openTaakDetails.has(taakId);
    btnDetails.setAttribute('aria-expanded', String(!details.hidden));
    btnDetails.addEventListener('click', () => {
      details.hidden = !details.hidden;
      btnDetails.setAttribute('aria-expanded', String(!details.hidden));
      if (details.hidden) openTaakDetails.delete(taakId);
      else openTaakDetails.add(taakId);
    });
    acties.appendChild(btnDetails);
    taakDetailsElement = details;
  }

  if (taak.akkoord) {

    const akk = taak.akkoord;
    const vragen = typeof akk.vragen === 'number' ? akk.vragen : 0;
    const ja = akk.ja;
    const risico = akk.risico;

    // Show akkoord-zin line if ja and risico are present
    if (ja !== undefined && ja !== null && risico !== undefined && risico !== null) {
      const zinEl = document.createElement('div');
      zinEl.className = 'akkoord-zin';
      zinEl.textContent = `Ja = ${ja}; risico: ${risico}.`;
      acties.appendChild(zinEl);
    }

    const btnAkkoord = document.createElement('button');
    btnAkkoord.className = 'btn btn-akkoord';
    btnAkkoord.type = 'button';
    const akkoordLabel = vragen > 1 ? `✓ Akkoord (${vragen} vragen)` : '✓ Akkoord';
    btnAkkoord.textContent = akkoordLabel;
    btnAkkoord.setAttribute('aria-label', `Akkoord geven aan: ${taak.titel}`);

    const btnAfwijs = document.createElement('button');
    btnAfwijs.className = 'btn btn-afwijs';
    btnAfwijs.type = 'button';
    const afwijsLabel = vragen > 1 ? `❕ Afwijzen (${vragen} vragen)` : '❕ Afwijzen';
    btnAfwijs.textContent = afwijsLabel;
    btnAfwijs.setAttribute('aria-label', `Afwijzen: ${taak.titel}`);

    async function stuurBesluit(besluit, reden = '') {
      btnAkkoord.disabled = true;
      btnAfwijs.disabled = true;
      try {
        const url = vragen > 1 ? `/api/kaarten/${taak.id}` : `/api/akkoorden/${akk.id}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Hub': 'web'
          },
          body: JSON.stringify(reden ? { besluit, reden } : { besluit })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.fout || `HTTP fout ${response.status}`);
        }
        toonToast(besluit === 'akkoord' ? 'Akkoord gegeven' : 'Taak afgewezen');
        await laadTaken();
      } catch (err) {
        toonToast(`Actie mislukt: ${err.message}`, 'fout');
        btnAkkoord.disabled = false;
        btnAfwijs.disabled = false;
      }
    }

    btnAkkoord.addEventListener('click', () => stuurBesluit('akkoord'));
    btnAfwijs.addEventListener('click', async () => {
      const reden = await vraagAfwijsReden(taak);
      if (reden !== null) stuurBesluit('afwijzen', reden);
    });

    acties.appendChild(btnAkkoord);
    acties.appendChild(btnAfwijs);

    const btnDetails = document.createElement('button');
    btnDetails.className = 'btn btn-details';
    btnDetails.type = 'button';
    btnDetails.textContent = 'Details';
    btnDetails.setAttribute('aria-label', `Details: ${taak.titel}`);
    const detailsTekst = akk.details;
    if (typeof detailsTekst === 'string' && detailsTekst.trim().length > 0) {
      const taakId = String(taak.id);
      const detailsId = `taak-details-${taakId}`;
      const details = document.createElement('div');
      details.className = 'taak-details';
      details.id = detailsId;
      details.textContent = detailsTekst;
      details.hidden = !openAkkoordDetails.has(taakId);
      akkoordDetailsElement = details;
      btnDetails.setAttribute('aria-controls', detailsId);
      btnDetails.setAttribute('aria-expanded', String(!details.hidden));
      btnDetails.addEventListener('click', () => {
        details.hidden = !details.hidden;
        btnDetails.setAttribute('aria-expanded', String(!details.hidden));
        if (details.hidden) openAkkoordDetails.delete(taakId);
        else openAkkoordDetails.add(taakId);
      });
      acties.appendChild(btnDetails);
    }
  }

  // Archive button for klaar / mislukt / geannuleerd tasks
  if (AFGEROND.includes(taak.status)) {
    const btnArchive = document.createElement('button');
    btnArchive.className = 'btn icoon-knop';
    btnArchive.type = 'button';
    const isGearchiveerd = taak.gearchiveerd === true;
    const actie = isGearchiveerd ? 'Dearchiveer' : 'Archiveer';
    btnArchive.title = actie;
    btnArchive.setAttribute('aria-label', actie + ': ' + taak.titel);

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
    const folderPath = document.createElementNS(svgNS, 'path');
    folderPath.setAttribute('d', 'M1 4.5A1.5 1.5 0 0 1 2.5 3h3.172a1.5 1.5 0 0 1 1.06.44l.824.82a1.5 1.5 0 0 0 1.06.44h3.474A1.5 1.5 0 0 1 12.5 6.5v6a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 1 12.5v-8z');
    const checkPath = document.createElementNS(svgNS, 'path');
    checkPath.setAttribute('d', 'm4 9 2 2 4-4');
    svg.appendChild(folderPath);
    svg.appendChild(checkPath);
    btnArchive.appendChild(svg);

    btnArchive.addEventListener('click', () => {
      zetGearchiveerd(taak, !isGearchiveerd);
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
  menuBtn.setAttribute('aria-haspopup', 'menu');
  menuBtn.setAttribute('aria-expanded', 'false');
  const dropdownId = `taak-menu-${taak.id}`;
  menuBtn.setAttribute('aria-controls', dropdownId);
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu(menuWrapper);
  });

  // Desktop hover: only on devices with hover capability
  if (window.matchMedia('(hover: hover)').matches) {
    menuBtn.addEventListener('mouseenter', () => openMenu(menuWrapper));
    menuBtn.addEventListener('mouseleave', (e) => {
      const dropdown = menuWrapper.querySelector('.taak-dropdown');
      if (!dropdown.classList.contains('open')) return;
      // Close only if mouse leaves both button and dropdown
      const btnRect = menuBtn.getBoundingClientRect();
      const ddRect = dropdown.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      const inBtn = x >= btnRect.left && x <= btnRect.right && y >= btnRect.top && y <= btnRect.bottom;
      const inDd = x >= ddRect.left && x <= ddRect.right && y >= ddRect.top && y <= ddRect.bottom;
      if (!inBtn && !inDd) closeMenu(dropdown);
    });
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'taak-dropdown';
  dropdown.id = dropdownId;
  dropdown.setAttribute('role', 'menu');
  dropdown._menuButton = menuBtn;

  function maakMenuItem(label, disabled, action) {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.textContent = label;
    if (disabled) {
      item.setAttribute('aria-disabled', 'true');
    }
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (disabled) return;
      action();
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!disabled) item.click();
      }
    });
    return item;
  }

  const actieveStatussen = ['nieuw', 'gepland', 'bezig', 'wacht_op_akkoord'];
  if (actieveStatussen.includes(taak.status)) {
    const annuleerItem = maakMenuItem('Annuleren', false, () => {
      stuurAnnuleren(taak.id);
      closeAllMenus();
    });
    dropdown.appendChild(annuleerItem);
  } else {
    dropdown.appendChild(maakMenuItem('Geen acties', true, () => {}));
  }

  function menuItems() {
    return Array.from(dropdown.children);
  }

  function focusItem(index) {
    const items = menuItems();
    if (items.length) items[(index + items.length) % items.length].focus();
  }

  menuBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && dropdown.classList.contains('open')) {
      closeMenu(dropdown);
    } else if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      e.preventDefault();
      closeMenu(dropdown);
      menuBtn.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!dropdown.classList.contains('open')) openMenu(menuWrapper);
      focusItem(0);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!dropdown.classList.contains('open')) openMenu(menuWrapper);
      focusItem(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!dropdown.classList.contains('open')) openMenu(menuWrapper);
      focusItem(-1);
    }
  });

  dropdown.addEventListener('keydown', (e) => {
    const items = menuItems();
    const current = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(current + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(current - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusItem(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu(dropdown);
      menuBtn.focus();
    } else if (e.key === 'Tab') {
      closeMenu(dropdown);
    }
  });

  menuWrapper.appendChild(menuBtn);
  menuWrapper.appendChild(dropdown);
  acties.appendChild(menuWrapper);

  li.appendChild(acties);
  if (akkoordDetailsElement) li.appendChild(akkoordDetailsElement);
  if (taakDetailsElement) li.appendChild(taakDetailsElement);

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
    toonToast(besluit === 'akkoord' ? 'Akkoord gegeven' : 'Taak afgewezen');
    await laadTaken();
  } catch (err) {
    toonToast(`Actie mislukt: ${err.message}`, 'fout');
    btn1.disabled = false;
    btn2.disabled = false;
  }
}

/**
 * Cancel a task. Prompts confirmation, then POSTs to the API.
 * @param {string | number} taakId
 */
async function stuurAnnuleren(taakId) {
  if (!window.confirm(`Taak ${taakId} annuleren? Een lopende agent stopt en er wordt niets gepusht.`)) return;
  try {
    const response = await fetch(`/api/taken/${taakId}/annuleren`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub': 'web'
      },
      body: '{}'
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.fout || `HTTP fout ${response.status}`);
    }
    toonToast('Taak geannuleerd');
    await laadTaken();
  } catch (err) {
    toonToast(`Annuleren mislukt: ${err.message}`, 'fout');
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

/**
 * Set the owner filter and re-render.
 * @param {string} filter 'alle' | 'eigen'
 */
function setEigenaarFilter(filter) {
  eigenaarFilter = filter;

  // Persist to localStorage
  try {
    localStorage.setItem('taken-eigenaar-filter', filter);
  } catch {
    // localStorage unavailable
  }

  // Update owner filter button active state
  document.querySelectorAll('.eigenaar-filter-btn').forEach(btn => {
    if (btn.dataset.eigenaarfilter === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  updateFiltermenuKnop();
  renderLijst();
}

/**
 * Show or hide archived tasks and update the toggle button text.
 * @param {boolean} toon
 */
function setToonGearchiveerd(toon) {
  toonGearchiveerd = toon;
  const btn = document.getElementById('btn-toon-gearchiveerd');
  if (btn) {
    btn.textContent = toon ? 'Verberg gearchiveerd' : 'Toon gearchiveerd';
    btn.setAttribute('aria-pressed', String(toon));
  }
  updateFiltermenuKnop();
  renderLijst();
}

/** Mark the filter-menu button when a non-default secondary filter is active. */
function updateFiltermenuKnop() {
  const btn = document.getElementById('btn-filtermenu');
  if (!btn) return;
  const actief = eigenaarFilter !== 'alle' || toonGearchiveerd;
  btn.className = actief ? 'btn btn-filtermenu actief' : 'btn btn-filtermenu';
  btn.textContent = actief ? 'Meer filters (actief) ▾' : 'Meer filters ▾';
}

/**
 * Open or close the secondary filter menu.
 * @param {boolean} open
 */
function setFiltermenu(open) {
  const menu = document.getElementById('filter-menu');
  const btn = document.getElementById('btn-filtermenu');
  if (!menu || !btn) return;
  menu.hidden = !open;
  btn.setAttribute('aria-expanded', String(open));
}

/**
 * Detect iframe: add "ingebed" class to <html> when self !== top.
 */
function ingebedClassZetten() {
  if (window.self !== window.top) {
    document.documentElement.classList.add('ingebed');
  }
}

// === Initialise ===

document.addEventListener('DOMContentLoaded', () => {
  // Wire up filter buttons
  ingebedClassZetten();

  // Restore owner filter from localStorage
  try {
    const saved = localStorage.getItem('taken-eigenaar-filter');
    if (saved === 'eigen' || saved === 'alle') {
      eigenaarFilter = saved;
    }
  } catch {
    // localStorage unavailable
  }

  // Wire up owner filter buttons
  document.querySelectorAll('.eigenaar-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setEigenaarFilter(btn.dataset.eigenaarfilter));
  });
  // Set initial active state
  document.querySelectorAll('.eigenaar-filter-btn').forEach(btn => {
    if (btn.dataset.eigenaarfilter === eigenaarFilter) {
      btn.classList.add('active');
    }
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  updateFiltermenuKnop();
  document.getElementById('btn-filtermenu')?.addEventListener('click', () => {
    const menu = document.getElementById('filter-menu');
    setFiltermenu(menu ? menu.hidden : false);
  });

  // Wire up archived toggle
  document.getElementById('btn-toon-gearchiveerd')?.addEventListener('click', () => {
    setToonGearchiveerd(!toonGearchiveerd);
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

  // Also close menus on touchend outside any .taak-menu (handles touch tap on mobile)
  document.addEventListener('touchend', (e) => {
    const menus = document.querySelectorAll('.taak-menu');
    let clickedInside = false;
    for (const menu of menus) {
      if (menu.contains(e.target)) {
        clickedInside = true;
        break;
      }
    }
    if (!clickedInside) {
      closeAllMenus();
    }
  });

  // Also close menus on pointerdown outside any .taak-menu (handles touch tap)
  document.addEventListener('pointerdown', (e) => {
    const menus = document.querySelectorAll('.taak-menu');
    let clickedInside = false;
    for (const menu of menus) {
      if (menu.contains(e.target)) {
        clickedInside = true;
        break;
      }
    }
    if (!clickedInside) {
      closeAllMenus();
    }
  });

  // Auto-refresh every 30 seconds if page is visible
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      laadTaken();

    }
  }, 30000);

  setInterval(() => { verversLooptijden(); verversRelatieveTijden(); }, 60000);
});

// === Service Worker registration ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('Service Worker registratie mislukt:', err);
    });
  });
}
