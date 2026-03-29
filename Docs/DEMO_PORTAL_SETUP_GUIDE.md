# Demo Contractor Portal - Setup Cheat Sheet

**Date:** 2026-03-28  
**Purpose:** Create a reusable demo invoice portal to show contractor prospects  
**Deploy to:** demo.techflowsolutions.ca

---

## 🎯 THE STRATEGY

### Why Demo Instead of Custom Build First?

**Problem:** Building a custom portal for each prospect before they commit is risky:
- ❌ Takes 2+ hours per prospect
- ❌ Wasted time if they say no
- ❌ Can't show them a working system upfront

**Solution:** Build ONE demo portal that shows ALL prospects:
- ✅ Reusable for every contractor prospect
- ✅ Low-pressure exploration ("just check it out")
- ✅ Shows real functionality immediately
- ✅ Easy pitch: "This is what you get, but with YOUR branding"
- ✅ Professional proof-of-concept

---

## 📁 PROJECT STRUCTURE

```
c:/Users/Reggie/Documents/Websites/
├── Shahed/                        ← Static website (current project)
│   ├── index.html
│   ├── assets/
│   └── ...
│
└── demo-contractor-portal/        ← NEW: Demo invoice system
    ├── src/
    ├── functions/
    ├── package.json
    └── ...
```

**CRITICAL:** Keep these as **separate repos**. Don't mix React app with static site.

---

## 🚀 SETUP STEPS

### Step 1: Clone Portal Repo (2 minutes)

```bash
cd c:/Users/Reggie/Documents/Websites/
git clone [techflow-portal-url] demo-contractor-portal
cd demo-contractor-portal
```

### Step 2: Open in NEW VS Code Window (1 minute)

- File → Open Folder → `demo-contractor-portal`
- Start **fresh Kilo Code session** in this folder
- Don't try to work on both projects in same session

### Step 3: Give Kilo Code This EXACT Prompt (Copy/Paste)

```
Create a demo version of this invoice portal for showing to contractor prospects.

WHITE-LABEL CONFIG:
Company: Demo Construction Company
Owner: John Smith
Tagline: "Professional Contractor Invoice System"
Phone: (555) 123-4567
Email: demo@techflowsolutions.ca
Invoice Email: invoices@techflowsolutions.ca
Location: Greater Toronto Area
Invoice Prefix: DEMO

BRANDING:
Colors: Neutral blue/gray professional theme (not purple)
Logo: Generic construction company logo or just company name text

SERVICES (Replace IT services with contractor services):
1. Painting (Interior & Exterior) - $75/hr
2. Drywall (Installation & Repair) - $70/hr
3. Framing (Structural & Non-Structural) - $80/hr
4. Flooring (Hardwood, Laminate, Tile) - $65/hr
5. Demolition (Safe & Clean Removal) - $85/hr
6. Deck & Fence (Custom Building) - $70/hr

SAMPLE DATA:
Create 4 realistic sample invoices in Firestore:
- Invoice 1: Painting job, $1,200, Status: Paid, Date: 2 weeks ago
- Invoice 2: Deck build, $4,500, Status: Unpaid, Date: 1 week ago
- Invoice 3: Flooring install, $2,800, Status: Paid, Date: 3 days ago
- Invoice 4: Drywall repair, $650, Status: Unpaid, Date: Today

TEST ACCOUNTS:
- Admin: demo@techflowsolutions.ca / [password]
- Client: client@example.com / [password]

DEPLOYMENT:
Deploy to: demo.techflowsolutions.ca
```

### Step 4: Let AI Do The Work (30-45 minutes)

AI will:
- Update `src/config/client.js` with demo company info
- Change all service types from IT to contractor services
- Update colors throughout the app
- Modify invoice templates
- Create sample invoices
- **You just review and approve each change**

### Step 5: Firebase Setup (30 minutes)

```bash
# Create new Firebase project (in Firebase Console)
# Name: demo-contractor-portal

# Update src/config/firebase.js with new credentials

# Deploy functions
npm install
firebase deploy --only functions

# Test locally first
npm run dev
```

### Step 6: Final Testing (30 minutes)

**Admin Flow:**
- [ ] Log in as admin
- [ ] Create new invoice
- [ ] Send invoice (check email arrives)
- [ ] PDF attached and looks professional
- [ ] Mark invoice as paid

