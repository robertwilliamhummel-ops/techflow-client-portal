/**
 * CLIENT CONFIGURATION — functions/config.js
 *
 * This is the ONLY file you need to edit when white-labelling for a new client.
 * All hardcoded business values in index.js are imported from here.
 */

module.exports = {
  // Company identity
  companyName:        "TechFlow Solutions",
  companyTagline:     "IT Services & Business Automation in Toronto",
  companyPhone:       "(647) 572-8341",
  companyEmail:       "info@techflowsolutions.ca",
  invoiceEmail:       "invoices@techflowsolutions.ca",

  // Logo — must be publicly accessible URL
  logoUrl: "https://techflowsolutions.ca/assets/images/TechFlow%20Solutions%20Logo-%20Cropped.png",

  // Branding
  primaryColor: "#667eea",

  // Portal URL — used for Stripe redirect after payment
  portalUrl: "https://portal.techflowsolutions.ca",

  // Invoice settings
  paymentTermsDays: 15,
  invoicePrefix:    "TFS",
  taxRate:          0.13,
  taxName:          "HST",
};
