# TechFlow Unified Portal — Complete React Build Plan
**Date:** 2026-03-08  
**Goal:** Merge invoice system + client portal into one React app with admin and client roles  
**Repo:** techflow-client-portal  
**Live URL:** portal.techflowsolutions.ca

---

## The Big Picture

One app. One URL. Two roles.

- **You log in (admin)** → Full invoice system: create invoices, manage customers, send emails, view all invoices
- **Client logs in** → View their invoices, download PDFs

Everything is built on top of what already exists today. Nothing gets deleted until the React version is 100% confirmed working.

---

## What We Learned From Reading The Code

### Critical findings from calculator.js
- Service types with auto-fill rates: Website Design ($100), SEO ($100), IT Remote ($90), IT Onsite ($100), Business-Critical ($175), Emergency ($120)
- Service descriptions are dropdown with optgroups — 3 categories, 30+ options
- Additional notes textarea appends to description on save
- Discount system exists (percent OR fixed amount) — not exposed in UI yet but logic is built
- HST currently set to 0% (not registered yet) — toggle exists, just off by default
- `roundToTwo()` floating point fix must be preserved exactly

### Critical findings from customer.js
- Duplicate detection uses **phone number** as unique key
- Customers sorted alphabetically in dropdown
- Notification toast system built into CustomerManager — reuse in React

