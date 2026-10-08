---
"balanced-work-life": minor
---

Persist Horizon lens configuration in the synced database and add human-friendly default lenses plus the Impact scheme.

**Synced lens config:** saved views, the default view/lens and the secondary-split map move from localStorage into two new synced tables (`horizon_views`, `horizon_prefs`), so they follow the user across devices. Active selection stays local in `uiPrefsStore`. Legacy localStorage keys are imported once (views kept, defaults and splits adopted only when the database is empty) and then removed. Backup format bumps to v4 and round-trips the new tables; old backups still import.

**Default lenses:** six built-in lenses (Closest in time, Easiest first, What matters most, Ready to move, Looking ahead, Biggest payoff) as a presentation overlay on classification schemes, with explicit column order and in-column tiebreakers (unvalued last, `sort_order` fallback). New `impact` scheme (High/Medium/Low) seeded for new and existing users. Legacy `?lens=` links, stored prefs and saved views resolve to the equivalent lens; `nnl`/`priority` keep working via synthesized lenses.
