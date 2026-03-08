# TechFlow Client Portal - Complete Documentation

## 📋 Project Overview

A white-label React client portal for viewing and downloading invoices. Built with React + Vite, Firebase (Auth, Firestore, Functions), and deployed to GitHub Pages with automated CI/CD.

**Live URL:** https://robertwilliamhummel-ops.github.io/techflow-client-portal/

---

## 🏗️ Architecture

### Tech Stack
- **Frontend:** React 18 + Vite
- **Authentication:** Firebase Auth (Email/Password)
- **Database:** Cloud Firestore
- **Functions:** Firebase Cloud Functions
- **Deployment:** GitHub Pages via GitHub Actions
- **Styling:** CSS with CSS Variables for theming

### Project Structure
```
techflow-client-portal/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions auto-deploy
├── public/
│   └── logo.png                # Company logo (white-label)
├── src/
│   ├── components/
│   │   ├── LoginPage.jsx       # Login + password reset
│   │   ├── LoginPage.css
│   │   ├── Dashboard.jsx       # Main invoice dashboard
│   │   ├── Dashboard.css
│   │   ├── InvoiceRow.jsx      # Individual invoice + PDF download
│   │   └── InvoiceRow.css
│   ├── config/
│   │   ├── firebase.js         # Firebase connection
│   │   └── client.js           # White-label config (SECRET WEAPON!)
│   ├── App.jsx                 # Main app with auth flow
│   ├── index.css               # Global styles + CSS variables
│   └── main.jsx                # React entry point
├── index.html                  # HTML entry + Font Awesome CDN
├── vite.config.js              # Vite config with GitHub Pages base
└── package.json                # Dependencies
```

---

## 🔥 Key Features

### 1. Authentication Flow
**File:** [`src/App.jsx`](src/App.jsx)

- Uses Firebase `onAuthStateChanged` listener
- Auto-redirects based on auth state:
  - Not logged in → LoginPage
  - Logged in → Dashboard
- Loading state while checking auth

**Login Page** ([`src/components/LoginPage.jsx`](src/components/LoginPage.jsx)):
- Email/password login
- Forgot password functionality (sends reset email)
- Error handling for all Firebase auth errors
- Responsive gradient design

### 2. Invoice Dashboard
**File:** [`src/components/Dashboard.jsx`](src/components/Dashboard.jsx)

**Features:**
- Summary cards showing:
  - Total invoices
  - Paid invoices
  - Outstanding invoices
  - Total amount owing
- Filter invoices by status (All, Unpaid, Paid, Cancelled)
- Responsive grid layout
- Sign out functionality

**Data Fetching:**
```javascript
// CRITICAL: Uses dot notation for nested field
const q = query(
  collection(db, 'invoices'),
  where('customer.email', '==', user.email)
);
```

**Firestore Data Structure:**
```javascript
{
  userId: "businessOwnerUid",
  customer: {
    name: "Client Name",
    email: "client@email.com",  // ← Nested field
    phone: "(123) 456-7890",
    company: "Company Name",
    address: "123 Street"
  },
  number: "TFS-2026-0012",
  date: "2026-03-04",
  services: {
    hourly: [{ description, hours, rate, total }],
    lineItems: [{ description, quantity, price, total }]
  },
  totals: {
    subtotal: 1000,
    taxAmount: 130,
    finalTotal: 1130
  },
  status: "unpaid" | "paid" | "cancelled",
  createdAt: Timestamp
}
```

### 3. Invoice Row & PDF Download
**File:** [`src/components/InvoiceRow.jsx`](src/components/InvoiceRow.jsx)

**PDF Download Flow:**
1. Builds items array from invoice services (hourly + line items)
2. Calls Firebase Function `previewInvoicePDF` (same function used in invoice system)
3. Receives base64 PDF data
4. Converts to Blob and triggers browser download
5. Filename: `Invoice-{number}.pdf`

**Status Badges:**
- Green: Paid
- Red: Unpaid
- Gray: Cancelled

---

## 🎨 White-Label Configuration

### The Secret Weapon: `src/config/client.js`

```javascript
const clientConfig = {
  companyName: "TechFlow Solutions",
  companyTagline: "Website Design & IT Services",
  companyPhone: "(647) 572-8341",
  companyEmail: "info@techflowsolutions.ca",
  primaryColor: "#667eea",
  secondaryColor: "#764ba2",
  logoUrl: "/logo.png",
};
```

**To Clone for a New Client:**
1. Edit [`src/config/client.js`](src/config/client.js) with new client info
2. Replace [`public/logo.png`](public/logo.png) with client logo
3. Optional: Update CSS variables in [`src/index.css`](src/index.css) for advanced theming
4. Update [`src/config/firebase.js`](src/config/firebase.js) with the new client's Firebase project credentials
5. Update [`vite.config.js`](vite.config.js) `base` to match new repo name (e.g., `'/cleaning-client-portal/'`)
6. Create new GitHub repo and push
7. Enable GitHub Pages from `gh-pages` branch in repo Settings → Pages