### Critical findings from invoice.js
- Invoice counter stored in **localStorage** — MUST migrate to Firestore (localStorage won't work across devices or browsers)
- Format: `TFS-YYYY-NNNN` (e.g. TFS-2026-0012)
- After send: counter increments, new number generated, form NOT auto-cleared (intentional)
- Clear form has confirm() dialog — keep this

### Critical findings from functions/index.js
- `generateHeaderTemplate()` is **hardcoded** with TechFlow branding — must be white-label config-driven
- `generatePDFHTML()` is **hardcoded** with TechFlow payment info (e-transfer email, phone) — must be config-driven
- Stripe success URL hardcoded to `techflowsolutions.ca/InvoiceSystem/` — must update to portal URL
- Stripe webhook looks up invoices by `invoiceNumber` field — verify this matches Firestore field name `number` (potential bug to check)
- PDF attached to email only if Cloud Run succeeds — graceful fallback already exists ✅

---

## Final Component Architecture

```
src/
  components/
    ── EXISTING (keep exactly as is) ──
    LoginPage.jsx          ✅ done
    LoginPage.css          ✅ done
    Dashboard.jsx          ✅ client view
    Dashboard.css          ✅ done
    InvoiceRow.jsx         ✅ done
    InvoiceRow.css         ✅ done

    ── NEW ADMIN COMPONENTS ──
    AdminDashboard.jsx     ← your main view after login
    AdminDashboard.css
    InvoiceForm.jsx        ← create invoice (orchestrates all below)
    InvoiceForm.css
    CustomerSection.jsx    ← customer dropdown + form fields
    CustomerSection.css
    ServiceCalculator.jsx  ← hourly services + line items + totals
    ServiceCalculator.css
    InvoiceList.jsx        ← all invoices table (admin view)
    InvoiceList.css

  config/
    firebase.js            ✅ done
    client.js              ← EXPAND with new fields (see below)

  hooks/
    useInvoiceCounter.js   ← NEW: Firestore-based invoice counter
    useCustomers.js        ← NEW: customer CRUD with Firestore

  utils/
    formatters.js          ← currency, date formatting (shared)
    validators.js          ← invoice + customer validation logic
```

---

## Expanded White Label Config (client.js)

Add these fields for white-label PDF and email generation:

```javascript
const clientConfig = {
  // Existing
  companyName: "TechFlow Solutions",
  companyTagline: "IT Services & Business Automation in Toronto",
  companyPhone: "(647) 572-8341",
  companyEmail: "info@techflowsolutions.ca",
  primaryColor: "#667eea",
  secondaryColor: "#764ba2",
  logoUrl: "/logo.png",

  // NEW — Invoice system config
  invoiceEmail: "invoices@techflowsolutions.ca",   // e-transfer + from address
  invoicePrefix: "TFS",                             // TFS-2026-0001
  taxRate: 0,                                       // 0 now, change to 0.13 when HST registered
  taxName: "HST (13%)",                             // label on invoice
  currency: "CAD",
  paymentTermsDays: 15,                             // "Payment due within 15 days"
  location: "Greater Toronto Area",
  portalUrl: "https://portal.techflowsolutions.ca", // Stripe success URL redirect
  stripeEnabled: true,                              // toggle Stripe on/off per client
};
```

---

## Functions/index.js Changes Required

The Firebase functions need updates to support white-label and fix the counter issue.

### 1. Make generateHeaderTemplate() config-driven
Currently hardcoded. Pass config as parameter:
```javascript
async function generateHeaderTemplate(config) {
  // Use config.companyName, config.companyPhone, config.companyEmail
  // Logo URL from config.logoPublicUrl (publicly accessible URL)
}
```

### 2. Make generatePDFHTML() config-driven
Currently hardcoded e-transfer email and phone. Pass config:
```javascript
function generatePDFHTML(items, customerName, invoiceNumber, invoiceDate, 
                          subtotal, tax, total, config) {
  // Use config.invoiceEmail, config.companyPhone, config.paymentTermsDays
}
```

### 3. Fix Stripe success URL
Currently: `https://techflowsolutions.ca/InvoiceSystem/?payment=success`  
Change to use config: `${config.portalUrl}?payment=success`

### 4. Add invoice counter function
```javascript
exports.getNextInvoiceNumber = onCall(async (request) => {
  // Atomic Firestore counter — thread safe, works across devices
  const counterRef = admin.firestore().doc('counters/invoices');
  const result = await admin.firestore().runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    const count = (doc.exists ? doc.data().count : 0) + 1;
    t.set(counterRef, { count });
    return count;
  });
  const year = new Date().getFullYear();
  const prefix = request.data.prefix || 'TFS';
  return { number: `${prefix}-${year}-${result.toString().padStart(4, '0')}` };
});
```

**Why this matters:** localStorage counter breaks if you use a different browser, device, or incognito window. Firestore counter is the same everywhere.

---

## Session 1 — Foundation & Role Detection

### Step 1: Set Firebase Admin Custom Claim (one time, CLI)
```bash
# In your project folder
firebase functions:shell

# Then run:
const admin = require('firebase-admin');
admin.auth().setCustomUserClaims('YOUR_FIREBASE_UID', { admin: true });
```

To find your UID: Firebase Console → Authentication → Users → click your account.

### Step 2: Update App.jsx for role detection
```jsx
// App.jsx
const [user, setUser] = useState(null);
const [isAdmin, setIsAdmin] = useState(false);
const [loading, setLoading] = useState(true);

useEffect(() => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const token = await user.getIdTokenResult();
      setIsAdmin(!!token.claims.admin);
    }
    setUser(user);
    setLoading(false);
  });
}, []);

// Render logic
if (loading) return <LoadingSpinner />;
if (!user) return <LoginPage />;
if (isAdmin) return <AdminDashboard user={user} />;
return <Dashboard user={user} />;
```

### Step 3: Build AdminDashboard.jsx shell
```jsx
// Two tabs: "Create Invoice" and "All Invoices"
// Stats cards: total sent, total paid, total outstanding, revenue this month
// Sign out button
// Tab state switches between InvoiceForm and InvoiceList
```

### Step 4: Build InvoiceList.jsx (admin view all invoices)
- Query ALL invoices where `userId == currentUser.uid` (no email filter)
- Columns: Invoice #, Customer, Date, Amount, Status, Actions
- Actions: Mark Paid / Mark Unpaid / Mark Cancelled
- Search bar: filter by customer name or invoice number
- Sort by date descending by default

### Step 5: Update Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Admin can read/write everything
    match /invoices/{invoiceId} {
      allow read, write: if request.auth.token.admin == true;
      allow read, write: if request.auth != null 
                         && resource.data.userId == request.auth.uid;
      allow read: if request.auth != null 
                  && resource.data.customer.email == request.auth.token.email;
    }
    
    match /customers/{customerId} {
      allow read, write: if request.auth.token.admin == true;
      allow read, write: if request.auth != null 
                         && resource.data.userId == request.auth.uid;
    }
    
    // Invoice counter — admin only
    match /counters/{counterId} {
      allow read, write: if request.auth.token.admin == true;
    }
  }
}
```

---

## Session 2 — Invoice Form Build

### Step 1: Build useCustomers.js hook
Replaces customer.js class with React hook:
```javascript
export function useCustomers(userId) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load from Firestore on mount
  // saveCustomer() — upsert by phone number (same logic as original)
  // deleteCustomer()
  // Returns: { customers, loading, saveCustomer, deleteCustomer }
}
```

### Step 2: Build CustomerSection.jsx
Ports the customer section from index.html:
- Dropdown: "Select existing customer or add new"
- Select customer → auto-fills form fields
- Fields: Name*, Company, Phone*, Email, Address
- Save Customer button (upsert by phone)
- Delete Customer button (with confirm dialog)
- New Customer button (clears fields)

### Step 3: Build ServiceCalculator.jsx
This is the most complex component. Ports calculator.js:

**Hourly Services section:**
- Add Hourly Service button → adds row
- Each row: Service Type dropdown, Description dropdown, Notes textarea, Hours input, Rate input (auto-fills from type)
- Service types with rates exactly as original
- Description optgroups exactly as original (Website Design, SEO, IT Services)
- Remove button per row
- Hourly Services Total display

**Line Items section:**
- Add Line Item button → adds row
- Each row: Description text input, Quantity number, Unit Price number
- Remove button per row
- Line Items Total display

**Totals section:**
- HST checkbox (currently off, label shows "Add HST (13%)")
- Subtotal
- HST Amount (shows $0.00 when off)
- **Total (big, bold)**

**State structure:**
```javascript
const [hourlyServices, setHourlyServices] = useState([]);
const [lineItems, setLineItems] = useState([]);
const [chargeHST, setChargeHST] = useState(false);

