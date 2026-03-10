// ============================================
// CLIENT CONFIGURATION — EDIT THIS TO CLONE
// ============================================
const clientConfig = {
  // Company info
  companyName: "TechFlow Solutions",
  companyTagline: "Website Design & IT Services",
  companyPhone: "(647) 572-8341",
  companyEmail: "info@techflowsolutions.ca",
  primaryColor: "#667eea",
  secondaryColor: "#764ba2",
  logoUrl: "/logo.png",

  // Invoice system config
  invoiceEmail: "invoices@techflowsolutions.ca",   // e-transfer + from address
  invoicePrefix: "TFS",                             // TFS-2026-0001
  taxRate: 0,                                       // 0 now, change to 0.13 when HST registered
  taxName: "HST (13%)",
  currency: "CAD",
  paymentTermsDays: 15,
  location: "Greater Toronto Area",
  portalUrl: "https://portal.techflowsolutions.ca",
  stripeEnabled: true,
};

export default clientConfig;