**Client Flow:**
- [ ] Log in as client
- [ ] View invoices
- [ ] Download PDF
- [ ] Status updates correctly

**Total Time: ~2 hours**

---

## 💰 THE SALES PITCH

### Step 1: Show Demo
"Check out demo.techflowsolutions.ca - this is the invoice system"

### Step 2: Walk Through Features
- "Log in and create an invoice in 2 minutes"
- "Professional PDF generation automatic"
- "Clients can log in and view all their invoices"
- "Track paid/unpaid status"
- "Optional Stripe payments"

### Step 3: Close
"I can set this up with YOUR branding - your logo, your colors, your company name - in about 2 hours. You'd have portal.shahidrenovation.ca ready to use."

### Pricing Strategy
- **Website Only:** $X (what we just built for Shahed)
- **Website + Portal:** $X + $Y (higher value, your specialty!)

**Push the portal** because:
1. It's more technical (easier for you than design)
2. Higher perceived value
3. Recurring relationship (support/updates)
4. One demo works for ALL prospects

---

## 🔄 REUSING THE DEMO

**For Each New Prospect:**

1. Show them demo.techflowsolutions.ca
2. Walk through features
3. If they say yes → Clone portal AGAIN
4. White-label with THEIR branding (2 hours with AI)
5. Deploy to their domain

**You've already proven it works with the demo!**

---

## 📋 WHAT WE BUILT FOR SHAHED (Context)

### Static Website (Completed)
- Location: `c:/Users/Reggie/Documents/Websites/Shahed`
- 5 pages: Home, Services, Gallery, About, Contact
- Mobile-first responsive
- Orange theme (#E8751A) from logo
- No frameworks - pure HTML/CSS/JS
- Hero slideshow with 3 images
- Portfolio gallery with lightbox
- Contact form (Formspree)

**Status:** ✅ Almost complete (just need to update config.js with deck-build.jpg)

### What Shahed Gets (If He Buys Portal Too)
1. Professional static website (already built)
2. Invoice portal system (white-labeled from demo)
3. Both deployed and ready to use
4. Total setup time: ~2 hours (with AI)

---

## 🎓 KEY LESSONS

### Why Separate Repos?
- ✅ Clean organization
- ✅ Different tech stacks (static vs React)
- ✅ Easier deployment
- ✅ Better version control
- ✅ Kilo Code has full context per project

### Why Demo First?
- ✅ Proof of concept before commitment
- ✅ Reusable for all prospects
- ✅ Shows professional finish
- ✅ Low-pressure sales approach
- ✅ Validates the offer

### Why AI Makes This Fast?
- ✅ One prompt → changes 50+ files
- ✅ Consistent updates everywhere
- ✅ No manual search/replace
- ✅ Handles syntax automatically
- ✅ 5x faster than manual coding

---

## 🔗 IMPORTANT FILES TO REMEMBER

In the portal project, these are the key files AI will modify:

```
src/
  config/
    client.js          ← Company info, colors, services
    firebase.js        ← Firebase credentials
  
  components/
    ServiceCalculator.jsx  ← Service types and rates
    
functions/
  index.js             ← Invoice PDF generation, email templates
```

---

## 📝 NEXT SESSION CHECKLIST

When you start the new AI session in demo-contractor-portal:

1. [ ] Open folder in NEW VS Code window
2. [ ] Start NEW Kilo Code chat
3. [ ] Paste the prompt from Step 3 above
4. [ ] Let AI make all changes
5. [ ] Review and approve each change
6. [ ] Test locally with `npm run dev`
7. [ ] Deploy to Firebase
8. [ ] Test end-to-end (admin + client flows)
9. [ ] Deploy to demo.techflowsolutions.ca

**Remember:** This is a DIFFERENT project from Shahed's website. Keep them separate!

---

## 🎯 SUCCESS CRITERIA

Demo portal is ready when:
- [ ] Deploys to demo.techflowsolutions.ca
- [ ] Admin can log in and create invoices
- [ ] Invoices email with PDF attachment
- [ ] Client can log in and view invoices
- [ ] All branding shows "Demo Construction Company"
- [ ] 4 sample invoices pre-populated
- [ ] Professional looking and bug-free

**Then you can show ANY contractor prospect and close the deal! 🚀**