// Computed from state (not stored):
const hourlyTotal = hourlyServices.reduce(...)
const lineItemsTotal = lineItems.reduce(...)
const subtotal = roundToTwo(hourlyTotal + lineItemsTotal)
const taxAmount = chargeHST ? roundToTwo(subtotal * 0.13) : 0
const finalTotal = roundToTwo(subtotal + taxAmount)
```

**CRITICAL:** Keep `roundToTwo()` exactly as original to avoid floating point bugs.

### Step 4: Build InvoiceForm.jsx
Orchestrates CustomerSection + ServiceCalculator:
```jsx
// State
const [invoiceNumber, setInvoiceNumber] = useState('');
const [invoiceDate, setInvoiceDate] = useState(today);
const [customer, setCustomer] = useState({});
const [services, setServices] = useState({ hourly: [], lineItems: [] });
const [totals, setTotals] = useState({});
const [previewing, setPreviewing] = useState(false);
const [sending, setSending] = useState(false);
const [pdfBlobUrl, setPdfBlobUrl] = useState(null);

// On mount: fetch next invoice number from Firestore counter
// Preview button: calls previewInvoicePDF Firebase function → iframe
// Send button: saves to Firestore + calls sendInvoiceEmail
// Clear button: confirm dialog → reset all state
```

**Invoice send flow (same as original):**
1. Validate customer (name + phone required, email required to send)
2. Validate services (at least one service/item, hours > 0, rate > 0)
3. Save to Firestore via `firestoreManager.saveInvoice()`
4. Call `sendInvoiceEmail` Firebase function
5. Fetch NEW invoice number for next invoice
6. Show success toast
7. Do NOT auto-clear form (intentional — let admin review what was sent)

### Step 5: Build useInvoiceCounter.js hook
```javascript
export function useInvoiceCounter() {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  const fetchNextNumber = async () => {
    const getNext = httpsCallable(functions, 'getNextInvoiceNumber');
    const result = await getNext({ prefix: clientConfig.invoicePrefix });
    setInvoiceNumber(result.data.number);
  };

  useEffect(() => { fetchNextNumber(); }, []);
  
  return { invoiceNumber, refreshNumber: fetchNextNumber };
}
```

### Step 6: Build formatters.js util
```javascript
export const formatCurrency = (amount) => 
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);

export const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString('en-CA', { 
    year: 'numeric', month: 'long', day: 'numeric' 
  });

export const roundToTwo = (num) => 
  Math.round((num + Number.EPSILON) * 100) / 100;
```

---

## Session 3 — Wire Up, Test, Deploy

### Step 1: Update functions/index.js
- Make `generateHeaderTemplate()` accept config param
- Make `generatePDFHTML()` accept config param
- Add `getNextInvoiceNumber` function
- Fix Stripe success URL to use `portalUrl` from config
- Deploy: `firebase deploy --only functions`

### Step 2: Move functions folder to portal repo
```bash
# In git-learning-lab repo:
# Copy functions/ folder to techflow-client-portal/
cp -r functions/ ../techflow-client-portal/functions/
cp firebase.json ../techflow-client-portal/
cp .firebaserc ../techflow-client-portal/

# In techflow-client-portal:
firebase deploy --only functions   # confirm it works from new location

