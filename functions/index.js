const {onCall}      = require("firebase-functions/v2/https");
const {onRequest}   = require("firebase-functions/v2/https");
const {onSchedule}  = require("firebase-functions/v2/scheduler");  // NEW
const {defineSecret} = require("firebase-functions/params");
const admin         = require("firebase-admin");
const nodemailer    = require("nodemailer");
const config        = require("./config");

// Secrets
const stripeSecretKey      = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret  = defineSecret("STRIPE_WEBHOOK_SECRET");
const zohoEmailPassword    = defineSecret("ZOHO_EMAIL_PASSWORD");

admin.initializeApp();

// ── Logo cache ─────────────────────────────────────────────────────────────
let cachedLogoDataUrl = null;

async function getLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const res = await fetch(config.logoUrl);
  if (!res.ok) throw new Error(`Logo fetch failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "image/png";
  const arrayBuf    = await res.arrayBuffer();
  const base64      = Buffer.from(arrayBuf).toString("base64");
  cachedLogoDataUrl = `data:${contentType};base64,${base64}`;
  return cachedLogoDataUrl;
}

async function generateHeaderTemplate() {
  const logoSrc = await getLogoDataUrl();
  return `
    <div style="width:100%; box-sizing:border-box; padding: 18px 40px 0 40px;
                font-family: Arial, sans-serif; -webkit-print-color-adjust: exact;">
      <table style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="vertical-align:top;">
            <div style="font-size:24px; font-weight:bold; color:${config.primaryColor}; margin-bottom:5px;">
              ${config.companyName}
            </div>
            <div style="font-size:14px; color:#718096;">${config.companyTagline}</div>
            <div style="font-size:14px; color:#718096;">Phone: ${config.companyPhone}</div>
            <div style="font-size:14px; color:#718096;">Email: ${config.companyEmail}</div>
          </td>
          <td style="vertical-align:top; text-align:right;">
            <img src="${logoSrc}" style="height:130px; width:auto;" />
          </td>
        </tr>
      </table>
      <div style="border-bottom:3px solid ${config.primaryColor}; margin-top:12px;"></div>
    </div>
  `;
}

// ── PDF via Cloud Run ──────────────────────────────────────────────────────
async function generatePDFViaCloudRun(htmlContent, filename, headerTemplate) {
  const CLOUD_RUN_URL = "https://pdf-service-904705508663.us-central1.run.app/pdf";
  const response = await fetch(CLOUD_RUN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: htmlContent, filename, headerTemplate }),
  });
  if (!response.ok) throw new Error(`Cloud Run returned ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ── Invoice HTML template ──────────────────────────────────────────────────
function generatePDFHTML(items, customerName, invoiceNumber, invoiceDate, subtotal, tax, total) {
  let itemsHTML = "";
  if (items && items.length > 0) {
    itemsHTML = items.map((item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${item.rate}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${item.amount}</td>
      </tr>
    `).join("");
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; margin: 0; padding: 0; }
    .invoice-container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
      <div style="flex: 1;">
        <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">Bill To:</h3>
        <strong>${customerName}</strong>
      </div>
      <div style="flex: 1; text-align: right;">
        <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">Invoice Details:</h3>
        <strong>Invoice #:</strong> ${invoiceNumber}<br>
        <strong>Date:</strong> ${invoiceDate}
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
      <thead>
        <tr style="background: linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%); color: white;">
          <th style="padding: 12px; text-align: left; font-weight: 600;">Description</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Qty/Hours</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Rate/Price</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <table style="width: 100%; max-width: 300px; margin-left: auto; margin-bottom: 30px;">
      <tr>
        <td style="padding: 8px 0; text-align: right;">Subtotal:</td>
        <td style="padding: 8px 0; text-align: right; padding-left: 20px;">$${subtotal}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; text-align: right;">${config.taxName} (${Math.round(config.taxRate * 100)}%):</td>
        <td style="padding: 8px 0; text-align: right; padding-left: 20px;">$${tax}</td>
      </tr>
      <tr style="border-top: 2px solid ${config.primaryColor};">
        <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 18px;">Total:</td>
        <td style="padding: 12px 0; text-align: right; padding-left: 20px; font-weight: bold; font-size: 18px; color: ${config.primaryColor};">$${total}</td>
      </tr>
    </table>
    <div style="margin: 20px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid ${config.primaryColor};">
      <h3 style="color: ${config.primaryColor}; margin: 0 0 10px 0; font-size: 16px;">Payment Information</h3>
      <p style="margin: 8px 0; font-size: 13px; line-height: 1.5;">
        <strong>E-Transfer (Preferred):</strong> ${config.invoiceEmail}<br>
        <strong>Credit Card:</strong> See email for secure payment link<br>
        <strong>Cash/Cheque:</strong> Accepted in person
      </p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #6c757d; border-top: 1px solid #dee2e6; padding-top: 8px;">
        <strong>Payment due within ${config.paymentTermsDays} days</strong> • Questions? ${config.companyPhone}
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ── Quote HTML template ────────────────────────────────────────────────────
function generateQuotePDFHTML(items, customerName, quoteNumber, quoteDate, validUntil, subtotal, tax, total, notes) {
  let itemsHTML = "";
  if (items && items.length > 0) {
    itemsHTML = items.map((item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${item.rate}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${item.amount}</td>
      </tr>
    `).join("");
  }

  const notesSection = notes ? `
    <div style="margin: 20px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid ${config.primaryColor};">
      <h3 style="color: ${config.primaryColor}; margin: 0 0 10px 0; font-size: 16px;">Notes / Terms</h3>
      <p style="margin: 0; font-size: 13px; color: #2d3748; line-height: 1.5;">${notes}</p>
    </div>
  ` : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quote ${quoteNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; color: #2d3748; margin: 0; padding: 0; }
    .quote-container { max-width: 800px; margin: 0 auto; background: white; padding: 24px 30px 30px 30px; }
  </style>
</head>
<body>
  <div class="quote-container">
    <div style="display: flex; justify-content: space-between; margin-bottom: 22px;">
      <div style="flex: 1;">
        <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">Prepared For:</h3>
        <strong>${customerName}</strong>
      </div>
      <div style="flex: 1; text-align: right;">
        <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">Quote Details:</h3>
        <strong>Quote #:</strong> ${quoteNumber}<br>
        <strong>Date:</strong> ${quoteDate}<br>
        <strong>Valid Until:</strong> ${validUntil}<br>
        <span style="font-size: 12px; color: #718096;">Estimate — not an invoice</span>
      </div>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
      <thead>
        <tr style="background: linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%); color: white;">
          <th style="padding: 12px; text-align: left; font-weight: 600;">Description</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Qty/Hours</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Rate/Price</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <table style="width: 100%; max-width: 300px; margin-left: auto; margin-bottom: 22px;">
      <tr>
        <td style="padding: 8px 0; text-align: right;">Subtotal:</td>
        <td style="padding: 8px 0; text-align: right; padding-left: 20px;">$${subtotal}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; text-align: right;">${config.taxName} (${Math.round(config.taxRate * 100)}%):</td>
        <td style="padding: 8px 0; text-align: right; padding-left: 20px;">$${tax}</td>
      </tr>
      <tr style="border-top: 2px solid ${config.primaryColor};">
        <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 18px;">Estimated Total:</td>
        <td style="padding: 12px 0; text-align: right; padding-left: 20px; font-weight: bold; font-size: 18px; color: ${config.primaryColor};">$${total}</td>
      </tr>
    </table>
    ${notesSection}
    <div style="margin-top: 18px; padding: 12px 14px; background: #f8f9fa; border-radius: 6px;
                border-left: 4px solid ${config.primaryColor}; font-size: 12px; color: #64748b; line-height: 1.55;">
      <strong style="color: #2d3748;">Important:</strong> This is a quote, not an invoice. No payment is due until work is
      completed and a formal invoice is issued. Valid until <strong>${validUntil}</strong>.
      Final costs may vary if scope changes. Contact ${config.companyPhone} or ${config.companyEmail} to accept or discuss.
    </div>
  </div>
</body>
</html>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// RECURRING INVOICE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine whether a recurring invoice is due today.
 * Supports monthly, quarterly, and yearly frequencies.
 *
 * Rules:
 *   - If lastRun is null → run if today >= startDate
 *   - Otherwise          → run if today >= (lastRun + frequency period)
 *
 * @param {FirebaseFirestore.Timestamp|null} lastRun
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} frequency  'monthly' | 'quarterly' | 'yearly'
 * @returns {boolean}
 */
function isDue(lastRun, startDate, frequency) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!lastRun) {
    const start = new Date(startDate + "T00:00:00");
    return today >= start;
  }

  const lastRunDate = lastRun.toDate ? lastRun.toDate() : new Date(lastRun);
  lastRunDate.setHours(0, 0, 0, 0);

  const nextRun = new Date(lastRunDate);
  if (frequency === "monthly")   nextRun.setMonth(nextRun.getMonth() + 1);
  if (frequency === "quarterly") nextRun.setMonth(nextRun.getMonth() + 3);
  if (frequency === "yearly")    nextRun.setFullYear(nextRun.getFullYear() + 1);

  return today >= nextRun;
}

/**
 * Atomically increment the invoice counter and return the new invoice number.
 * Mirrors the logic in useInvoiceCounter.js but runs in the backend.
 */
async function generateNextInvoiceNumber() {
  const counterRef = admin.firestore().doc("counters/invoices");
  let invoiceNumber = "";

  await admin.firestore().runTransaction(async (t) => {
    const counterDoc = await t.get(counterRef);
    const count = (counterDoc.exists ? counterDoc.data().count : 0) + 1;
    t.set(counterRef, { count });
    const year   = new Date().getFullYear();
    const prefix = config.invoicePrefix || "TFS";
    invoiceNumber = `${prefix}-${year}-${count.toString().padStart(4, "0")}`;
  });

  return invoiceNumber;
}

/**
 * Build an items array from a recurring template's services.
 */
function buildItemsFromTemplate(template) {
  const items = [];
  template.services?.hourly?.forEach(s => {
    items.push({
      description: s.description,
      quantity:    s.hours,
      rate:        s.rate,
      amount:      s.total,
    });
  });
  template.services?.lineItems?.forEach(i => {
    items.push({
      description: i.description,
      quantity:    i.quantity,
      rate:        i.price,
      amount:      i.total,
    });
  });
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED FUNCTION: runRecurringInvoices
// Runs daily at 08:00 EST. Checks all active recurring templates and, for any
// that are due, creates a new invoice and optionally sends an email.
// ─────────────────────────────────────────────────────────────────────────────
exports.runRecurringInvoices = onSchedule(
  {
    schedule:  "0 8 * * *",          // daily at 08:00
    timeZone:  "America/Toronto",
    timeoutSeconds: 120,
    secrets: [zohoEmailPassword, stripeSecretKey],
  },
  async (_event) => {
    console.log("🔄 runRecurringInvoices: starting daily check");

    const db = admin.firestore();

    // Fetch all active recurring invoice templates
    const snapshot = await db.collection("recurringInvoices")
      .where("active", "==", true)
      .get();

    if (snapshot.empty) {
      console.log("✅ No active recurring invoices found.");
      return;
    }

    let processed = 0;
    let skipped   = 0;
    let errors    = 0;

    for (const docSnap of snapshot.docs) {
      const recurring   = docSnap.data();
      const recurringId = docSnap.id;

      try {
        if (!isDue(recurring.lastRun, recurring.startDate, recurring.frequency)) {
          skipped++;
          continue;
        }

        console.log(`📄 Creating recurring invoice for ${recurring.customer?.name} (${recurringId})`);

        // 1. Generate invoice number
        const invoiceNumber = await generateNextInvoiceNumber();

        // 2. Determine invoice date (today)
        const today          = new Date();
        const invoiceDateISO = today.toISOString().split("T")[0];
        const invoiceDateStr = today.toLocaleDateString("en-CA", {
          year: "numeric", month: "long", day: "numeric",
        });

        // 3. Create invoice document
        await db.collection("invoices").add({
          userId:    recurring.userId,
          customer:  recurring.customer,
          number:    invoiceNumber,
          date:      invoiceDateISO,
          services:  recurring.template.services,
          totals:    recurring.template.totals,
          status:    "unpaid",
          recurringId,                                // link back to template
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 4. Optionally send email with PDF
        if (recurring.sendEmail && recurring.customer?.email) {
          const { subtotal, taxAmount, finalTotal } = recurring.template.totals;
          const items = buildItemsFromTemplate(recurring.template);

          // Generate PDF via Cloud Run
          let pdfBuffer = null;
          try {
            const pdfHTML = generatePDFHTML(
              items,
              recurring.customer.name,
              invoiceNumber,
              invoiceDateStr,
              subtotal.toFixed(2),
              taxAmount.toFixed(2),
              finalTotal.toFixed(2)
            );
            const headerTemplate = await generateHeaderTemplate();
            pdfBuffer = await generatePDFViaCloudRun(
              pdfHTML,
              `Invoice-${invoiceNumber}.pdf`,
              headerTemplate
            );
          } catch (pdfErr) {
            console.error("⚠️ PDF generation failed for recurring invoice:", pdfErr);
          }

          // Build email HTML (same style as sendInvoiceEmail)
          let itemsHTML = "";
          if (items.length > 0) {
            itemsHTML = items.map(item => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity} × $${item.rate}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.amount}</td>
              </tr>
            `).join("");
          }

          const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invoiceNumber}</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid ${config.primaryColor};">
    <h1 style="color: ${config.primaryColor}; margin: 0; font-size: 28px;">${config.companyName}</h1>
    <p style="color: #666; margin: 5px 0;">${config.companyTagline}</p>
  </div>
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
    <h2 style="color: #333; margin: 0 0 15px 0; font-size: 24px;">Invoice ${invoiceNumber}</h2>
    <p style="margin: 5px 0;"><strong>Date:</strong> ${invoiceDateStr}</p>
    <p style="margin: 5px 0;"><strong>Bill To:</strong> ${recurring.customer.name}</p>
    <p style="margin: 5px 0; font-size: 13px; color: #888;">This is a recurring monthly invoice.</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
    <thead>
      <tr style="background: ${config.primaryColor}; color: white;">
        <th style="padding: 12px; text-align: left;">Description</th>
        <th style="padding: 12px; text-align: right;">Qty × Rate</th>
        <th style="padding: 12px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div style="text-align: right; margin-bottom: 30px;">
    <p style="margin: 10px 0; font-size: 16px;"><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</p>
    <p style="margin: 10px 0; font-size: 16px;"><strong>${config.taxName}:</strong> $${taxAmount.toFixed(2)}</p>
    <p style="margin: 10px 0; font-size: 20px; color: ${config.primaryColor};"><strong>Total: $${finalTotal.toFixed(2)}</strong></p>
  </div>
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${config.primaryColor}; margin-bottom: 30px;">
    <h3 style="margin: 0 0 10px 0; color: #333;">Payment Information</h3>
    <ul style="margin: 10px 0; padding-left: 20px;">
      <li><strong>📧 E-Transfer (Preferred):</strong> ${config.invoiceEmail}</li>
      <li><strong>💵 Cash or Cheque:</strong> (in person)</li>
    </ul>
    <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">
      <strong>Payment due within ${config.paymentTermsDays} days</strong>
    </p>
  </div>
  <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
    <p style="margin: 5px 0;"><strong>${config.companyName}</strong></p>
    <p style="margin: 5px 0;">📞 ${config.companyPhone} | 📧 ${config.invoiceEmail}</p>
    <p style="margin: 15px 0 5px 0;">Thank you for your business!</p>
  </div>
</body>
</html>`;

          const transporter = nodemailer.createTransport({
            host: "smtp.zohocloud.ca",
            port: 465,
            secure: true,
            auth: {
              user: config.companyEmail,
              pass: zohoEmailPassword.value(),
            },
          });

          const mailOptions = {
            from:    `${config.companyName} Invoices <${config.invoiceEmail}>`,
            to:      recurring.customer.email,
            subject: `Invoice ${invoiceNumber} from ${config.companyName}`,
            html:    emailHTML,
          };

          if (pdfBuffer) {
            mailOptions.attachments = [{
              filename:    `Invoice-${invoiceNumber}.pdf`,
              content:     pdfBuffer,
              contentType: "application/pdf",
            }];
          }

          await transporter.sendMail(mailOptions);
          console.log(`✅ Email sent for recurring invoice ${invoiceNumber} ${pdfBuffer ? "(with PDF)" : "(no PDF)"}`);
        }

        // 5. Update lastRun timestamp on the recurring template
        await docSnap.ref.update({
          lastRun: admin.firestore.FieldValue.serverTimestamp(),
        });

        processed++;
        console.log(`✅ Recurring invoice ${invoiceNumber} created for ${recurring.customer?.name}`);

      } catch (err) {
        errors++;
        console.error(`❌ Error processing recurring invoice ${recurringId}:`, err);
        // Continue processing other templates even if one fails
      }
    }

    console.log(
      `🏁 runRecurringInvoices complete: ${processed} created, ${skipped} skipped, ${errors} errors`
    );
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING FUNCTIONS — UNCHANGED BELOW
// ─────────────────────────────────────────────────────────────────────────────

exports.previewInvoicePDF = onCall(
  { timeoutSeconds: 60 },
  async (request) => {
    try {
      const { items, customerName, invoiceNumber, invoiceDate, subtotal, tax, total } = request.data;
      if (!invoiceNumber || !customerName) {
        throw new Error("Invoice number and customer name are required for preview");
      }
      const pdfHTML        = generatePDFHTML(items, customerName, invoiceNumber, invoiceDate, subtotal, tax, total);
      const headerTemplate = await generateHeaderTemplate();
      const pdfBuffer      = await generatePDFViaCloudRun(pdfHTML, `Invoice-${invoiceNumber}.pdf`, headerTemplate);
      const base64PDF      = pdfBuffer.toString("base64");
      console.log(`✅ Preview PDF generated for invoice ${invoiceNumber}`);
      return { success: true, pdfBase64: base64PDF, invoiceNumber };
    } catch (error) {
      console.error("❌ Preview PDF generation failed:", error);
      throw new Error(`Preview generation failed: ${error.message}`);
    }
  }
);

exports.previewQuotePDF = onCall(
  { timeoutSeconds: 60 },
  async (request) => {
    try {
      const { items, customerName, quoteNumber, quoteDate, validUntil, subtotal, tax, total, notes } = request.data;
      if (!quoteNumber || !customerName) {
        throw new Error("Quote number and customer name are required for preview");
      }
      const pdfHTML        = generateQuotePDFHTML(items, customerName, quoteNumber, quoteDate, validUntil, subtotal, tax, total, notes || "");
      const headerTemplate = await generateHeaderTemplate();
      const pdfBuffer      = await generatePDFViaCloudRun(pdfHTML, `Quote-${quoteNumber}.pdf`, headerTemplate);
      const base64PDF      = pdfBuffer.toString("base64");
      console.log(`✅ Preview PDF generated for quote ${quoteNumber}`);
      return { success: true, pdfBase64: base64PDF, quoteNumber };
    } catch (error) {
      console.error("❌ Quote preview PDF generation failed:", error);
      throw new Error(`Quote preview generation failed: ${error.message}`);
    }
  }
);

exports.sendQuoteEmail = onCall(
  { secrets: [zohoEmailPassword] },
  async (request) => {
    try {
      const { customerEmail, customerName, quoteNumber, quoteDate, validUntil, items, subtotal, tax, total, notes } = request.data;
      if (!customerEmail || !quoteNumber) throw new Error("Customer email and quote number are required");

      const transporter = nodemailer.createTransport({
        host: "smtp.zohocloud.ca", port: 465, secure: true,
        auth: { user: config.companyEmail, pass: zohoEmailPassword.value() },
      });

      let itemsHTML = "";
      if (items && items.length > 0) {
        itemsHTML = items.map((item) => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity} × $${item.rate}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.amount}</td>
          </tr>
        `).join("");
      }

      const notesHTML = notes ? `
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid ${config.primaryColor}; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; color: #333; font-size: 15px;">Notes / Terms</h3>
          <p style="margin: 0; color: #333; font-size: 14px; line-height: 1.6;">${notes}</p>
        </div>
      ` : "";

      const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quote ${quoteNumber}</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid ${config.primaryColor};">
    <h1 style="color: ${config.primaryColor}; margin: 0; font-size: 28px;">${config.companyName}</h1>
    <p style="color: #666; margin: 5px 0;">${config.companyTagline}</p>
  </div>
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid ${config.primaryColor};">
    <h2 style="color: #333; margin: 0 0 12px 0; font-size: 22px;">Quote ${quoteNumber}</h2>
    <p style="margin: 5px 0;"><strong>Prepared for:</strong> ${customerName}</p>
    <p style="margin: 5px 0;"><strong>Date:</strong> ${quoteDate}</p>
    <p style="margin: 5px 0;"><strong>Valid until:</strong> ${validUntil}</p>
    <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">Estimate — not an invoice. No payment due until work is completed and an invoice is issued.</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <thead>
      <tr style="background: ${config.primaryColor}; color: white;">
        <th style="padding: 12px; text-align: left;">Description</th>
        <th style="padding: 12px; text-align: right;">Qty × Rate</th>
        <th style="padding: 12px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div style="text-align: right; margin-bottom: 24px;">
    <p style="margin: 8px 0; font-size: 15px;"><strong>Subtotal:</strong> $${subtotal}</p>
    <p style="margin: 8px 0; font-size: 15px;"><strong>${config.taxName} (${Math.round(config.taxRate * 100)}%):</strong> $${tax}</p>
    <p style="margin: 8px 0; font-size: 22px; color: ${config.primaryColor};"><strong>Estimated total: $${total}</strong></p>
  </div>
  ${notesHTML}
  <div style="background: #f8f9fa; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; color: #64748b; border-left: 4px solid ${config.primaryColor};">
    <strong style="color: #333;">Please note:</strong> This is a quote, not an invoice. No payment is required at this time.
    Once you approve the work, we will proceed and issue a formal invoice upon completion.
    Reply to this email or contact us below to accept or discuss.
  </div>
  <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
    <p style="margin: 5px 0;"><strong>${config.companyName}</strong></p>
    <p style="margin: 5px 0;">${config.location}</p>
    <p style="margin: 5px 0;">📞 ${config.companyPhone} | 📧 ${config.companyEmail}</p>
    <p style="margin: 15px 0 5px 0;">Thank you for considering us for your project!</p>
  </div>
</body>
</html>`;

      const pdfHTML = generateQuotePDFHTML(items, customerName, quoteNumber, quoteDate, validUntil, subtotal, tax, total, notes || "");
      let pdfBuffer = null;
      try {
        const headerTemplate = await generateHeaderTemplate();
        pdfBuffer = await generatePDFViaCloudRun(pdfHTML, `Quote-${quoteNumber}.pdf`, headerTemplate);
      } catch (pdfError) {
        console.error("⚠️ Quote PDF generation failed:", pdfError);
      }

      const mailOptions = {
        from: `${config.companyName} <${config.companyEmail}>`,
        to: customerEmail,
        subject: `Quote ${quoteNumber} from ${config.companyName}`,
        html: emailHTML,
      };
      if (pdfBuffer) {
        mailOptions.attachments = [{
          filename: `Quote-${quoteNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf",
        }];
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Quote email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId, pdfAttached: !!pdfBuffer };
    } catch (error) {
      console.error("Error sending quote email:", error);
      throw new Error(`Unable to send quote email: ${error.message}`);
    }
  }
);

exports.createCheckoutSession = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    const stripe = require("stripe")(stripeSecretKey.value());
    try {
      const { amount, invoiceNumber, customerEmail } = request.data;
      if (!amount || amount <= 0) throw new Error("Invalid payment amount");
      if (!invoiceNumber) throw new Error("Invoice number is required");
      const amountInCents = Math.round(amount * 100);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "cad",
            product_data: { name: `Invoice ${invoiceNumber}`, description: `${config.companyName} - ${config.companyTagline}` },
            unit_amount: amountInCents,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${config.portalUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${config.portalUrl}?payment=cancelled`,
        customer_email: customerEmail || undefined,
        metadata: { invoiceNumber, userId: request.auth.uid },
      });
      await admin.firestore().collection("payment_attempts").add({
        userId: request.auth.uid, invoiceNumber, amount, sessionId: session.id,
        status: "pending", createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { sessionId: session.id, url: session.url };
    } catch (error) {
      console.error("Error creating checkout session:", error);
      throw new Error(`Unable to create payment session: ${error.message}`);
    }
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    const stripe = require("stripe")(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const paymentsSnapshot = await admin.firestore().collection("payment_attempts")
          .where("sessionId", "==", session.id).limit(1).get();
        if (!paymentsSnapshot.empty) {
          const paymentDoc = paymentsSnapshot.docs[0];
          await paymentDoc.ref.update({ status: "completed", paidAt: admin.firestore.FieldValue.serverTimestamp(), paymentIntentId: session.payment_intent });
          const invoicesSnapshot = await admin.firestore().collection("invoices")
            .where("invoiceNumber", "==", session.metadata.invoiceNumber).limit(1).get();
          if (!invoicesSnapshot.empty) {
            await invoicesSnapshot.docs[0].ref.update({ status: "paid", paidAt: admin.firestore.FieldValue.serverTimestamp(), paymentMethod: "stripe", stripeSessionId: session.id });
          }
        }
        break;
      }
      case "checkout.session.expired": {
        const expiredSession = event.data.object;
        const expiredSnapshot = await admin.firestore().collection("payment_attempts")
          .where("sessionId", "==", expiredSession.id).limit(1).get();
        if (!expiredSnapshot.empty) {
          await expiredSnapshot.docs[0].ref.update({ status: "expired", expiredAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    res.json({ received: true });
  }
);

exports.sendInvoiceEmail = onCall(
  { secrets: [zohoEmailPassword, stripeSecretKey] },
  async (request) => {
    try {
      const { customerEmail, customerName, invoiceNumber, invoiceDate, items, subtotal, tax, total, amount } = request.data;
      if (!customerEmail || !invoiceNumber) throw new Error("Customer email and invoice number are required");

      const stripe = require("stripe")(stripeSecretKey.value());
      let stripePaymentUrl = "";
      try {
        const amountInCents = Math.round(amount * 100);
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [{
            price_data: {
              currency: "cad",
              product_data: { name: `Invoice ${invoiceNumber}`, description: `${config.companyName} - ${config.companyTagline}` },
              unit_amount: amountInCents,
            },
            quantity: 1,
          }],
          mode: "payment",
          success_url: `${config.portalUrl}?payment=success`,
          cancel_url:  `${config.portalUrl}?payment=cancelled`,
          customer_email: customerEmail,
          metadata: { invoiceNumber, userId: request.auth.uid },
        });
        stripePaymentUrl = session.url;
      } catch (stripeError) {
        console.error("⚠️ Stripe link creation failed:", stripeError);
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.zohocloud.ca", port: 465, secure: true,
        auth: { user: config.companyEmail, pass: zohoEmailPassword.value() },
      });

      let itemsHTML = "";
      if (items && items.length > 0) {
        itemsHTML = items.map((item) => `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.quantity} × $${item.rate}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.amount}</td>
          </tr>
        `).join("");
      }

      const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invoiceNumber}</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid ${config.primaryColor};">
    <h1 style="color: ${config.primaryColor}; margin: 0; font-size: 28px;">${config.companyName}</h1>
    <p style="color: #666; margin: 5px 0;">${config.companyTagline}</p>
  </div>
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
    <h2 style="color: #333; margin: 0 0 15px 0; font-size: 24px;">Invoice ${invoiceNumber}</h2>
    <p style="margin: 5px 0;"><strong>Date:</strong> ${invoiceDate}</p>
    <p style="margin: 5px 0;"><strong>Bill To:</strong> ${customerName}</p>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
    <thead>
      <tr style="background: ${config.primaryColor}; color: white;">
        <th style="padding: 12px; text-align: left;">Description</th>
        <th style="padding: 12px; text-align: right;">Qty × Rate</th>
        <th style="padding: 12px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>
  <div style="text-align: right; margin-bottom: 30px;">
    <p style="margin: 10px 0; font-size: 16px;"><strong>Subtotal:</strong> $${subtotal}</p>
    <p style="margin: 10px 0; font-size: 16px;"><strong>${config.taxName} (${Math.round(config.taxRate * 100)}%):</strong> $${tax}</p>
    <p style="margin: 10px 0; font-size: 20px; color: ${config.primaryColor};"><strong>Total:</strong> $${total}</p>
  </div>
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid ${config.primaryColor}; margin-bottom: 30px;">
    <h3 style="margin: 0 0 10px 0; color: #333;">Payment Information</h3>
    <ul style="margin: 10px 0; padding-left: 20px;">
      <li><strong>📧 E-Transfer (Preferred):</strong> ${config.invoiceEmail}</li>
      ${stripePaymentUrl ? `
      <li><strong>💳 Credit Card:</strong>
        <a href="${stripePaymentUrl}" style="display: inline-block; margin-top: 8px; background: linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%); color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Pay $${total} with Card →
        </a>
        <br><span style="font-size: 12px; color: #666;">Secure payment powered by Stripe</span>
      </li>` : "<li>Credit Card (payment link unavailable)</li>"}
      <li><strong>💵 Cash or Cheque:</strong> (in person)</li>
    </ul>
    <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;"><strong>Payment due within ${config.paymentTermsDays} days</strong></p>
  </div>
  <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
    <p style="margin: 5px 0;"><strong>${config.companyName}</strong></p>
    <p style="margin: 5px 0;">${config.location}</p>
    <p style="margin: 5px 0;">📞 ${config.companyPhone} | 📧 ${config.invoiceEmail}</p>
    <p style="margin: 15px 0 5px 0;">Thank you for your business!</p>
  </div>
</body>
</html>`;

      const pdfHTML = generatePDFHTML(items, customerName, invoiceNumber, invoiceDate, subtotal, tax, total);
      let pdfBuffer = null;
      try {
        const headerTemplate = await generateHeaderTemplate();
        pdfBuffer = await generatePDFViaCloudRun(pdfHTML, `Invoice-${invoiceNumber}.pdf`, headerTemplate);
      } catch (pdfError) {
        console.error("⚠️ PDF generation failed, sending email without attachment:", pdfError);
      }

      const mailOptions = {
        from:    `${config.companyName} Invoices <${config.invoiceEmail}>`,
        to:      customerEmail,
        subject: `Invoice ${invoiceNumber} from ${config.companyName}`,
        html:    emailHTML,
      };
      if (pdfBuffer) {
        mailOptions.attachments = [{
          filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf",
        }];
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Invoice email sent ${pdfBuffer ? "with PDF" : "without PDF"}: ${info.messageId}`);
      return { success: true, messageId: info.messageId, pdfAttached: !!pdfBuffer };
    } catch (error) {
      console.error("Error sending invoice email:", error);
      throw new Error(`Unable to send email: ${error.message}`);
    }
  }
);