**CSS Variables** ([`src/index.css`](src/index.css)):
```css
:root {
  --primary: #667eea;
  --secondary: #764ba2;
  --bg-dark: #0f0c29;
  --bg-medium: #1a1a2e;
  --bg-card: rgba(255, 255, 255, 0.05);
  --border: rgba(255, 255, 255, 0.1);
  --text-white: #ffffff;
  --text-muted: rgba(255, 255, 255, 0.7);
}
```

---

## 🚀 Deployment

### GitHub Pages Setup

**Vite Config** ([`vite.config.js`](vite.config.js)):
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/techflow-client-portal/', // ← CRITICAL for GitHub Pages
})
```

**Why `base` is Required:**
- Without it, all JS/CSS files 404 on GitHub Pages
- Tells Vite the app lives at `/techflow-client-portal/` instead of root `/`

### GitHub Actions Auto-Deploy

**File:** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

**Workflow:**
1. Triggers on push to `main` branch
2. Installs Node 18 and dependencies
3. Runs `npm run build`
4. Deploys `dist/` folder to `gh-pages` branch
5. GitHub Pages serves from `gh-pages` branch

**Key Configuration:**
```yaml
permissions:
  contents: write  # ← Required to create gh-pages branch
```

**GitHub Pages Settings:**
- Go to repo Settings → Pages
- Source: Deploy from a branch
- Branch: `gh-pages` → `/root`

---

## 🔧 Development

### Local Setup
```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Firebase Configuration
**File:** [`src/config/firebase.js`](src/config/firebase.js)

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAXjjNSClbsrtmMAbB_KuOEX8EnOn5N_0k",
  authDomain: "techflow-website-2026.firebaseapp.com",
  projectId: "techflow-website-2026",
  storageBucket: "techflow-website-2026.firebasestorage.app",
  messagingSenderId: "904705508663",
  appId: "1:904705508663:web:f1847a3d6d86abaa5e46b2"
};

export const auth = getAuth(app);      // Authentication
export const db = getFirestore(app);   // Database
export const functions = getFunctions(app); // Cloud Functions
```

---

## 📝 Important Notes

### Firestore Query Pattern
**ALWAYS use dot notation for nested fields:**
```javascript
where('customer.email', '==', user.email) // ✅ CORRECT
where('customerEmail', '==', user.email)  // ❌ WRONG
```

### Firebase Function Integration
The portal uses the **existing** `previewInvoicePDF` function from the invoice system:
- Same function, same parameters
- No duplicate code
- Maintains consistency

### GitHub Pages Deployment Gotchas
1. **Must set `base` in vite.config.js** or app loads blank
2. **Must add `permissions: contents: write`** to workflow or deployment fails
3. **Must configure GitHub Pages settings** to use `gh-pages` branch

### Authentication Security
- Firebase Auth handles all security
- Firestore rules enforce data access
- No sensitive data in frontend code
- Environment variables not needed (Firebase config is public)

---

## 🐛 Troubleshooting

### Blank Page on GitHub Pages
**Problem:** App loads but shows blank page  
**Solution:** Add `base: '/techflow-client-portal/'` to [`vite.config.js`](vite.config.js)

### GitHub Actions Permission Error
**Problem:** Workflow fails with "Resource not accessible"  
**Solution:** Add `permissions: contents: write` to [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)

### No Invoices Showing
**Problem:** Dashboard shows "No invoices found"  
**Checklist:**
1. Client email exists in Firebase Auth
2. Invoices in Firestore have `customer.email` field
3. Email matches exactly (case-sensitive)
4. User is logged in with correct account

### PDF Download Fails
**Problem:** "Download failed" error  
**Checklist:**
1. Firebase Function `previewInvoicePDF` is deployed
2. Invoice has valid `services` data
3. Network tab shows function call succeeding
4. Function returns `success: true` and `pdfBase64`

---

## 📦 Dependencies

**Core:**
- `react` ^18.3.1
- `react-dom` ^18.3.1
- `firebase` ^11.1.0

**Dev:**
- `vite` ^6.0.5
- `@vitejs/plugin-react` ^4.3.4
- `eslint` ^9.17.0

**External:**
- Font Awesome 6.4.0 (CDN)

---

## 🎯 Future Enhancements

### Potential Features
- Payment integration (Stripe/Square)
- Invoice search/filtering
- Email notifications
- Multi-language support
- Dark/light theme toggle
- Invoice history export (CSV/Excel)
- Client profile management
- Support ticket system

### White-Label Improvements
- Visual theme builder
- Custom domain support
- Branded email templates
- Client-specific feature flags

---

## 📞 Support

**Developer:** TechFlow Solutions  
**Email:** info@techflowsolutions.ca  
**Phone:** (647) 572-8341

---

## 📄 License

Proprietary - TechFlow Solutions © 2026

---

## 🔄 Change Log

### v1.0.0 (2026-03-08)
- Initial release
- Firebase authentication
- Invoice dashboard
- PDF download functionality
- GitHub Pages deployment
- White-label configuration
- GitHub Actions CI/CD

---

**Last Updated:** 2026-03-08  
**Maintained By:** TechFlow Solutions