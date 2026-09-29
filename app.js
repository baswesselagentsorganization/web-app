// app.js — Task list UI logic
// Tasks are loaded from taken.json; all state changes are local (no backend).

/** @type {Array<{id: number, titel: string, status: string}>} */
let taken = [];

/** Currently active filter: 'alle' | 'wacht_op_akkoord' | 'akkoord' | 'afgewezen' */
let activeFilter = 'alle';

const STATUS_LABELS = {
  wacht_op_akkoord: 'Wacht op akkoord',
  akkoord: 'Akkoord',
  afgewezen: 'Afgewezen',
};

/**
 * Fetch tasks from taken.json and initialise the list.
 */
async function laadTaken() {
  const lijst = document.getElementById('taak-lijst');
  lijst.innerHTML = '<li class="status-msg">Laden…</li>';

  try {
    const response = await fetch('taken.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    taken = await response.json();
    renderLijst();
  } catch (err) {
    console.error('Fout bij laden taken:', err);
    lijst.innerHTML = `<li class="status-msg error">Taken konden niet worden geladen (${err.message}).</li>`;
  }
}

/**
 * Re-render the visible task list based on the active filter.
 */
function renderLijst() {
  const lijst = document.getElementById('taak-lijst');
  const zichtbaar = activeFilter === 'alle'
    ? taken
    : taken.filter(t => t.status === activeFilter);

  if (zichtbaar.length === 0) {
    lijst.innerHTML = '<li class="status-msg">Geen taken in deze categorie.</li>';
    return;
  }

  lijst.innerHTML = '';
  for (const taak of zichtbaar) {
    lijst.appendChild(maakKaart(taak));
  }
}

/**
 * Build a task card element for the given task.
 * @param {{id: number, titel: string, status: string}} taak
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

  li.appendChild(badge);
  li.appendChild(titel);

  if (taak.status === 'wacht_op_akkoord') {
    const acties = document.createElement('div');
    acties.className = 'taak-acties';

    const btnAkkoord = document.createElement('button');
    btnAkkoord.className = 'btn btn-akkoord';
    btnAkkoord.type = 'button';
    btnAkkoord.innerHTML = '✓ Akkoord';
    btnAkkoord.setAttribute('aria-label', `Akkoord geven aan: ${taak.titel}`);
    btnAkkoord.addEventListener('click', () => zetStatus(taak.id, 'akkoord'));

    const btnAfwijs = document.createElement('button');
    btnAfwijs.className = 'btn btn-afwijs';
    btnAfwijs.type = 'button';
    btnAfwijs.innerHTML = '✕ Afwijzen';
    btnAfwijs.setAttribute('aria-label', `Afwijzen: ${taak.titel}`);
    btnAfwijs.addEventListener('click', () => zetStatus(taak.id, 'afgewezen'));

    acties.appendChild(btnAkkoord);
    acties.appendChild(btnAfwijs);
    li.appendChild(acties);
  }

  return li;
}

/**
 * Update the status of a task in-memory and re-render the list.
 * @param {number} id
 * @param {string} nieuweStatus
 */
function zetStatus(id, nieuweStatus) {
  const taak = taken.find(t => t.id === id);
  if (!taak) return;
  taak.status = nieuweStatus;
  renderLijst();
}

/**
 * Set the active filter and re-render.
 * @param {string} filter
 */
function setFilter(filter) {
  activeFilter = filter;

  // Update button active state
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  renderLijst();
}

// === Initialise ===

document.addEventListener('DOMContentLoaded', () => {
  // Wire up filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  laadTaken();
});

// === Service Worker registration ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.warn('Service Worker registratie mislukt:', err);
    });
  });
}
