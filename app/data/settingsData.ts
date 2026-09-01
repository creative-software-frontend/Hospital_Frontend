// data/settingsData.ts
// Typed registry of mock Settings page content.
// Each page is keyed by the stable `id` of a Settings sub-feature
// (see app/data/features.ts feature id 21).

export type SettingsBlock =
  | { type: "table"; columns: string[]; rows: Record<string, string>[] }
  | { type: "fields"; values: { label: string; value: string }[] }
  | { type: "list"; items: string[] };

export interface SettingsPageData {
  title: string;
  description: string;
  blocks: SettingsBlock[];
}

export const settingsData: Record<string, SettingsPageData> = {
  "general-settings": {
    title: "General Settings",
    description:
      "Core application preferences such as system locale, date format, timezone, and default security policies applied across the platform.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "System Name", value: "MediCare HMS" },
          { label: "Version", value: "v2.4.1" },
          { label: "Default Date Format", value: "DD/MM/YYYY" },
          { label: "Default Time Format", value: "24 Hour" },
          { label: "Timezone", value: "Asia/Dhaka (GMT+6)" },
          { label: "Currency", value: "BDT (৳)" },
          { label: "Default Language", value: "English" },
          { label: "Maintenance Mode", value: "Off" },
        ],
      },
    ],
  },

  "branch-settings": {
    title: "Branch Settings",
    description:
      "Manage hospital branches, their contact information, and operational status across multiple locations.",
    blocks: [
      {
        type: "table",
        columns: ["Branch Name", "Location", "Phone", "Email", "Manager", "Status"],
        rows: [
          { "Branch Name": "Dhaka Central", Location: "Dhanmondi, Dhaka", Phone: "01711-000001", Email: "dhaka@medicare.com", Manager: "Dr. Monir Hossain", Status: "Active" },
          { "Branch Name": "Uttara North", Location: "Uttara, Dhaka", Phone: "01711-000002", Email: "uttara@medicare.com", Manager: "Dr. Farhana Akter", Status: "Active" },
          { "Branch Name": "Chattogram General", Location: "Agrabad, Chattogram", Phone: "01711-000003", Email: "ctg@medicare.com", Manager: "Dr. Rafiq Uddin", Status: "Active" },
          { "Branch Name": "Sylhet Health Point", Location: "Zindabazar, Sylhet", Phone: "01711-000004", Email: "sylhet@medicare.com", Manager: "Dr. Tanvir Ahmed", Status: "Inactive" },
        ],
      },
    ],
  },

  "user-role-management": {
    title: "User & Role Management",
    description:
      "Create users, assign roles, and control granular permissions for every module in the system.",
    blocks: [
      {
        type: "table",
        columns: ["Username", "Full Name", "Role", "Department", "Status"],
        rows: [
          { Username: "admin", "Full Name": "System Administrator", Role: "Super Admin", Department: "IT", Status: "Active" },
          { Username: "drshahed", "Full Name": "Dr. Shahed Chowdhury", Role: "Doctor", Department: "Cardiology", Status: "Active" },
          { Username: "nurse01", "Full Name": "Sadia Rahman", Role: "Nurse", Department: "General Ward", Status: "Active" },
          { Username: "rec2024", "Full Name": "Nusrat Jahan", Role: "Receptionist", Department: "Front Desk", Status: "Active" },
          { Username: "pharma01", "Full Name": "Karim Hossain", Role: "Pharmacist", Department: "Pharmacy", Status: "Active" },
          { Username: "acc001", "Full Name": "Faisal Mahmud", Role: "Accountant", Department: "Accounts", Status: "Disabled" },
        ],
      },
      {
        type: "list",
        items: [
          "Super Admin – full access",
          "Hospital Admin – hospital operations",
          "Doctor – consultation & prescriptions",
          "Nurse – patient monitoring",
          "Receptionist – registration & appointments",
          "Pharmacist – medicine & stock",
          "Lab Technician – tests & reports",
          "Accountant – billing & finance",
          "HR Manager – staff & payroll",
        ],
      },
    ],
  },

  "security": {
    title: "Security",
    description:
      "Password policies, login attempt limits, session timeouts, and audit logging configuration.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Password Minimum Length", value: "8 characters" },
          { label: "Password Complexity", value: "Required (upper, lower, digit)" },
          { label: "Max Login Attempts", value: "5" },
          { label: "Session Timeout", value: "30 minutes" },
          { label: "Two-Factor Authentication", value: "Enabled (OTP via SMS)" },
          { label: "Audit Log Retention", value: "12 months" },
          { label: "IP Whitelisting", value: "Disabled" },
        ],
      },
    ],
  },

  "hospital-configuration": {
    title: "Hospital Configuration",
    description: "Configure core hospital entities including departments, doctors, patients, and services.",
    blocks: [
      {
        type: "list",
        items: [
          "Departments: Cardiology, Neurology, Orthopedics, Pediatrics, Radiology, Pathology, General Medicine, Emergency",
          "Doctors: linked to departments with consultation schedules",
          "Patients: registered with unique patient IDs",
          "Services: billable items tied to OPD, IPD, and specialty",
        ],
      },
    ],
  },

  "hc-departments": {
    title: "Departments",
    description: "Manage the list of hospital departments and their head of departments.",
    blocks: [
      {
        type: "table",
        columns: ["Department", "Code", "Head of Department", "No. of Beds"],
        rows: [
          { Department: "Cardiology", Code: "CARD", "Head of Department": "Dr. Shahed Chowdhury", "No. of Beds": "20" },
          { Department: "Neurology", Code: "NEURO", "Head of Department": "Dr. Nusrat Kabir", "No. of Beds": "15" },
          { Department: "Orthopedics", Code: "ORTHO", "Head of Department": "Dr. Rafiq Uddin", "No. of Beds": "18" },
          { Department: "Pediatrics", Code: "PED", "Head of Department": "Dr. Farhana Akter", "No. of Beds": "25" },
          { Department: "Radiology", Code: "RAD", "Head of Department": "Dr. Tanvir Ahmed", "No. of Beds": "5" },
          { Department: "Emergency", Code: "EMRG", "Head of Department": "Dr. Monir Hossain", "No. of Beds": "12" },
        ],
      },
    ],
  },

  "hc-doctors": {
    title: "Doctors",
    description: "Manage doctor profiles, specialty, designation, and consultation schedule.",
    blocks: [
      {
        type: "table",
        columns: ["Doctor ID", "Name", "Specialty", "Designation", "Consultation Fee"],
        rows: [
          { "Doctor ID": "DOC-001", Name: "Dr. Shahed Chowdhury", Specialty: "Cardiologist", Designation: "Senior Consultant", "Consultation Fee": "1500" },
          { "Doctor ID": "DOC-002", Name: "Dr. Nusrat Kabir", Specialty: "Neurologist", Designation: "Consultant", "Consultation Fee": "1200" },
          { "Doctor ID": "DOC-003", Name: "Dr. Rafiq Uddin", Specialty: "Orthopedic", Designation: "Consultant", "Consultation Fee": "1000" },
          { "Doctor ID": "DOC-004", Name: "Dr. Farhana Akter", Specialty: "Pediatrician", Designation: "Junior Consultant", "Consultation Fee": "800" },
        ],
      },
    ],
  },

  "hc-patients": {
    title: "Patients",
    description: "Configure patient numbering rules and registration defaults.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Patient ID Prefix", value: "PT-" },
          { label: "Auto Generate Unique ID", value: "Enabled" },
          { label: "Default Patient Type", value: "New" },
          { label: "Require Guardian", value: "For minors only" },
          { label: "Duplicate Detection", value: "Enabled (phone + NID)" },
        ],
      },
    ],
  },

  "hc-services": {
    title: "Services",
    description: "Configure billable services offered by the hospital and their pricing.",
    blocks: [
      {
        type: "table",
        columns: ["Service Code", "Service Name", "Category", "Price (BDT)"],
        rows: [
          { "Service Code": "SRV-100", "Service Name": "General Consultation", Category: "OPD", "Price (BDT)": "800" },
          { "Service Code": "SRV-101", "Service Name": "ECG", Category: "Cardiac", "Price (BDT)": "500" },
          { "Service Code": "SRV-102", "Service Name": "Private Cabin - Deluxe", Category: "IPD", "Price (BDT)": "3000" },
          { "Service Code": "SRV-103", "Service Name": "Ambulance Base", Category: "Transport", "Price (BDT)": "1500" },
        ],
      },
    ],
  },

  "clinical-settings": {
    title: "Clinical Settings",
    description: "Configure OPD, IPD, emergency, prescription, and diagnosis workflow settings.",
    blocks: [
      {
        type: "list",
        items: [
          "OPD: consultation flow, token system, queue size",
          "IPD: bed allocation rules, ward defaults, discharge checklist",
          "Emergency: triage levels and priority routing",
          "Prescription: template, digital signature, print layout",
          "Diagnosis: ICD-10 code library and search",
        ],
      },
    ],
  },

  "clinical-opd": {
    title: "OPD Settings",
    description: "Configure Outpatient Department workflow and token management.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Enable Token System", value: "Enabled" },
          { label: "Token Generated Per Day", value: "250" },
          { label: "SMS Notification To Patient", value: "Enabled" },
          { label: "Avg Consultation Time", value: "15 minutes" },
          { label: "Walk-in Allowed", value: "Yes" },
        ],
      },
    ],
  },

  "clinical-ipd": {
    title: "IPD Settings",
    description: "Configure Inpatient Department bed allocation and discharge workflow.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Automatic Bed Allocation", value: "Enabled" },
          { label: "Generl Ward Capacity", value: "40 beds" },
          { label: "Private Cabin Capacity", value: "20 beds" },
          { label: "ICU Capacity", value: "8 beds" },
          { label: "Discharge Checklist", value: "Required" },
        ],
      },
    ],
  },

  "clinical-emergency": {
    title: "Emergency Settings",
    description: "Configure triage levels and emergency patient routing.",
    blocks: [
      {
        type: "list",
        items: [
          "Triage Level 1 – Resuscitation (red)",
          "Triage Level 2 – Emergency (orange)",
          "Triage Level 3 – Urgent (yellow)",
          "Triage Level 4 – Less Urgent (green)",
          "Critical patient auto-priority assignment",
        ],
      },
    ],
  },

  "clinical-prescription": {
    title: "Prescription Settings",
    description: "Configure digital prescription templates and doctor signature.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Digital Signature", value: "Enabled" },
          { label: "Template", value: "Standard Clinical" },
          { label: "Auto Medicine Suggestions", value: "Enabled" },
          { label: "Print Layout", value: "A4" },
          { label: "Include Diagnosis Codes", value: "ICD-10" },
        ],
      },
    ],
  },

  "clinical-diagnosis": {
    title: "Diagnosis Settings",
    description: "Configure the diagnosis library and coding standard.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Diagnosis Standard", value: "ICD-10" },
          { label: "Searchable Library", value: "Enabled" },
          { label: "Auto-Suggest Codes", value: "Enabled" },
          { label: "Mandatory on Prescription", value: "Yes" },
        ],
      },
    ],
  },

  "pharmacy-settings": {
    title: "Pharmacy Settings",
    description: "Configure pharmacy inventory, batch, reorder, and expiry alert settings.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Low Stock Threshold", value: "10 units" },
          { label: "Expiry Alert Days", value: "30 days" },
          { label: "Batch Tracking", value: "Enabled" },
          { label: "Barcode Scanning", value: "Enabled" },
          { label: "Reorder Auto-Notify", value: "Enabled" },
          { label: "Sales Discount Limit", value: "10%" },
        ],
      },
    ],
  },

  "laboratory-settings": {
    title: "Laboratory Settings",
    description: "Configure lab test booking, sample collection, and report delivery.",
    blocks: [
      {
        type: "table",
        columns: ["Test Code", "Test Name", "Department", "Turnaround (hrs)", "Price (BDT)"],
        rows: [
          { "Test Code": "CBC", "Test Name": "Complete Blood Count", Department: "Pathology", "Turnaround (hrs)": "2", "Price (BDT)": "300" },
          { "Test Code": "UR", "Test Name": "Urine Routine", Department: "Pathology", "Turnaround (hrs)": "2", "Price (BDT)": "200" },
          { "Test Code": "XRAY", "Test Name": "Chest X-Ray", Department: "Radiology", "Turnaround (hrs)": "1", "Price (BDT)": "600" },
          { "Test Code": "ECG", "Test Name": "Electrocardiogram", Department: "Cardiac", "Turnaround (hrs)": "1", "Price (BDT)": "500" },
        ],
      },
    ],
  },

  "billing-settings": {
    title: "Billing Settings",
    description: "Configure payment methods, invoice numbering, and tax rules.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Invoice Prefix", value: "INV-" },
          { label: "Payment Methods", value: "Cash, Card, bKash, Rocket" },
          { label: "VAT", value: "5%" },
          { label: "Service Charge", value: "0%" },
          { label: "Auto Invoice Numbering", value: "Enabled" },
          { label: "Print Invoice on Payment", value: "Enabled" },
        ],
      },
    ],
  },

  "accounting-settings": {
    title: "Accounting Settings",
    description: "Configure chart of accounts, fiscal year, and reporting defaults.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Fiscal Year", value: "July 2025 – June 2026" },
          { label: "Base Currency", value: "BDT" },
          { label: "Chart of Accounts", value: "Hospital Standard" },
          { label: "Auto-Post To Ledger", value: "Enabled" },
          { label: "Trial Balance Frequency", value: "Monthly" },
          { label: "Receipt / Payment Voucher", value: "Enabled" },
        ],
      },
    ],
  },

  "hr-payroll": {
    title: "HR & Payroll",
    description: "Configure employee grading structure, salary, and leave rules.",
    blocks: [
      {
        type: "table",
        columns: ["Designation", "Grade", "Basic Salary (BDT)", "Monthly Leave"],
        rows: [
          { Designation: "Senior Consultant", Grade: "G-01", "Basic Salary (BDT)": "180000", "Monthly Leave": "4" },
          { Designation: "Consultant", Grade: "G-02", "Basic Salary (BDT)": "120000", "Monthly Leave": "4" },
          { Designation: "Staff Nurse", Grade: "G-06", "Basic Salary (BDT)": "35000", "Monthly Leave": "4" },
          { Designation: "Receptionist", Grade: "G-08", "Basic Salary (BDT)": "22000", "Monthly Leave": "4" },
        ],
      },
      {
        type: "fields",
        values: [
          { label: "Payroll Cycle", value: "Monthly" },
          { label: "Salary Disbursement Day", value: "1st of month" },
          { label: "Annual Leave (Days)", value: "18" },
          { label: "Overtime Rate", value: "1.5x" },
        ],
      },
    ],
  },

  "inventory": {
    title: "Inventory",
    description: "Manage medical equipment, assets, and stock transfer settings.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Track Medical Equipment", value: "Enabled" },
          { label: "Asset Barcode", value: "Enabled" },
          { label: "Low Stock Alert", value: "Enabled" },
          { label: "Auto Reorder", value: "Enabled" },
          { label: "Stock Transfer Approval", value: "Required" },
        ],
      },
    ],
  },

  "notification": {
    title: "Notification",
    description: "Configure SMS, email, and in-app notification triggers.",
    blocks: [
      {
        type: "list",
        items: [
          "Appointment reminder – SMS (24h before)",
          "Bill/payment notification – SMS & in-app",
          "Medicine refill reminder – SMS",
          "Follow-up reminder – SMS",
          "Promotional SMS – opt-in only",
          "Critical lab result – push & email",
        ],
      },
    ],
  },

  "print-document": {
    title: "Print & Document",
    description: "Configure print templates for prescriptions, bills, reports, and certificates.",
    blocks: [
      {
        type: "list",
        items: [
          "Prescription – A4 standard",
          "Invoice / Bill – thermal 80mm",
          "Discharge Certificate – A4",
          "Lab Report – A4",
          "Admission Form – A4",
          "Employee ID Card – CR80",
        ],
      },
    ],
  },

  "api-integration": {
    title: "API & Integration",
    description: "Manage third-party integrations for SMS gateway, payment, and external systems.",
    blocks: [
      {
        type: "table",
        columns: ["Integration", "Provider", "Status", "Key"],
        rows: [
          { Integration: "SMS Gateway", Provider: "BulkSMS BD", Status: "Connected", Key: "sk-••••••••1234" },
          { Integration: "Online Payment", Provider: "SSLCommerz", Status: "Connected", Key: "sslc-••••••" },
          { Integration: "Email Service", Provider: "SMTP", Status: "Connected", Key: "—" },
          { Integration: "Lab Interface", Provider: "HL7", Status: "Pending", Key: "—" },
        ],
      },
    ],
  },

  "backup-database": {
    title: "Backup & Database",
    description: "Configure automated database backup schedule and retention.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Auto Backup", value: "Enabled" },
          { label: "Backup Frequency", value: "Daily at 02:00" },
          { label: "Retention", value: "30 days" },
          { label: "Last Backup", value: "2026-08-29 02:00" },
          { label: "Storage Location", value: "Cloud + Local" },
          { label: "Encryption", value: "AES-256" },
        ],
      },
    ],
  },

  "reports": {
    title: "Reports",
    description: "Configure report generation, scheduling, and export formats.",
    blocks: [
      {
        type: "list",
        items: [
          "Daily collection report",
          "Patient statistics report",
          "Doctor performance report",
          "Pharmacy sales report",
          "Lab income report",
          "Financial (P&L / Balance Sheet)",
          "Management dashboard",
        ],
      },
      {
        type: "fields",
        values: [
          { label: "Default Export Format", value: "PDF, Excel" },
          { label: "Scheduled Email", value: "Enabled (daily)" },
          { label: "Report Period", value: "Current month" },
        ],
      },
    ],
  },

  "localization": {
    title: "Localization",
    description: "Configure language, currency, timezone, and regional settings.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "Primary Language", value: "English" },
          { label: "Secondary Language", value: "Bangla" },
          { label: "Currency", value: "Bangladeshi Taka (BDT)" },
          { label: "Date Format", value: "DD/MM/YYYY" },
          { label: "Timezone", value: "Asia/Dhaka" },
        ],
      },
    ],
  },

  "master-data": {
    title: "Master Data",
    description: "Manage reference data used across the system such as cities, areas, and visit types.",
    blocks: [
      {
        type: "table",
        columns: ["Master Category", "Entries", "Example"],
        rows: [
          { "Master Category": "Cities", Entries: "64", Example: "Dhaka, Chattogram, Sylhet" },
          { "Master Category": "Visit Types", Entries: "4", Example: "New, Follow-up, Emergency" },
          { "Master Category": "Blood Groups", Entries: "8", Example: "A+, B-, O+, AB+" },
          { "Master Category": "Payment Methods", Entries: "5", Example: "Cash, Card, bKash, Rocket" },
          { "Master Category": "Document Types", Entries: "6", Example: "NID, Passport, Birth Cert" },
        ],
      },
    ],
  },

  "system-maintenance": {
    title: "System Maintenance",
    description: "System health checks, cache clearing, and diagnostic tools.",
    blocks: [
      {
        type: "fields",
        values: [
          { label: "System Status", value: "Healthy" },
          { label: "Uptime", value: "99.98%" },
          { label: "Last Maintenance", value: "2026-08-28" },
          { label: "Database Health", value: "Optimal" },
          { label: "Cache Usage", value: "42%" },
          { label: "Pending Updates", value: "None" },
        ],
      },
    ],
  },
};
