# Essential Files for Sonnet 4.5 Extended (20 File Limit)

Based on the directory scan, here are the **EXACT 20 files** you need to paste into the mega prompt:

---

## ✅ CRITICAL FILES (Must Include - 18 files)

### **React Components (10 files)**
1. `src/App.jsx` - Main app structure
2. `src/components/AdminDashboard.jsx` - Needs quotes tab added
3. `src/components/Dashboard.jsx` - Client view, needs quotes section
4. `src/components/InvoiceForm.jsx` - Template for QuoteForm
5. `src/components/InvoiceList.jsx` - Template for QuoteList
6. `src/components/InvoiceRow.jsx` - Template for QuoteRow
7. `src/components/CustomerSection.jsx` - Reused in quotes
8. `src/components/ServiceCalculator.jsx` - Reused in quotes
9. `src/components/LoginPage.jsx` - Context for auth
10. `src/main.jsx` - App entry point

### **Configuration (2 files)**
11. `src/config/client.js` - White-label config
12. `src/config/firebase.js` - Firebase setup

### **Hooks (2 files)**
13. `src/hooks/useCustomers.js` - Template for useQuotes
14. `src/hooks/useInvoiceCounter.js` - Template for useQuoteCounter

### **Utils (2 files)**
15. `src/utils/formatters.js` - Shared utilities
16. `src/utils/validators.js` - Validation functions

### **Firebase Functions (1 file)**
17. `functions/index.js` - Needs quote email/PDF functions

### **Config Files (1 file)**
18. `package.json` - Dependencies

---

## ⚠️ OPTIONAL BUT HELPFUL (Choose 2 more to reach 20)

19. `firebase.json` - Firebase configuration
20. `functions/package.json` - Functions dependencies

**OR**

19. `src/index.css` - Global styles
20. `src/components/AdminDashboard.css` - Style reference

---

## ❌ DON'T INCLUDE (Not Needed)

- `.gitignore` - Not needed
- `README.md` - Not needed
- `.firebaserc` - Config, not code
- `vite.config.js` - Build config
- `eslint.config.js` - Linting config
- Any `.css` files except AdminDashboard.css (can be inferred)
- `pdf-service/` folder - Separate service
- Documentation files
- Test files

---

## 📋 EXACT COPY ORDER

Copy these files in this order and paste after the prompt:

```
===== FILE 1: src/App.jsx =====
[paste entire file]

===== FILE 2: src/main.jsx =====
[paste entire file]

===== FILE 3: src/config/client.js =====
[paste entire file]

===== FILE 4: src/config/firebase.js =====
[paste entire file]

===== FILE 5: src/components/AdminDashboard.jsx =====
[paste entire file]

===== FILE 6: src/components/Dashboard.jsx =====
[paste entire file]

===== FILE 7: src/components/InvoiceForm.jsx =====
[paste entire file]

===== FILE 8: src/components/InvoiceList.jsx =====
[paste entire file]

===== FILE 9: src/components/InvoiceRow.jsx =====
[paste entire file]

===== FILE 10: src/components/CustomerSection.jsx =====
[paste entire file]

===== FILE 11: src/components/ServiceCalculator.jsx =====
[paste entire file]

===== FILE 12: src/components/LoginPage.jsx =====
[paste entire file]

===== FILE 13: src/hooks/useCustomers.js =====
[paste entire file]

===== FILE 14: src/hooks/useInvoiceCounter.js =====
[paste entire file]

===== FILE 15: src/utils/formatters.js =====
[paste entire file]

===== FILE 16: src/utils/validators.js =====
[paste entire file]

===== FILE 17: functions/index.js =====
[paste entire file]

===== FILE 18: package.json =====
[paste entire file]

===== FILE 19: firebase.json =====
[paste entire file]

===== FILE 20: functions/package.json =====
[paste entire file]
```

---

## 🎯 Why These Files?

**Components:** Sonnet needs to see existing structure to create matching QuoteForm/QuoteList  
**Hooks:** Templates for creating useQuotes/useQuoteCounter  
**Utils:** Shared code that quotes will use  
**Functions:** Needs to add quote email/PDF generation  
**Config:** Understanding the white-label system  

**These 20 files give Sonnet everything it needs to:**
1. Create new quote components matching existing style
2. Modify AdminDashboard to add quotes tab
3. Update Dashboard for client quote viewing
4. Add Firebase functions for quote emails/PDFs
5. Create filtering/sorting for both invoices and quotes

---

## ✅ READY TO GO

With these 20 files, Sonnet 4.5 Extended has:
- Full context of your codebase
- Templates to copy patterns from
- Understanding of your architecture
- Everything needed to deliver complete, working code

**Estimated token count:** ~150K tokens (well within Sonnet 4.5 Extended's 200K limit)