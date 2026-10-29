# Huisstijl web-app

## Kleur
- `--accent` is lila `#a78bfa`; `--accent-light` en `--accent-dark` zijn hover- en nadrukvarianten.
- `--accent-text` is leesbare lila tekst; `--on-accent` is tekst op gevulde lila knoppen.
- `--bg`, `--card`, `--fill`, `--fill-hover`, `--text`, `--text-2`, `--text-3` en `--sep` vormen de neutrale lagen.
- `--danger`, `--danger-fill` en `--on-danger` zijn uitsluitend voor fouten en destructieve bevestigingen.
- `--dot-nieuw`, `--dot-gepland`, `--dot-bezig`, `--dot-wacht`, `--dot-klaar` en `--dot-mislukt` zijn alleen statusstippen; labels blijven neutraal.
- `--owner-dot` markeert de eigenaar als kleine stip. `--blur-bg`, `--backdrop`, `--shadow` en `--focus` zijn uitsluitend voor lagen en focus.
- Donker is standaard; `prefers-color-scheme: light` wisselt de neutrale en statuskleuren. Tekstcontrasten zijn gekozen voor minimaal WCAG AA in beide thema's.

## Vorm en type
- `--r-s` is `10px` voor menu-items; `--r-m` is `14px` voor knoppen, velden en blokken.
- `--r-l` is `18px` voor kaarten en menu's; `--r-xl` is `22px` voor de sheet-bovenhoeken; `--pill` is `999px`.
- `--font` is het systeemfont (-apple-system / SF Pro); `--font-mono` is voor details en code.
- `--fs-title` is `28px/700`, `--fs-headline` `17px/600`, `--fs-body` `15px`, `--fs-sub` `13px`, `--fs-cap` `12px`.
- `--lh-title`, `--lh-headline`, `--lh-body`, `--lh-compact`, `--ls-title` en `--ls-headline` leggen regelhoogte en letterafstand vast.

## Ruimte en componenten
- Gebruik `--space-1` t/m `--space-6`: `4px`, `8px`, `12px`, `16px`, `24px`, `32px` voor padding, gap en margin.
- Primaire knoppen zijn gevuld lila; secundaire knoppen zijn grijs; destructieve tekst is rood en de bevestiging rood gevuld.
- Chips, kaarten, velden, sheets, toasts en menu's gebruiken de gedeelde vorm-, kleur- en ruimte-tokens.
- Interactieve elementen hebben minimaal `44px` tikhoogte. Focus gebruikt de lila focus-ring.
- `--shadow` wordt alleen op zwevende lagen gebruikt. Overgangen duren `180ms`; `prefers-reduced-motion` schakelt beweging uit.
- Statussen en eigenaren worden met kleine stippen gemarkeerd. Laden, lege resultaten en fouten staan gecentreerd.
- In `html.ingebed` verdwijnt de interne kop; content en vaste bediening houden rekening met safe-area-insets.
