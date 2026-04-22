// Narrative pool for the "Aegean Systems Ltd." demo business — a
// fictional Athens-based tech consultancy. Clients span US big-tech,
// EU cross-border B2B, and GR domestic; suppliers match a real tech
// SME's cost base (cloud, hardware, office, travel, payroll). All
// strings are hardcoded English (demo is a single showcase, not an
// i18n fixture). VAT numbers follow EU-prefixed format where applicable
// and are synthetic — valid shape, no real allocation.

export interface ClientSeed {
  company: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  countryCode: string; // ISO-3166-1 alpha-2
  vat: string | null; // EU-prefixed ("EL…", "DE…"); null for non-EU + individuals
  classification: "individual" | "business" | "government";
  paymentTerms: number;
}

export interface SupplierSeed {
  company: string;
  email: string;
  phone: string;
  countryCode: string;
  vat: string | null;
  classification: "business";
  category: string;
}

export interface ProductSeed {
  name: string;
  description: string;
  unitPrice: string;
  unit: "hour" | "item" | "day" | "service" | "kg" | "unit";
  taxCategory: "standard" | "reduced" | "super_reduced";
}

export const DEMO_ORG = {
  name: "Aegean Systems Ltd.",
  slug: "aegean-systems",
  taxId: "800123456",
  taxAuthority: "Athens 1st FAE",
  countryCode: "GR",
  defaultCurrency: "EUR",
  addressLine1: "15 Themistokleous Street",
  city: "Athens",
  postalCode: "10677",
  region: "Attica",
  phone: "+30 210 330 4000",
};

export const CLIENTS: ClientSeed[] = [
  // --- Non-EU big tech (4) — 0% VAT, no VAT number on invoice
  {
    company: "OpenAI, Inc.",
    email: "ap@openai.example",
    phone: "+1 415 555 0100",
    addressLine1: "3180 18th Street",
    city: "San Francisco",
    postalCode: "94110",
    countryCode: "US",
    vat: null,
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "Google LLC",
    email: "billing-emea@google.example",
    phone: "+1 650 253 0000",
    addressLine1: "1600 Amphitheatre Parkway",
    city: "Mountain View",
    postalCode: "94043",
    countryCode: "US",
    vat: null,
    classification: "business",
    paymentTerms: 45,
  },
  {
    company: "Amazon Web Services, Inc.",
    email: "aws-vendor@amazon.example",
    phone: "+1 206 266 1000",
    addressLine1: "410 Terry Avenue North",
    city: "Seattle",
    postalCode: "98109",
    countryCode: "US",
    vat: null,
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "Stripe, Inc.",
    email: "vendors@stripe.example",
    phone: "+1 888 963 8955",
    addressLine1: "510 Townsend Street",
    city: "San Francisco",
    postalCode: "94103",
    countryCode: "US",
    vat: null,
    classification: "business",
    paymentTerms: 30,
  },

  // --- EU cross-border B2B (4) — 0% VAT, valid EU VAT numbers
  {
    company: "Spotify AB",
    email: "ap@spotify.example",
    phone: "+46 8 553 310 00",
    addressLine1: "Regeringsgatan 19",
    city: "Stockholm",
    postalCode: "11153",
    countryCode: "SE",
    vat: "SE556703748501",
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "SAP SE",
    email: "ap-emea@sap.example",
    phone: "+49 6227 7 47474",
    addressLine1: "Dietmar-Hopp-Allee 16",
    city: "Walldorf",
    postalCode: "69190",
    countryCode: "DE",
    vat: "DE143454214",
    classification: "business",
    paymentTerms: 45,
  },
  {
    company: "Datadog EMEA Ltd.",
    email: "vendors@datadog.example",
    phone: "+353 1 800 10 20",
    addressLine1: "2 Burlington Plaza",
    city: "Dublin",
    postalCode: "D04C5Y6",
    countryCode: "IE",
    vat: "IE3568952SH",
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "Booking.com B.V.",
    email: "it-suppliers@booking.example",
    phone: "+31 20 712 5600",
    addressLine1: "Herengracht 597",
    city: "Amsterdam",
    postalCode: "1017CE",
    countryCode: "NL",
    vat: "NL805734958B01",
    classification: "business",
    paymentTerms: 30,
  },

  // --- GR domestic B2B (4) — 24% VAT, fictional tech SMBs
  {
    company: "Nimbus Labs SA",
    email: "ap@nimbuslabs.example.gr",
    phone: "+30 210 922 4477",
    addressLine1: "42 Ermou Street",
    city: "Athens",
    postalCode: "10563",
    countryCode: "GR",
    vat: "EL094556721",
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "Kalidrome Technologies SA",
    email: "accounts@kalidrome.example.gr",
    phone: "+30 210 412 8800",
    addressLine1: "8 Voukourestiou Street",
    city: "Athens",
    postalCode: "10671",
    countryCode: "GR",
    vat: "EL094889101",
    classification: "business",
    paymentTerms: 45,
  },
  {
    company: "Archon Data SA",
    email: "finance@archondata.example.gr",
    phone: "+30 2310 556 040",
    addressLine1: "12 Tsimiski Street",
    city: "Thessaloniki",
    postalCode: "54624",
    countryCode: "GR",
    vat: "EL095112334",
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "HeliX AI Solutions SA",
    email: "ap@helix-ai.example.gr",
    phone: "+30 210 721 3600",
    addressLine1: "3 Plateia Agiou Georgiou",
    city: "Athens",
    postalCode: "11471",
    countryCode: "GR",
    vat: "EL095998440",
    classification: "business",
    paymentTerms: 30,
  },

  // --- GR domestic individuals (2) — 24% VAT, no VAT number
  {
    company: "Konstantinos Papadopoulos",
    firstName: "Konstantinos",
    lastName: "Papadopoulos",
    email: "k.papadopoulos.freelance@example.gr",
    phone: "+30 698 123 4567",
    addressLine1: "22 Kallidromiou Street",
    city: "Athens",
    postalCode: "11472",
    countryCode: "GR",
    vat: null,
    classification: "individual",
    paymentTerms: 14,
  },
  {
    company: "Maria Georgiou",
    firstName: "Maria",
    lastName: "Georgiou",
    email: "m.georgiou@example.gr",
    phone: "+30 698 765 4321",
    addressLine1: "5 Asklipiou Street",
    city: "Athens",
    postalCode: "10680",
    countryCode: "GR",
    vat: null,
    classification: "individual",
    paymentTerms: 14,
  },
];

