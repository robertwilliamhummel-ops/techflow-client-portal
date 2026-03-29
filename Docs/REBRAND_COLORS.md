# Rebrand & colors

**Purpose:** When white-labelling or changing brand colors, know **which files matter** and what is **config-driven** vs **hardcoded**.

---

## Two config files (keep them aligned)

| File | Who reads it |
|------|----------------|
| **`src/config/client.js`** | React app (Vite) — company name, logo, phone, email, **`primaryColor`**, **`secondaryColor`**, invoice prefix, portal URL, etc. |
| **`functions/config.js`** | Firebase Cloud Functions — same *kind* of business fields + **`primaryColor`** for **PDFs** and **transactional emails** |

After a rebrand, update **both** so the **portal** and **PDFs/emails** match. Deploy the **functions** after changing `functions/config.js`.

---

## PDFs & emails (Cloud Functions)

- **Most** accent colors come from **`config.primaryColor`** in `functions/config.js` (headers, borders, table headers, totals, payment blocks, many email elements).
- **Exception:** table **gradients** in `functions/index.js` use  
  `linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%)`  
  The **second stop** (`#764ba2`) is **hardcoded** in that file unless you change it or add something like `secondaryColor` to `functions/config.js` and substitute it in the template strings.

So: **rebrand primary** by editing **`functions/config.js`**; **fix the purple gradient end** by editing **`functions/index.js`** (or extending config).

---

## Web app (React + CSS)

- **`src/index.css`** defines **CSS variables** on `:root`:  
  `--primary`, `--secondary`, `--bg-dark`, etc.  
  Many components use **`var(--primary, #667eea)`** — those follow **`index.css`**, not `client.js`, unless you sync them.
- **`client.js` includes `primaryColor` and `secondaryColor`** but they are **not automatically applied** to `:root` today. Nothing in `main.jsx` injects them into CSS variables.
- **Many `*.css` files still use literal hex** (e.g. `#667eea`, `#764ba2`) for icons, buttons, and borders. Those **do not** change when you only edit `client.js`.

**Practical rebrand options for the UI:**

1. **Quick:** Update **`src/index.css`** `--primary` / `--secondary` **and** search/replace obvious hexes in component CSS **or**
2. **Cleaner:** In **`main.jsx`** (or `App.jsx`), after importing `clientConfig`, set once:  
   `document.documentElement.style.setProperty('--primary', clientConfig.primaryColor)`  
   (and the same for `--secondary`), then migrate hardcoded colors to **`var(--primary)`** / **`var(--secondary)`** over time.

---

## Checklist for a full rebrand

1. **`src/config/client.js`** — name, logo URL, phones, emails, `primaryColor`, `secondaryColor`, prefix, `portalUrl`, etc.
2. **`functions/config.js`** — mirror business + `primaryColor` (and add `secondaryColor` here if you wire gradients to it).
3. **`functions/index.js`** — replace hardcoded `#764ba2` in gradients if you want the second brand color configurable.
4. **`src/index.css`** — update `--primary` / `--secondary` (or inject from `client.js` as above).
5. **Component CSS** — grep for `#667eea`, `#764ba2`, `102,126,234` and align with your palette or CSS variables.
6. **Deploy** — build/host the frontend; **`firebase deploy --only functions`** (or your pipeline) after `functions/` changes.

---

## Related

- Logo for PDF headers: **`logoUrl`** in **`functions/config.js`** (must be a **publicly reachable URL** for the Functions runtime to fetch it).