# In git-learning-lab (after confirmed working):
git rm -r functions/
git rm firebase.json .firebaserc
git commit -m "move: Firebase functions moved to portal repo"
```

### Step 3: End-to-end testing checklist
```
ADMIN FLOW:
□ Log in as admin (rob@techflowsolutions.ca)
□ See AdminDashboard not client Dashboard
□ Create invoice: select existing customer
□ Create invoice: create new customer, save to Firestore
□ Add hourly service: select type, description, notes, hours — rate auto-fills
□ Add line item: description, qty, price
□ HST checkbox: toggles tax calculation
□ Preview PDF: matches what client will receive
□ Send invoice: saves to Firestore, email received, PDF attached
□ Invoice counter increments correctly
□ New invoice number auto-generated after send
□ View All Invoices: all invoices visible
□ Mark invoice as paid: status updates in Firestore
□ Client portal immediately shows updated status

CLIENT FLOW:
□ Log in as client (test account)
□ See client Dashboard not AdminDashboard
□ Invoices visible (filtered by email)
□ Download PDF works
□ Status badges correct (paid/unpaid/cancelled)
□ Sign out works

EDGE CASES:
□ Send without customer email: error message shown
□ Send without any services: error message shown
□ Hours = 0 on hourly service: validation error
□ Clear form: confirm dialog, form resets, new invoice number
□ Two browsers simultaneously: invoice numbers don't collide (Firestore counter)
```

### Step 4: Update DOCUMENTATION.md
Add admin section covering:
- Setting admin custom claim (one time per deployment)
- Invoice counter migration note
- Functions now in portal repo
- White-label config fields

### Step 5: Clean up git-learning-lab repo
After functions are confirmed working from portal repo:
```bash
# In git-learning-lab:
git rm -r functions/
git rm -r InvoiceSystem/
git rm firebase.json .firebaserc .firebase/
mkdir docs/
git mv *.md docs/    # move all .md files to docs/
git commit -m "cleanup: remove invoice system and Firebase (moved to portal repo)"
git push origin main
```

---

## Firestore Data — No Changes Needed

Existing invoice structure stays exactly the same:
```javascript
{
  userId: "adminUID",
  customer: {
    name, email, phone, company, address
  },
  number: "TFS-2026-0012",
  date: "2026-03-04",
  services: {
    hourly: [{ description, hours, rate, total }],
    lineItems: [{ description, quantity, price, total }]
  },
  totals: { subtotal, taxAmount, finalTotal },
  status: "unpaid" | "paid" | "cancelled",
  createdAt: Timestamp
}
```

New counter document:
```javascript
// counters/invoices
{ count: 12 }  // auto-increments on each new invoice
```

---

## White Label Cloning Checklist (Updated)

For each new client:
```
1.  Clone repo: git clone techflow-client-portal new-client-portal
2.  Edit src/config/client.js → all company fields
3.  Replace public/logo.png → client logo
4.  Edit src/config/firebase.js → their Firebase project credentials
5.  Update vite.config.js base → their repo name or /
6.  Set admin custom claim for client's UID in their Firebase project
7.  Update functions/index.js → deploy to their Firebase project
8.  New GitHub repo → push
9.  Enable GitHub Pages → gh-pages branch
10. Add custom domain DNS CNAME → their subdomain
11. Set GitHub Pages custom domain
12. Add robots.txt (already in repo) ✅
13. Test full invoice flow end to end
14. Create test client Firebase Auth account
15. Send test invoice, confirm email + PDF received
Done!
```

---

## What Stays the Same Forever

- Firebase Functions code structure ✅
- Cloud Run Puppeteer PDF service ✅  
- Zoho SMTP email sending ✅
- Stripe integration ✅
- Firestore data structure ✅
- Client portal Dashboard.jsx ✅
- InvoiceRow.jsx ✅
- LoginPage.jsx ✅
- GitHub Actions deploy workflow ✅
- Custom domain setup ✅

---

## Session Start Prompt (save this!)

When ready to build, start a new conversation and say:

> "I'm continuing the TechFlow unified portal build. Here's my plan doc and the current portal repo files. Let's start Session 1: set up admin role detection in App.jsx, build AdminDashboard shell with tabs, and InvoiceList to view all invoices."

Upload: `UNIFIED_PORTAL_BUILD_PLAN.md` + current `App.jsx` + current `AdminDashboard.jsx` (if exists)

---

## Estimated Timeline

- **Session 1** (2-3 hrs): Role detection, AdminDashboard shell, InvoiceList, Firestore rules
- **Session 2** (3-4 hrs): CustomerSection, ServiceCalculator, InvoiceForm, counter hook
- **Session 3** (2-3 hrs): Functions update, testing, cleanup, documentation

**Total: ~3 sessions to a fully sellable product**

---

*Plan created: 2026-03-08*  
*Based on: full code review of calculator.js, customer.js, invoice.js, functions/index.js, and existing portal components*