export const SUPPLIERS: SupplierSeed[] = [
  {
    company: "Themistokleous Properties Ltd.",
    email: "billing@themistokleous.example.gr",
    phone: "+30 210 330 4001",
    countryCode: "GR",
    vat: "EL099100001",
    classification: "business",
    category: "rent",
  },
  {
    company: "AWS EMEA SARL",
    email: "aws-invoices@amazon.example",
    phone: "+352 28 04 20 00",
    countryCode: "US",
    vat: null,
    classification: "business",
    category: "servers",
  },
  {
    company: "Hetzner Online GmbH",
    email: "billing@hetzner.example.de",
    phone: "+49 9831 505 0",
    countryCode: "DE",
    vat: "DE812871812",
    classification: "business",
    category: "servers",
  },
  {
    company: "Vercel Inc.",
    email: "invoices@vercel.example",
    phone: "+1 559 288 7060",
    countryCode: "US",
    vat: null,
    classification: "business",
    category: "servers",
  },
  {
    company: "Plaisio Computers SA",
    email: "b2b@plaisio.example.gr",
    phone: "+30 210 289 5000",
    countryCode: "GR",
    vat: "EL094112312",
    classification: "business",
    category: "hardware",
  },
  {
    company: "Apple Distribution International Ltd.",
    email: "ap-emea@apple.example",
    phone: "+353 1 800 92 1111",
    countryCode: "IE",
    vat: "IE9700053D",
    classification: "business",
    category: "hardware",
  },
  {
    company: "GitHub, Inc.",
    email: "invoices@github.example",
    phone: "+1 415 448 6673",
    countryCode: "US",
    vat: null,
    classification: "business",
    category: "software",
  },
  {
    company: "Linear Orbit, Inc.",
    email: "billing@linear.example",
    phone: "+1 415 549 5900",
    countryCode: "US",
    vat: null,
    classification: "business",
    category: "software",
  },
  {
    company: "Figma, Inc.",
    email: "ap@figma.example",
    phone: "+1 415 638 9675",
    countryCode: "US",
    vat: null,
    classification: "business",
    category: "software",
  },
  {
    company: "JetBrains s.r.o.",
    email: "sales@jetbrains.example.cz",
    phone: "+420 241 722 501",
    countryCode: "CZ",
    vat: "CZ26502275",
    classification: "business",
    category: "software",
  },
  {
    company: "Aegean Airlines SA",
    email: "corporate@aegeanair.example.gr",
    phone: "+30 210 626 1000",
    countryCode: "GR",
    vat: "EL094362150",
    classification: "business",
    category: "travel",
  },
  {
    company: "Taverna Paradosiako",
    email: "info@taverna-paradosiako.example.gr",
    phone: "+30 210 323 1900",
    countryCode: "GR",
    vat: "EL100445221",
    classification: "business",
    category: "meals",
  },
  {
    company: "LeasePlan Hellas SA",
    email: "invoices@leaseplan.example.gr",
    phone: "+30 210 817 0900",
    countryCode: "GR",
    vat: "EL094389420",
    classification: "business",
    category: "car",
  },
  {
    company: "Ionides & Associates Accountants",
    email: "invoices@ionides.example.gr",
    phone: "+30 210 722 5500",
    countryCode: "GR",
    vat: "EL101223344",
    classification: "business",
    category: "professional_services",
  },
  {
    company: "DEI SA",
    email: "ap@dei.example.gr",
    phone: "+30 210 528 1000",
    countryCode: "GR",
    vat: "EL090000045",
    classification: "business",
    category: "utilities",
  },
  {
    company: "Cosmote Business",
    email: "business@cosmote.example.gr",
    phone: "+30 2130 700 100",
    countryCode: "GR",
    vat: "EL090112134",
    classification: "business",
    category: "telecom",
  },
];

