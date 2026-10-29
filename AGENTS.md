# AGENTS.md — web-app

## Doel
De takenpagina van Agenthub: een PWA (HTML, CSS en JavaScript, zonder framework) om taken van de hub te bekijken, filteren, zoeken, annuleren en goed te keuren of af te wijzen. Er is geen eigen backend; alle gegevens komen van de API van de hub.

## Mappenstructuur
- `index.html`: de enige pagina (taaklijst, filters, zoekveld).
- `app.js`: alle logica (laden van `/api/taken`, filters, zoeken, akkoordkaart, ⋮-menu met Annuleren, archief).
- `style.css`: donker thema, responsive.
- `sw.js`: service worker die de app shell cachet (`takenbeheer-v9`).
- `manifest.json` en `icons/`: PWA-manifest en iconen.
- `test_*.js`: 15 testbestanden (Node.js met de `vm`-module, zonder dependencies).

## Testen
`for f in test_*.js; do node "$f" || exit $?; done` (geen package.json, geen testrunner; elk bestand test zichzelf met `assert`).

## Uitrollen
Na een merge in `main` rolt Agenthub (de hub op agentserver) precies die commit vanzelf uit; er is geen build. De app draait onder `/taken/` in een iframe van de schil van Agenthub en praat met de API van de hub: `/api/taken`, `/api/akkoorden/<id>`, `/api/kaarten/<taak>` en `/api/taken/<id>/annuleren`, altijd met de kop `X-Hub: web`.

## Conventies
- Code en commentaar in het Engels; teksten en knoppen in het Nederlands.
- camelCase voor variabelen en functies, kebab-case voor CSS-klassen; JSDoc-annotaties; `async/await` voor API-aanroepen.
- Geen dependencies, geen bundler, geen framework. Tekst uit de API altijd met `textContent`, nooit met `innerHTML`.
- Looptijd wordt alleen getoond voor `bezig`-taken met API-veld `bezig_sinds`; `bijgewerkt` is geen starttijd.
- De knop Details klapt `akkoord.details` in de kaart uit als de API een niet-lege string stuurt. De knop bestaat niet als details ontbreken of leeg zijn. De open status blijft tijdens opnieuw renderen bewaard.

## Valkuilen
- De tests draaien in Node.js met nagebootste `document` en `window`; ze raken geen browser.
- Lokaal testen vraagt een nagebootste API (de tests hebben een fake `fetch`).
- Verander je de app shell, verhoog dan de cacheversie in `sw.js`, anders zien gebruikers een oude versie.
- Er is geen `.gitignore`: commit geen build-artefacten of testuitvoer.
- Het ⋮-menu ondersteunt toetsenbordbediening: Enter/spatie openen, pijltjes/Home/End verplaatsen focus, Escape sluit en herstelt focus, Tab sluit.
