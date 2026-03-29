# Common materials on line items (idea doc)

**Status:** Idea / future enhancement — not implemented yet.  
**Goal:** Help contractors and trades pick **common materials** faster on **line items** without adding a second “mode” or a huge dropdown.

---

## Principles

1. **Line items stay the materials bucket** — description + qty + unit price. No separate “materials invoice type” or parallel form.
2. **Search-as-you-type** beats scrolling — combobox / typeahead over a **curated list** (and free text always allowed).
3. **Recents (and optionally favorites)** — after a few jobs, most picks repeat; show **last N used** descriptions at the top (localStorage or per-user in Firestore later).
4. **No giant single dropdown** — avoid listing hundreds of SKUs in one `<select>`; use filter + short lists.
5. **Optional trade packs** — e.g. Carpentry / Drywall / Electrical as **filters** or **collapsed groups**, not a second app mode.
6. **Rates stay editable** — presets may suggest a **default unit price** where we have one; user can always override (same as hourly rates).

---

## UX sketch

- On **line item** “Description” field:
  - Behaves like text input **or** typeahead: typing filters suggestions.
  - Panel below (or attached list): **Recents** → **Matches from catalog** → optional “Browse categories.”
  - Picking a row **fills description** and optionally **qty** and **unit** (e.g. ea / sheet / box) if we store that in the catalog entry.
- **Not** a required wizard; user can ignore suggestions and type freely.

---

## Data shape (conceptual)

- **`MATERIAL_PRESETS`** (or loaded from JSON):  
  `id`, `label` (line text), optional `defaultQty`, optional `defaultUnitPrice`, optional `unit` (ea, sheet, LF), optional `tags` (e.g. `drywall`, `fasteners`).
- **Recents:** array of `{ label, lastUsedAt }` capped at ~10–15; dedupe by normalized label.

---

## Out of scope for v1 of this idea

- Full inventory / stock counts / POs  
- Per-job material lists maintained in a second admin app  
- Mandatory materials dropdown for every line  

---

## Why this fits the product

- **Construction clones** get speed without forking the mental model (hourly vs line items stays the same).
- **MSP-style** users can leave the preset list empty or tiny; behavior degrades to plain line items.

---

## Related decisions

- **No backend required** for v1: static JSON + `localStorage` recents is enough.
- **Firestore later** only if recents should follow the user across devices or admins edit the catalog without redeploying.