export const PRODUCTS: ProductSeed[] = [
  {
    name: "Senior backend engineer — hour",
    description: "Backend engineering retainer, senior level",
    unitPrice: "95",
    unit: "hour",
    taxCategory: "standard",
  },
  {
    name: "Senior frontend engineer — hour",
    description: "Frontend engineering retainer, senior level",
    unitPrice: "95",
    unit: "hour",
    taxCategory: "standard",
  },
  {
    name: "Cloud architecture review — day",
    description:
      "Full-day AWS / Hetzner architecture audit plus written report",
    unitPrice: "1200",
    unit: "day",
    taxCategory: "standard",
  },
  {
    name: "Tech due-diligence report",
    description: "Pre-investment technical due-diligence and risk register",
    unitPrice: "4500",
    unit: "item",
    taxCategory: "standard",
  },
  {
    name: "DevOps retainer — monthly",
    description: "On-call and infra maintenance, 40 hours per month",
    unitPrice: "3800",
    unit: "service",
    taxCategory: "standard",
  },
  {
    name: "ML / AI integration — fixed",
    description: "Custom model wiring with evaluation harness",
    unitPrice: "8500",
    unit: "item",
    taxCategory: "standard",
  },
  {
    name: "Team training workshop — day",
    description: "On-site engineering enablement, up to 10 attendees",
    unitPrice: "2400",
    unit: "day",
    taxCategory: "standard",
  },
  {
    name: "Developer workstation — unit",
    description: "Pre-configured MacBook Pro 16-inch resale",
    unitPrice: "3500",
    unit: "unit",
    taxCategory: "standard",
  },
];

// Monthly revenue-curve weights (8 months from oldest to "today").
// Upward hockey-stick so dashboards read like real growth.
export const REVENUE_CURVE = [0.6, 0.7, 0.85, 1.0, 1.2, 1.4, 1.6, 1.3];

// Line-item narrative — short descriptive seeds for tech-services work.
export const INVOICE_NARRATIVES = [
  "Platform engineering — Q sprint",
  "API integration work",
  "Infra review follow-up",
  "Roadmap discovery workshop",
  "Incident retainer — monthly",
  "Dashboard rebuild",
  "Model integration milestone",
  "Onsite enablement",
];

export const EXPENSE_MEMOS = [
  "Office rent — monthly",
  "AWS usage — monthly",
  "Hetzner dedicated servers — monthly",
  "Vercel Pro seats",
  "GitHub Enterprise seats",
  "Linear team plan",
  "Figma organization seats",
  "JetBrains All Products pack",
  'MacBook Pro 16" — engineering workstation',
  "Developer monitors and peripherals",
  "Flights to client site",
  "Hotel accommodation — client onsite",
  "Team lunch — Friday wrap-up",
  "Company car lease — quarterly",
  "Accounting services — quarterly fee",
  "Electricity bill — office",
  "Internet + phone — business fiber",
  "Salary — senior engineer",
  "Salary — junior engineer",
  "Training / conference ticket",
];

export const DEMO_USER = {
  email: "demo@opentab.dev",
  name: "Aegean Demo",
  // Password-hash filled in at provisioning time using bcrypt.
  password: "demo-opentab-ABC!",
};
