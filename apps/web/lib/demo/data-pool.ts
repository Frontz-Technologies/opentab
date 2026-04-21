// Narrative pool for the "Δελφίνι Α.Ε." demo business — a fictional
// small Athens catering + events supplier. All data is fictional;
// VAT numbers are valid-format GR AFMs but do not correspond to real
// entities. Names/addresses avoid anything identifiable.
//
// Kept compact (v1): one cohesive GR narrative. Other countries fall
// back to the generic pool (same shape, anglicised names).

export interface ClientSeed {
  company: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  vat: string | null;
  classification: "individual" | "business" | "government";
  paymentTerms: number;
}

export interface SupplierSeed {
  company: string;
  email: string;
  phone: string;
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

export const DEMO_ORG_GR = {
  name: "Δελφίνι Α.Ε.",
  slug: "delfini",
  taxId: "800123456",
  taxAuthority: "ΔΟΥ Ψυχικού",
  countryCode: "GR",
  defaultCurrency: "EUR",
  addressLine1: "Λεωφόρος Κηφισίας 120",
  city: "Αθήνα",
  postalCode: "11526",
  region: "Αττική",
  phone: "+30 210 6700000",
};

export const DEMO_ORG_GENERIC = {
  name: "Blue Dolphin Catering Ltd.",
  slug: "blue-dolphin",
  taxId: "800123456",
  taxAuthority: null as string | null,
  countryCode: null as string | null,
  defaultCurrency: "EUR",
  addressLine1: "12 Market Street",
  city: "London",
  postalCode: "EC1A 1AA",
  region: null as string | null,
  phone: "+44 20 7946 0000",
};

export const CLIENTS_GR: ClientSeed[] = [
  {
    company: "Ξενοδοχείο Θάλασσα",
    email: "events@thalassa-hotel.example",
    phone: "+30 210 3344550",
    addressLine1: "Ακτή Πεισιστράτου 8",
    city: "Πειραιάς",
    postalCode: "18531",
    vat: "099000001",
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "Εστιατόριο Ο Γιώργος",
    firstName: "Γιώργος",
    lastName: "Παπαδάκης",
    email: "giorgos@ogiorgos.example",
    phone: "+30 210 2244330",
    addressLine1: "Ερμού 42",
    city: "Αθήνα",
    postalCode: "10563",
    vat: "099000002",
    classification: "business",
    paymentTerms: 15,
  },
  {
    company: "Δήμος Γλυφάδας",
    email: "protokollo@glyfada.gov.example",
    phone: "+30 210 9600000",
    addressLine1: "Άλσους 15",
    city: "Γλυφάδα",
    postalCode: "16675",
    vat: "090100001",
    classification: "government",
    paymentTerms: 60,
  },
  {
    company: "Creative Events",
    firstName: "Ελένη",
    lastName: "Καρρά",
    email: "eleni@creative-events.example",
    phone: "+30 210 5544660",
    addressLine1: "Βουκουρεστίου 5",
    city: "Αθήνα",
    postalCode: "10671",
    vat: "099000003",
    classification: "business",
    paymentTerms: 15,
  },
  {
    company: "ΑΒ Ηλεκτρικά",
    email: "orders@ab-electrics.example",
    phone: "+30 210 7766550",
    addressLine1: "Λεωφ. Συγγρού 180",
    city: "Καλλιθέα",
    postalCode: "17671",
    vat: "099000004",
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "Καφενείο Πλατεία",
    email: "platia@coffee.example",
    phone: "+30 210 3388440",
    addressLine1: "Πλ. Αγ. Γεωργίου 3",
    city: "Αθήνα",
    postalCode: "11473",
    vat: null,
    classification: "individual",
    paymentTerms: 0,
  },
  {
    company: "Hotel Marina Suites",
    email: "reception@marina-suites.example",
    phone: "+30 22890 22330",
    addressLine1: "Νάουσσα",
    city: "Πάρος",
    postalCode: "84401",
    vat: "099000005",
    classification: "business",
    paymentTerms: 30,
  },
  {
    company: "Wedding by Sofia",
    firstName: "Σοφία",
    lastName: "Αντωνίου",
    email: "sofia@weddingbysofia.example",
    phone: "+30 697 1234567",
    addressLine1: "Βασ. Σοφίας 40",
    city: "Αθήνα",
    postalCode: "10676",
    vat: "099000006",
    classification: "business",
    paymentTerms: 15,
  },
];

export const SUPPLIERS_GR: SupplierSeed[] = [
  {
    company: "Αμπελώνας Νεμέας",
    email: "orders@nemea-wines.example",
    phone: "+30 2746 042200",
    vat: "099100001",
    classification: "business",
    category: "beverages",
  },
  {
    company: "Κρητικό Ελαιοτριβείο",
    email: "info@kritiko-oil.example",
    phone: "+30 2810 332200",
    vat: "099100002",
    classification: "business",
    category: "supplies",
  },
  {
    company: "LinenPro Λευκά Είδη",
    email: "rental@linenpro.example",
    phone: "+30 210 4411220",
    vat: "099100003",
    classification: "business",
    category: "rentals",
  },
  {
    company: "PrintWorks Αθηνών",
    email: "print@printworks.example",
    phone: "+30 210 8822110",
    vat: "099100004",
    classification: "business",
    category: "marketing",
  },
  {
    company: "Eurogaz Καύσιμα",
    email: "fleet@eurogaz.example",
    phone: "+30 210 9922330",
    vat: "099100005",
    classification: "business",
    category: "fuel",
  },
  {
    company: "Aktina Ασφαλιστική",
    email: "policies@aktina.example",
    phone: "+30 210 6611220",
    vat: "099100006",
    classification: "business",
    category: "insurance",
  },
];

export const PRODUCTS_GR: ProductSeed[] = [
  {
    name: "Πακέτο catering Premium",
    description: "Ανά άτομο, περιλαμβάνει 5 ορεκτικά + κυρίως + επιδόρπιο.",
    unitPrice: "45.00",
    unit: "item",
    taxCategory: "reduced",
  },
  {
    name: "Πακέτο catering Classic",
    description: "Ανά άτομο, 3 ορεκτικά + κυρίως.",
    unitPrice: "28.00",
    unit: "item",
    taxCategory: "reduced",
  },
  {
    name: "Bar package (open bar)",
    description: "Ανά άτομο, 4 ώρες open bar με εγχώρια ποτά.",
    unitPrice: "22.00",
    unit: "item",
    taxCategory: "standard",
  },
  {
    name: "Σερβιτόρος / ώρα",
    description: "Εξειδικευμένο προσωπικό σερβιρίσματος.",
    unitPrice: "18.00",
    unit: "hour",
    taxCategory: "standard",
  },
  {
    name: "Bartender / ώρα",
    description: "Επαγγελματίας bartender με cocktail menu.",
    unitPrice: "25.00",
    unit: "hour",
    taxCategory: "standard",
  },
  {
    name: "Event coordination / ημέρα",
    description: "Συντονισμός εκδήλωσης από έμπειρο event manager.",
    unitPrice: "320.00",
    unit: "day",
    taxCategory: "standard",
  },
  {
    name: "Sound & lighting / εκδήλωση",
    description: "Εγκατάσταση και χειρισμός ήχου + φωτισμού.",
    unitPrice: "480.00",
    unit: "service",
    taxCategory: "standard",
  },
  {
    name: "Kids menu",
    description: "Ανά παιδί, μικρή μερίδα + χυμός + παγωτό.",
    unitPrice: "14.00",
    unit: "item",
    taxCategory: "reduced",
  },
  {
    name: "Vegan menu",
    description: "Ανά άτομο, πλήρες vegan μενού 3 πιάτων.",
    unitPrice: "32.00",
    unit: "item",
    taxCategory: "reduced",
  },
  {
    name: "Ντεκόρ τραπεζιού",
    description: "Ανά τραπέζι, λουλούδια + κεριά + runner.",
    unitPrice: "55.00",
    unit: "service",
    taxCategory: "standard",
  },
  {
    name: "Εμφιαλωμένο νερό",
    description: "500 ml, κιβώτιο 12 τεμαχίων.",
    unitPrice: "8.40",
    unit: "item",
    taxCategory: "standard",
  },
  {
    name: "Καφές espresso",
    description: "Εσπρέσο bar, ανά ποτήρι.",
    unitPrice: "2.50",
    unit: "item",
    taxCategory: "reduced",
  },
];

// Monthly revenue-curve weights (8 months from oldest to "today").
// Q4 weighting to evoke an event-services business.
export const REVENUE_CURVE = [0.6, 0.7, 0.85, 1.0, 1.2, 1.4, 1.6, 1.3];

// Line-item narrative — descriptive seeds paired with quantities
// likely for that kind of invoice. Keeps numbers plausible instead of
// random.
export const INVOICE_NARRATIVES = [
  "Catering εταιρικής εκδήλωσης",
  "Γαμήλιο catering (deluxe)",
  "Δεξίωση εταιρικών πελατών",
  "Χριστουγεννιάτικο πάρτι προσωπικού",
  "Λανσάρισμα προϊόντος",
  "Συνάντηση Διοικητικού Συμβουλίου",
  "Εορταστικό gala",
  "Βάπτιση — μενού για 80 άτομα",
];

export const EXPENSE_MEMOS = [
  "Προμήθεια κρασιών Νεμέας για επόμενη εκδήλωση",
  "Λάδι + ελιές από Κρητικό ελαιοτριβείο",
  "Ενοικίαση λευκών ειδών",
  "Καύσιμα βαν",
  "Εκτυπώσεις menu για γάμο",
  "Τριμηνιαίο ασφάλιστρο οχημάτων",
  "Καφές για γραφείο",
  "Γραφική ύλη",
];

export const DEMO_USER = {
  email: "demo@opentab.dev",
  name: "Δελφίνι Demo",
  // Password-hash filled in at provisioning time using bcrypt.
  password: "demo-opentab-ABC!",
};
