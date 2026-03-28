const {onCall} = require("firebase-functions/v2/https");
const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const config = require("./config");

// Define secrets (modern approach)
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const zohoEmailPassword = defineSecret("ZOHO_EMAIL_PASSWORD");

admin.initializeApp();

// Cache logo as base64 data URL for reliable Puppeteer header rendering
let cachedLogoDataUrl = null;

async function getLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;

  const res = await fetch(config.logoUrl);

  if (!res.ok) {
    throw new Error(`Logo fetch failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "image/png";
  const arrayBuf = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString("base64");

  cachedLogoDataUrl = `data:${contentType};base64,${base64}`;
  return cachedLogoDataUrl;
}

/**
 * Generate Puppeteer header template for repeating headers
 * Uses base64-embedded logo for reliable rendering
 */
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
            <img src="${logoSrc}"
                 style="height:130px; width:auto;" />
          </td>
        </tr>
      </table>
      <div style="border-bottom:3px solid ${config.primaryColor}; margin-top:12px;"></div>
    </div>
  `;
}

/**
 * Generate PDF using Cloud Run service
 */
async function generatePDFViaCloudRun(htmlContent, filename, headerTemplate) {
  const CLOUD_RUN_URL = "https://pdf-service-904705508663.us-central1.run.app/pdf";

  try {
    console.log("📄 Calling Cloud Run PDF service...");

    const response = await fetch(CLOUD_RUN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html: htmlContent,
        filename,
        headerTemplate,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloud Run returned ${response.status}`);
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    console.log("✅ PDF received from Cloud Run");

    return pdfBuffer;
  } catch (error) {
    console.error("❌ Cloud Run PDF generation failed:", error);
    throw error;
  }
}

/**
 * Generate Invoice PDF HTML
 * Single source of truth for invoice PDF layout
 */
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

/**
 * Generate Quote PDF HTML
 * Separate template for quotes — says QUOTE, shows Valid Until, has disclaimer footer
 */
function generateQuotePDFHTML(
  items, customerName, quoteNumber, quoteDate, validUntil, subtotal, tax, total, notes
) {
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
    <div style="margin: 20px 0; padding: 14px; background: #fffbeb; border-radius: 6px; border-left: 4px solid #f59e0b;">
      <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px;">Notes / Terms</h3>
      <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;">${notes}</p>
    </div>
  ` : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quote ${quoteNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #2d3748; margin: 0; padding: 0; }
    .quote-container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; }
  </style>
</head>
<body>
  <div class="quote-container">

    <!-- QUOTE Header Banner -->
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;
                padding: 12px 20px; border-radius: 8px; margin-bottom: 24px;
                display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 28px; font-weight: 900; letter-spacing: 2px;">QUOTE</div>
        <div style="font-size: 13px; opacity: 0.85;">Estimate — Not an Invoice</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 20px; font-weight: 700;">${quoteNumber}</div>
        <div style="font-size: 13px; opacity: 0.85;">Date: ${quoteDate}</div>
      </div>
    </div>

    <!-- Valid Until Notice -->
    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px;
                padding: 12px 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 20px;">📅</div>
      <div>
        <div style="font-size: 13px; color: #92400e; font-weight: 600; margin-bottom: 2px;">Quote Valid Until</div>
        <div style="font-size: 18px; font-weight: 700; color: #c2410c;">${validUntil}</div>
      </div>
    </div>

    <!-- Bill To / Details -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
      <div style="flex: 1;">
        <h3 style="color: #4a5568; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Prepared For</h3>
        <strong style="font-size: 16px;">${customerName}</strong>
      </div>
      <div style="flex: 1; text-align: right;">
        <h3 style="color: #4a5568; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Prepared By</h3>
        <strong style="font-size: 16px;">${config.companyName}</strong><br>
        <span style="font-size: 13px; color: #718096;">${config.companyPhone}</span><br>
        <span style="font-size: 13px; color: #718096;">${config.companyEmail}</span>
      </div>
    </div>

    <!-- Line Items -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;">
          <th style="padding: 12px; text-align: left; font-weight: 600;">Description</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Qty/Hours</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Rate/Price</th>
          <th style="padding: 12px; text-align: right; font-weight: 600;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>

    <!-- Totals -->
    <table style="width: 100%; max-width: 300px; margin-left: auto; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0; text-align: right; color: #4a5568;">Subtotal:</td>
        <td style="padding: 8px 0; text-align: right; padding-left: 20px;">$${subtotal}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; text-align: right; color: #4a5568;">${config.taxName}:</td>
        <td style="padding: 8px 0; text-align: right; padding-left: 20px;">$${tax}</td>
      </tr>
      <tr style="border-top: 2px solid #f59e0b;">
        <td style="padding: 12px 0; text-align: right; font-weight: bold; font-size: 16px; color: #92400e;">Estimated Total:</td>
        <td style="padding: 12px 0; text-align: right; padding-left: 20px; font-weight: bold; font-size: 20px; color: #d97706;">$${total}</td>
      </tr>
    </table>

    ${notesSection}

    <!-- Disclaimer Footer -->
    <div style="margin-top: 30px; padding: 14px 16px; background: #f1f5f9; border-radius: 6px;
                border-top: 3px solid #cbd5e1; font-size: 12px; color: #64748b; line-height: 1.6;">
      <strong style="color: #475569;">Important:</strong> This is a quote, not an invoice. No payment is due until work is
      completed and a formal invoice is issued. This quote is valid until <strong>${validUntil}</strong>.
      Final costs may vary if scope of work changes. To accept or discuss this quote, please contact us at
      ${config.companyPhone} or ${config.companyEmail}.
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * Preview Invoice PDF
 * Generates real Puppeteer PDF for preview in frontend
 */
exports.previewInvoicePDF = onCall(
  { timeoutSeconds: 60 },
  async (request) => {
    try {
      const {
        items,
        customerName,
        invoiceNumber,
        invoiceDate,
        subtotal,
        tax,
        total,
      } = request.data;

      if (!invoiceNumber || !customerName) {
        throw new Error("Invoice number and customer name are required for preview");
      }

      const pdfHTML = generatePDFHTML(
        items, customerName, invoiceNumber, invoiceDate, subtotal, tax, total
      );

      const headerTemplate = await generateHeaderTemplate();
      const pdfBuffer = await generatePDFViaCloudRun(pdfHTML, `Invoice-${invoiceNumber}.pdf`, headerTemplate);
      const base64PDF = pdfBuffer.toString("base64");

      console.log(`✅ Preview PDF generated for invoice ${invoiceNumber}`);

      return {
        success: true,
        pdfBase64: base64PDF,
        invoiceNumber,
      };
    } catch (error) {
      console.error("❌ Preview PDF generation failed:", error);
      throw new Error(`Preview generation failed: ${error.message}`);
    }
  }
);

/**
 * Preview Quote PDF
 * Generates quote PDF with QUOTE template for preview in frontend
 */
exports.previewQuotePDF = onCall(
  { timeoutSeconds: 60 },
  async (request) => {
    try {
      const {
        items,
        customerName,
        quoteNumber,
        quoteDate,
        validUntil,
        subtotal,
        tax,
        total,
        notes,
      } = request.data;

      if (!quoteNumber || !customerName) {
        throw new Error("Quote number and customer name are required for preview");
      }

      const pdfHTML = generateQuotePDFHTML(
        items, customerName, quoteNumber, quoteDate, validUntil, subtotal, tax, total, notes || ""
      );

      const headerTemplate = await generateHeaderTemplate();
      const pdfBuffer = await generatePDFViaCloudRun(pdfHTML, `Quote-${quoteNumber}.pdf`, headerTemplate);
      const base64PDF = pdfBuffer.toString("base64");

      console.log(`✅ Preview PDF generated for quote ${quoteNumber}`);

      return {
        success: true,
        pdfBase64: base64PDF,
        quoteNumber,
      };
    } catch (error) {
      console.error("❌ Quote preview PDF generation failed:", error);
      throw new Error(`Quote preview generation failed: ${error.message}`);
    }
  }
);

/**
 * Send Quote Email
 * Called from frontend when user clicks "Send Quote"
 * No Stripe — quotes are not invoices
 */
exports.sendQuoteEmail = onCall(
  {secrets: [zohoEmailPassword]},
  async (request) => {
    try {
      const {
        customerEmail,
        customerName,
        quoteNumber,
        quoteDate,
        validUntil,
        items,
        subtotal,
        tax,
        total,
        notes,
      } = request.data;

      if (!customerEmail || !quoteNumber) {
        throw new Error("Customer email and quote number are required");
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.zohocloud.ca",
        port: 465,
        secure: true,
        auth: {
          user: config.companyEmail,
          pass: zohoEmailPassword.value(),
        },
      });

      // Build items HTML for email
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
        <div style="background: #fffbeb; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px 0; color: #92400e; font-size: 15px;">Notes / Terms</h3>
          <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.6;">${notes}</p>
        </div>
      ` : "";

      const emailHTML = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Quote ${quoteNumber}</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #f59e0b;">
    <h1 style="color: ${config.primaryColor}; margin: 0; font-size: 28px;">${config.companyName}</h1>
    <p style="color: #666; margin: 5px 0;">${config.companyTagline}</p>
  </div>

  <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 16px 20px;
              border-radius: 10px; margin-bottom: 24px;">
    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.85; margin-bottom: 4px;">Quote / Estimate</div>
    <div style="font-size: 22px; font-weight: 700;">${quoteNumber}</div>
  </div>

  <div style="background: #f8f9fa; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
    <p style="margin: 4px 0;"><strong>Prepared for:</strong> ${customerName}</p>
    <p style="margin: 4px 0;"><strong>Date:</strong> ${quoteDate}</p>
    <p style="margin: 4px 0;"><strong>Valid Until:</strong> <span style="color: #c2410c; font-weight: 700;">${validUntil}</span></p>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
    <thead>
      <tr style="background: #f59e0b; color: white;">
        <th style="padding: 12px; text-align: left;">Description</th>
        <th style="padding: 12px; text-align: right;">Qty × Rate</th>
        <th style="padding: 12px; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <div style="text-align: right; margin-bottom: 24px;">
    <p style="margin: 8px 0; font-size: 15px;"><strong>Subtotal:</strong> $${subtotal}</p>
    <p style="margin: 8px 0; font-size: 15px;"><strong>${config.taxName}:</strong> $${tax}</p>
    <p style="margin: 8px 0; font-size: 22px; color: #d97706;"><strong>Estimated Total: $${total}</strong></p>
  </div>

  ${notesHTML}

  <div style="background: #f1f5f9; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; color: #64748b;">
    <strong style="color: #475569;">Please Note:</strong> This is a quote, not an invoice. No payment is required at this time.
    Once you approve the work, we will proceed and issue a formal invoice upon completion.
    To accept or discuss this quote, reply to this email or contact us below.
  </div>

  <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
    <p style="margin: 5px 0;"><strong>${config.companyName}</strong></p>
    <p style="margin: 5px 0;">${config.location}</p>
    <p style="margin: 5px 0;">📞 ${config.companyPhone} | 📧 ${config.companyEmail}</p>
    <p style="margin: 15px 0 5px 0;">Thank you for considering us for your project!</p>
  </div>

</body>
</html>
      `;

      // Generate PDF attachment
      const pdfHTML = generateQuotePDFHTML(
        items, customerName, quoteNumber, quoteDate, validUntil, subtotal, tax, total, notes || ""
      );
      let pdfBuffer = null;
      try {
        console.log("📄 Generating quote PDF via Cloud Run...");
        const headerTemplate = await generateHeaderTemplate();
        pdfBuffer = await generatePDFViaCloudRun(pdfHTML, `Quote-${quoteNumber}.pdf`, headerTemplate);
        console.log("✅ Quote PDF generated successfully");
      } catch (pdfError) {
        console.error("⚠️ Quote PDF generation failed, sending email without attachment:", pdfError);
      }

      const mailOptions = {
        from: `${config.companyName} <${config.companyEmail}>`,
        to: customerEmail,
        subject: `Quote ${quoteNumber} from ${config.companyName}`,
        html: emailHTML,
      };

      if (pdfBuffer) {
        mailOptions.attachments = [
          {
            filename: `Quote-${quoteNumber}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ];
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Quote email sent ${pdfBuffer ? "with PDF" : "without PDF"}: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
        pdfAttached: !!pdfBuffer,
      };
    } catch (error) {
      console.error("Error sending quote email:", error);
      throw new Error(`Unable to send quote email: ${error.message}`);
    }
  }
);

/**
 * Create Stripe Checkout Session
 * Called from frontend when customer clicks "Pay" button
 */
exports.createCheckoutSession = onCall(
  {secrets: [stripeSecretKey]},
  async (request) => {
    const stripe = require("stripe")(stripeSecretKey.value());

    try {
      const {amount, invoiceNumber, customerEmail} = request.data;

      if (!amount || amount <= 0) throw new Error("Invalid payment amount");
      if (!invoiceNumber) throw new Error("Invoice number is required");

      const amountInCents = Math.round(amount * 100);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "cad",
              product_data: {
                name: `Invoice ${invoiceNumber}`,
                description: `${config.companyName} - ${config.companyTagline}`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${config.portalUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${config.portalUrl}?payment=cancelled`,
        customer_email: customerEmail || undefined,
        metadata: {
          invoiceNumber: invoiceNumber,
          userId: request.auth.uid,
        },
      });

      await admin.firestore().collection("payment_attempts").add({
        userId: request.auth.uid,
        invoiceNumber: invoiceNumber,
        amount: amount,
        sessionId: session.id,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error) {
      console.error("Error creating checkout session:", error);
      throw new Error(`Unable to create payment session: ${error.message}`);
    }
  }
);

/**
 * Stripe Webhook Handler
 * Listens for payment confirmations from Stripe
 */
exports.stripeWebhook = onRequest(
  {secrets: [stripeSecretKey, stripeWebhookSecret]},
  async (req, res) => {
    const stripe = require("stripe")(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value(),
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        const paymentsSnapshot = await admin.firestore()
          .collection("payment_attempts")
          .where("sessionId", "==", session.id)
          .limit(1)
          .get();

        if (!paymentsSnapshot.empty) {
          const paymentDoc = paymentsSnapshot.docs[0];
          await paymentDoc.ref.update({
            status: "completed",
            paidAt: admin.firestore.FieldValue.serverTimestamp(),
            paymentIntentId: session.payment_intent,
          });

          const invoiceNumber = session.metadata.invoiceNumber;
          const invoicesSnapshot = await admin.firestore()
            .collection("invoices")
            .where("invoiceNumber", "==", invoiceNumber)
            .limit(1)
            .get();

          if (!invoicesSnapshot.empty) {
            const invoiceDoc = invoicesSnapshot.docs[0];
            await invoiceDoc.ref.update({
              status: "paid",
              paidAt: admin.firestore.FieldValue.serverTimestamp(),
              paymentMethod: "stripe",
              stripeSessionId: session.id,
            });
          }
        }

        console.log(`Payment completed for session ${session.id}`);
        break;
      }

      case "checkout.session.expired": {
        const expiredSession = event.data.object;

        const expiredSnapshot = await admin.firestore()
          .collection("payment_attempts")
          .where("sessionId", "==", expiredSession.id)
          .limit(1)
          .get();

        if (!expiredSnapshot.empty) {
          const paymentDoc = expiredSnapshot.docs[0];
          await paymentDoc.ref.update({
            status: "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        console.log(`Payment session expired: ${expiredSession.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({received: true});
  }
);

/**
 * Send Invoice Email
 * Called from frontend when user clicks "Send Invoice"
 */
exports.sendInvoiceEmail = onCall(
  {secrets: [zohoEmailPassword, stripeSecretKey]},
  async (request) => {
    try {
      const {
        customerEmail,
        customerName,
        invoiceNumber,
        invoiceDate,
        items,
        subtotal,
        tax,
        total,
        amount,
      } = request.data;

      if (!customerEmail || !invoiceNumber) {
        throw new Error("Customer email and invoice number are required");
      }

      // Create Stripe payment link
      const stripe = require("stripe")(stripeSecretKey.value());
      let stripePaymentUrl = "";

      try {
        const amountInCents = Math.round(amount * 100);
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "cad",
                product_data: {
                  name: `Invoice ${invoiceNumber}`,
                  description: `${config.companyName} - ${config.companyTagline}`,
                },
                unit_amount: amountInCents,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `${config.portalUrl}?payment=success`,
          cancel_url:  `${config.portalUrl}?payment=cancelled`,
          customer_email: customerEmail,
          metadata: {
            invoiceNumber: invoiceNumber,
            userId: request.auth.uid,
          },
        });

        stripePaymentUrl = session.url;
        console.log("✅ Stripe payment link created:", stripePaymentUrl);
      } catch (stripeError) {
        console.error("⚠️ Stripe link creation failed:", stripeError);
      }

      const transporter = nodemailer.createTransport({
        host: "smtp.zohocloud.ca",
        port: 465,
        secure: true,
        auth: {
          user: config.companyEmail,
          pass: zohoEmailPassword.value(),
        },
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
        <a href="${stripePaymentUrl}"
           style="display: inline-block; margin-top: 8px; background: linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%);
                  color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Pay $${total} with Card →
        </a>
        <br><span style="font-size: 12px; color: #666;">Secure payment powered by Stripe</span>
      </li>
      ` : "<li>Credit Card (payment link unavailable)</li>"}
      <li><strong>💵 Cash or Cheque:</strong> (in person)</li>
    </ul>
    <p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">
      <strong>Payment due within ${config.paymentTermsDays} days</strong>
    </p>
  </div>

  <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
    <p style="margin: 5px 0;"><strong>${config.companyName}</strong></p>
    <p style="margin: 5px 0;">${config.location}</p>
    <p style="margin: 5px 0;">📞 ${config.companyPhone} | 📧 ${config.invoiceEmail}</p>
    <p style="margin: 15px 0 5px 0;">Thank you for your business!</p>
  </div>

</body>
</html>
      `;

      const pdfHTML = generatePDFHTML(items, customerName, invoiceNumber, invoiceDate, subtotal, tax, total);
      let pdfBuffer = null;
      try {
        console.log("📄 Generating PDF via Cloud Run...");
        const headerTemplate = await generateHeaderTemplate();
        pdfBuffer = await generatePDFViaCloudRun(pdfHTML, `Invoice-${invoiceNumber}.pdf`, headerTemplate);
        console.log("✅ PDF generated successfully");
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
        mailOptions.attachments = [
          {
            filename:    `Invoice-${invoiceNumber}.pdf`,
            content:     pdfBuffer,
            contentType: "application/pdf",
          },
        ];
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`✅ Invoice email sent ${pdfBuffer ? "with PDF" : "without PDF"}: ${info.messageId}`);

      return {
        success:     true,
        messageId:   info.messageId,
        pdfAttached: !!pdfBuffer,
      };
    } catch (error) {
      console.error("Error sending invoice email:", error);
      throw new Error(`Unable to send email: ${error.message}`);
    }
  }
);
