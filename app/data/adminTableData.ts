export type TableRow = Record<string, string>;

// ------------- Generic table schema per admin module -------------
export type AdminTableColumns = string[];

export type AdminTableData = {
  columns: AdminTableColumns;
  rows: TableRow[];
};

// Patient table is already used for feature id = 1.
// This file adds more tables so you can render JSON table data for other admin modules too.

export const PATIENT_TABLE: AdminTableData = {
  columns: [
    "Patient ID",
    "Patient Name",
    "Age",
    "Gender",
    "Phone",
    "Guardian Name",
    "Address",
    "Dead",
  ],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const patientId = `PT-${i + 1}`;

    const genders = ["Male", "Female"];
    const gender = genders[i % genders.length];

    const firstNames = ["John", "Jane", "Rahim", "Karim", "Ayesha", "Nusrat", "Sadia", "Faisal"];
    const lastNames = ["Doe", "Smith", "Khan", "Hossain", "Rahman", "Islam", "Chowdhury", "Hasan"];
    const patientName = `${firstNames[i % firstNames.length]} ${lastNames[(i + 3) % lastNames.length]}`;
    const age = String(18 + (i % 70));

    const phone = `+8801-000${String(i + 1).padStart(4, "0")}`;

    const guardianNames = ["Ayesha Doe", "Robert Smith", "Rahim Khan", "Mariam Hossain", "Abdul Rahman", "Tania Akter"];
    const guardianName = guardianNames[i % guardianNames.length];

    const addresses = ["Dhanmondi, Dhaka", "Mirpur, Dhaka", "Uttara, Dhaka", "Gulshan, Dhaka", "Chattogram", "Sylhet"];
    const address = addresses[i % addresses.length];

    const dead = i % 50 === 0 ? "Yes" : "No";

    return {
      "Patient ID": patientId,
      "Patient Name": patientName,
      Age: age,
      Gender: gender,
      Phone: phone,
      "Guardian Name": guardianName,
      Address: address,
      Dead: dead,
    };
  }),
};


// Doctor management (feature id = 2)
export const DOCTOR_TABLE: AdminTableData = {
  columns: ["Doctor Name", "Specialty", "Department", "Chamber", "Phone", "On Duty"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 200;
    const specialties = ["Cardiology", "General Medicine", "Orthopedics", "Pediatrics", "Dermatology", "Neurology"];
    const specialty = specialties[i % specialties.length];
    const department = specialty === "General Medicine" ? "OPD" : specialty;

    const chamberLetters = ["A", "B", "C", "D"];
    const chamberLetter = chamberLetters[i % chamberLetters.length];
    const chamberNo = String(10 + (i % 50)).padStart(2, "0");
    const chamber = `Chamber ${chamberLetter}-${chamberNo}`;

    const onDuty = i % 3 === 0 ? "No" : "Yes";
    const phone = `+8801-000${String(idx).padStart(4, "0")}`;

    const doctorNames = ["Sarah Khan", "Imran Hossain", "Rahim Ahmed", "Nusrat Jahan", "Fahim Rahman", "Tania Akter"];
    const baseName = doctorNames[i % doctorNames.length];
    const doctorName = `Dr. ${baseName}${i % 2 === 0 ? "" : ""}`;

    return {
      "Doctor Name": doctorName,
      Specialty: specialty,
      Department: department,
      Chamber: chamber,
      Phone: phone,
      "On Duty": onDuty,
    };
  }),
};


// Appointment management (feature id = 3)
export const APPOINTMENT_TABLE: AdminTableData = {
  columns: ["Appointment ID", "Patient", "Patient ID", "Patient Name", "Phone", "Doctor", "Date", "Time", "Status"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 1001;

    const patients = ["John Doe", "Jane Smith", "Rahim Khan", "Karim Hasan", "Ayesha Doe", "Nusrat Jahan"];
    const doctors = ["Dr. Sarah Khan", "Dr. Imran Hossain", "Dr. Rahim Ahmed", "Dr. Nusrat Jahan"];
    const statuses = ["confirmed", "pending", "cancelled", "completed"];

    const patientName = patients[i % patients.length];
    const patientId = `PT-${i + 1}`;
    const phone = `+8801-000${String(i + 1).padStart(4, "0")}`;

    const doctor = doctors[(i + 1) % doctors.length];
    const status = statuses[i % statuses.length];

    // Spread dates across June 2026
    const day = 18 + (i % 20); // 18..37
    const dateMonth = "Jun";

    // Spread times across a typical clinic window
    const timeSlots = [
      "09:00 AM",
      "09:30 AM",
      "10:00 AM",
      "10:30 AM",
      "11:00 AM",
      "11:30 AM",
      "01:00 PM",
      "01:30 PM",
      "02:00 PM",
      "02:30 PM",
      "03:00 PM",
      "03:30 PM",
    ];
    const time = timeSlots[i % timeSlots.length];

    return {
      "Appointment ID": `APT-${idx}`,
      Patient: patientName,
      "Patient ID": patientId,
      "Patient Name": patientName,
      Phone: phone,
      Doctor: doctor,
      Date: `${dateMonth} ${day}, 2026`,
      Time: time,
      Status: status,
    };
  }),
};


// Bed & Ward management (feature id = 7)
export const BED_WARD_TABLE: AdminTableData = {
  columns: [
    "Ward",
    "Bed",
    "Patient",
    "Patient ID",
    "Patient Name",
    "Phone",
    "Status",
    "Admission ID",
    "Expected Discharge",
  ],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const ward = i % 3 === 0 ? "Ward-1" : i % 3 === 1 ? "Ward-2" : "Ward-3";
    const bed = i % 2 === 0 ? "B-12" : "C-03";

    const patientName = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const patientId = `PT-${i + 1}`;
    const phone = `+8801-000${String(i + 1).padStart(4, "0")}`;

    const status = i % 2 === 0 ? "Occupied" : "Available";
    const admissionId = i % 2 === 0 ? `IPD-${501 + i}` : "N/A";
    const expected = i % 2 === 0 ? (i % 4 === 0 ? "Jun 25, 2026" : "Jun 27, 2026") : "N/A";

    return {
      Ward: ward,
      Bed: bed,
      Patient: patientName,
      "Patient ID": patientId,
      "Patient Name": patientName,
      Phone: phone,
      Status: status,
      "Admission ID": admissionId,
      "Expected Discharge": expected,
    };
  }),
};


// Billing & accounts (feature id = 14)
export const BILLING_TABLE: AdminTableData = {
  columns: ["Invoice ID", "Patient", "Amount", "Paid", "Due", "Method"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 20001;
    const patient = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const amount = 80 + (i % 220);
    const paid = i % 4 === 0 ? amount - 10 : i % 4 === 1 ? amount : amount - 30;
    const due = Math.max(0, amount - paid);
    const method = i % 2 === 0 ? "Cash" : "Card";
    return {
      "Invoice ID": `INV-${idx}`,
      Patient: patient,
      Amount: `$${amount}`,
      Paid: `$${paid}`,
      Due: `$${due}`,
      Method: method,
    };
  }),
};


// Inventory management (feature id = 17)
export const INVENTORY_TABLE: AdminTableData = {
  columns: ["Item", "Category", "Stock", "Reorder Level", "Expiry", "Status"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 1;
    const categories = ["Antibiotic", "Diabetes", "Cardiology", "Pain Relief", "Vitamins", "Diuretics"];
    const category = categories[i % categories.length];
    const items = [
      "Amoxicillin 500mg",
      "Metformin 500mg",
      "Amlodipine 5mg",
      "Ibuprofen 400mg",
      "Vitamin D3",
      "Furosemide 40mg",
    ];
    const item = items[i % items.length];
    const stock = 2 + (i % 60);
    const reorderLevel = 10 + (i % 10);
    const expiry = i % 2 === 0 ? "2027-03" : "2026-12";
    const status = stock <= reorderLevel ? "Low Stock" : "Active";
    return {
      Item: item,
      Category: category,
      Stock: String(stock),
      "Reorder Level": String(reorderLevel),
      Expiry: expiry,
      Status: status,
    };
  }),
};


// ----------------- OPD / IPD / Emergency / Prescription / Pharmacy / Lab / OT / Blood Bank / Nursing / Billing & Accounts / Financial / HR / Inventory / Ambulance / SMS / Reports -----------------
// NOTE: Your sidebar feature IDs are defined in app/data/features.ts
// (OPD=4, IPD=5, Emergency=6, Prescription=8, Pharmacy=9, Lab=10, OT=11,
// Blood Bank=12, Nursing=13, Billing&Accounts=14, Financial=15,
// HR=16, Inventory=17, Ambulance=18, SMS=19, Reports=20)

export const OPD_TABLE: AdminTableData = {
  columns: ["OPD Visit ID", "Patient", "Patient ID", "Patient Name", "Phone", "Doctor", "Diagnosis", "Prescription", "Date"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 301;
    const patientName = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const patientId = `PT-${i + 1}`;
    const phone = `+8801-000${String(i + 1).padStart(4, "0")}`;

    const doctor = i % 2 === 0 ? "Dr. Sarah Khan" : "Dr. Imran Hossain";
    const diagnosis = i % 2 === 0 ? "Hypertension" : "Diabetes";
    const prescription = i % 2 === 0 ? "Amlodipine" : "Metformin";
    const date = i % 2 === 0 ? "Jun 18, 2026" : "Jun 19, 2026";
    return {
      "OPD Visit ID": `OPD-${idx}`,
      Patient: patientName,
      "Patient ID": patientId,
      "Patient Name": patientName,
      Phone: phone,
      Doctor: doctor,
      Diagnosis: diagnosis,
      Prescription: prescription,
      Date: date,
    };
  }),
};


export const IPD_TABLE: AdminTableData = {
  columns: ["Admission ID", "Patient", "Patient ID", "Patient Name", "Phone", "Ward", "Bed", "Status", "Expected Discharge"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 501;
    const patientName = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const patientId = `PT-${i + 1}`;
    const phone = `+8801-000${String(i + 1).padStart(4, "0")}`;

    const ward = i % 3 === 0 ? "Ward-1" : i % 3 === 1 ? "Ward-2" : "Ward-3";
    const bed = i % 2 === 0 ? "B-12" : "C-03";
    const status = i % 2 === 0 ? "Admitted" : "Under Treatment";
    const expected = i % 2 === 0 ? "Jun 25, 2026" : "Jun 27, 2026";
    return {
      "Admission ID": `IPD-${idx}`,
      Patient: patientName,
      "Patient ID": patientId,
      "Patient Name": patientName,
      Phone: phone,
      Ward: ward,
      Bed: bed,
      Status: status,
      "Expected Discharge": expected,
    };
  }),
};


export const EMERGENCY_TABLE: AdminTableData = {
  columns: ["Emergency ID", "Patient", "Patient ID", "Patient Name", "Phone", "Triage", "Assigned Doctor", "Condition", "Time"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 701;
    const patientName = i % 2 === 0 ? "Patient A" : "Patient B";
    const patientId = `PT-${i + 1}`;
    const phone = `+8801-000${String(i + 1).padStart(4, "0")}`;

    const triage = i % 2 === 0 ? "High" : "Medium";
    const assigned = i % 2 === 0 ? "Dr. Sarah Khan" : "Dr. Imran Hossain";
    const condition = i % 2 === 0 ? "Critical" : "Stable";
    const time = i % 2 === 0 ? "09:15 AM" : "10:05 AM";
    return {
      "Emergency ID": `EMG-${idx}`,
      Patient: patientName,
      "Patient ID": patientId,
      "Patient Name": patientName,
      Phone: phone,
      Triage: triage,
      "Assigned Doctor": assigned,
      Condition: condition,
      Time: time,
    };
  }),
};


export const PRESCRIPTION_TABLE: AdminTableData = {
  columns: ["Prescription ID", "Patient", "Patient ID", "Patient Name", "Phone", "Doctor", "Medication", "Instructions", "Date"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 8001;
    const patientName = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const patientId = `PT-${i + 1}`;
    const phone = `+8801-000${String(i + 1).padStart(4, "0")}`;

    const doctor = i % 2 === 0 ? "Dr. Sarah Khan" : "Dr. Imran Hossain";
    const medication = i % 2 === 0 ? "Amlodipine 5mg" : "Metformin 500mg";
    const instructions = i % 2 === 0 ? "Once daily" : "Twice daily";
    const date = i % 2 === 0 ? "Jun 18, 2026" : "Jun 19, 2026";
    return {
      "Prescription ID": `RX-${idx}`,
      Patient: patientName,
      "Patient ID": patientId,
      "Patient Name": patientName,
      Phone: phone,
      Doctor: doctor,
      Medication: medication,
      Instructions: instructions,
      Date: date,
    };
  }),
};


export const PHARMACY_TABLE: AdminTableData = {
  columns: ["Sale ID", "Patient", "Item", "Qty", "Total", "Status"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 11001;
    const patient = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const item = i % 2 === 0 ? "Amlodipine" : "Metformin";
    const qty = String(i % 5 === 0 ? 10 : i % 7 === 0 ? 20 : 30 + (i % 3) * 5);
    const total = `$${(qty as any).length ? (10 + (i % 20)).toString() : '0'}`;
    const status = i % 4 === 0 ? "Processing" : "Delivered";
    return {
      "Sale ID": `PH-S-${idx}`,
      Patient: patient,
      Item: item,
      Qty: qty,
      Total: total,
      Status: status,
    };
  }),
};


export const LAB_TABLE: AdminTableData = {
  columns: ["Sample ID", "Patient", "Test Name", "Status", "Collected Date", "Report Date"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 9001;
    const patient = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const tests = ["CBC", "Chest X-Ray", "ECG", "Blood Sugar", "Urine Test", "Lipid Profile"];
    const testName = tests[i % tests.length];
    const status = i % 3 === 0 ? "Ready" : i % 3 === 1 ? "Processing" : "Pending";
    const collected = i % 2 === 0 ? "Jun 10, 2026" : "Jun 12, 2026";
    const report = i % 2 === 0 ? "Jun 11, 2026" : "Jun 13, 2026";
    return {
      "Sample ID": `LAB-${idx}`,
      Patient: patient,
      "Test Name": testName,
      Status: status,
      "Collected Date": collected,
      "Report Date": report,
    };
  }),
};


export const OT_TABLE: AdminTableData = {
  columns: ["OT Booking ID", "Patient", "Surgeon", "Procedure", "Date", "Time"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 4001;
    const patient = i % 2 === 0 ? "Patient A" : "Patient B";

    const surgeon = i % 2 === 0 ? "Dr. X" : "Dr. Y";
    const procedure = i % 2 === 0 ? "Appendectomy" : "Knee Surgery";
    const date = i % 2 === 0 ? "Jun 21, 2026" : "Jun 22, 2026";
    const time = i % 2 === 0 ? "01:00 PM" : "03:30 PM";
    return {
      "OT Booking ID": `OT-${idx}`,

      Patient: patient,
      Surgeon: surgeon,
      Procedure: procedure,
      Date: date,
      Time: time,
    };
  }),
};


export const BLOODBANK_TABLE: AdminTableData = {
  columns: ["Donor ID", "Donor Name", "Blood Group", "Collected Unit", "Status", "Expiry"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 1;
    const donor = i % 2 === 0 ? "Donor A" : "Donor B";
    const groups = ["A+", "O-", "B+", "AB+", "A-", "O+"];
    const bloodGroup = groups[i % groups.length];
    const unit = String(i % 4 === 0 ? 2 : 1);
    const status = i % 5 === 0 ? "Used" : "Stored";
    const expiry = i % 2 === 0 ? "2026-12-20" : "2027-01-05";
    return {
      "Donor ID": `DB-${String(idx).padStart(2, '0')}`,
      "Donor Name": donor,
      "Blood Group": bloodGroup,
      "Collected Unit": unit,
      Status: status,
      Expiry: expiry,
    };
  }),
};


export const NURSING_TABLE: AdminTableData = {
  columns: ["Note ID", "Patient", "Shift", "Nursing Summary", "Medication", "Time"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 701;
    const patient = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const shift = i % 2 === 0 ? "Morning" : "Evening";
    const summary = i % 3 === 0 ? "Vitals stable" : i % 3 === 1 ? "Monitoring ongoing" : "Symptoms improved";
    const medication = i % 2 === 0 ? "Amlodipine" : "Metformin";
    const time = i % 2 === 0 ? "08:00 AM" : "08:00 PM";
    return {
      "Note ID": `NR-${idx}`,
      Patient: patient,
      Shift: shift,
      "Nursing Summary": summary,
      Medication: medication,
      Time: time,
    };
  }),
};


export const FINANCIAL_TABLE: AdminTableData = {
  columns: ["Entry ID", "Type", "Description", "Amount", "Date", "Status"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 1001;
    const type = i % 2 === 0 ? "Income" : "Expense";
    const description =
      type === "Income"
        ? i % 3 === 0
          ? "OPD Collection"
          : i % 3 === 1
            ? "Pharmacy Sales"
            : "Lab Income"
        : i % 3 === 0
          ? "Medicine Supplies"
          : i % 3 === 1
            ? "Equipment Maintenance"
            : "Staff Expenses";
    const amount = type === "Income" ? 500 + (i % 800) : 100 + (i % 400);
    const amountStr = `$${amount}`;
    const date = i % 2 === 0 ? "Jun 19, 2026" : "Jun 20, 2026";
    const status = i % 4 === 0 ? "Pending" : i % 4 === 1 ? "Rejected" : "Approved";
    return {
      "Entry ID": `FIN-${idx}`,
      Type: type,
      Description: description,
      Amount: amountStr,
      Date: date,
      Status: status,
    };
  }),
};


export const HR_TABLE: AdminTableData = {
  columns: ["Employee ID", "Name", "Role", "Shift", "Status", "Phone"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 1;
    const name = i % 2 === 0 ? "Employee A" : "Employee B";
    const roles = ["Nurse", "Receptionist", "Doctor Assistant", "Account Assistant", "Lab Support"];
    const role = roles[i % roles.length];
    const shift = i % 2 === 0 ? "Morning" : "Evening";
    const status = i % 4 === 0 ? "Suspended" : i % 4 === 1 ? "On Leave" : "Active";
    const phone = `+8801-000${String(idx).padStart(4, '0')}`;
    return {
      "Employee ID": `HR-${String(idx).padStart(2, '0')}`,
      Name: name,
      Role: role,
      Shift: shift,
      Status: status,
      Phone: phone,
    };
  }),
};


export const AMBULANCE_TABLE: AdminTableData = {
  columns: ["Trip ID", "Patient", "Pickup", "Drop", "Driver", "Status"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 3001;
    const patient = i % 2 === 0 ? "Patient A" : "Patient B";
    const pickup = i % 3 === 0 ? "ER" : i % 3 === 1 ? "Ward-1" : "Ward-2";
    const drop = i % 3 === 0 ? "Ward-2" : i % 3 === 1 ? "Radiology" : "ICU";
    const driver = i % 2 === 0 ? "Driver A" : "Driver B";
    const status = i % 4 === 0 ? "Completed" : i % 4 === 1 ? "In Progress" : "Scheduled";
    return {
      "Trip ID": `AMB-${idx}`,
      Patient: patient,
      Pickup: pickup,
      Drop: drop,
      Driver: driver,
      Status: status,
    };
  }),
};


export const SMS_TABLE: AdminTableData = {
  columns: ["Message ID", "Recipient", "Type", "Content", "Status", "Sent At"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 5001;
    const recipient = i % 2 === 0 ? "John Doe" : "Jane Smith";
    const types = ["Appointment Reminder", "Bill Notification", "Medicine Reminder", "Follow-up Reminder"];
    const type = types[i % types.length];
    const content =
      type === "Appointment Reminder"
        ? "Your appointment is tomorrow."
        : type === "Bill Notification"
          ? "Your bill is ready."
          : type === "Medicine Reminder"
            ? "Time to take your medicine."
            : "Please visit for follow-up.";
    const status = i % 3 === 0 ? "Failed" : "Sent";
    const sentAt = i % 2 === 0 ? "Jun 20, 2026 09:00" : "Jun 20, 2026 10:15";
    return {
      "Message ID": `SMS-${idx}`,
      Recipient: recipient,
      Type: type,
      Content: content,
      Status: status,
      "Sent At": sentAt,
    };
  }),
};


export const REPORTS_TABLE: AdminTableData = {
  columns: ["Report ID", "Report Type", "Generated By", "Period", "Status"],
  rows: Array.from({ length: 1000 }).map((_, i) => {
    const idx = i + 7001;
    const types = ["Patient Report", "Doctor Report", "Appointment Report", "Pharmacy Sales Report", "Lab Income Report", "Financial Report"];
    const type = types[i % types.length];
    const generatedBy =
      type === "Financial Report"
        ? "Accountant"
        : type === "Lab Income Report"
          ? "Lab System"
          : type === "Pharmacy Sales Report"
            ? "Pharmacy System"
            : "System";
    const period = i % 3 === 0 ? "June 2026" : i % 3 === 1 ? "May 2026" : "April 2026";
    const status = i % 4 === 0 ? "Pending" : "Ready";
    return {
      "Report ID": `RPT-${idx}`,
      "Report Type": type,
      "Generated By": generatedBy,
      Period: period,
      Status: status,
    };
  }),
};


// Map feature id -> table data
export const ADMIN_TABLE_BY_FEATURE_ID: Record<number, AdminTableData> = {
  1: PATIENT_TABLE,
  2: DOCTOR_TABLE,
  3: APPOINTMENT_TABLE,
  4: OPD_TABLE,
  5: IPD_TABLE,
  6: EMERGENCY_TABLE,
  7: BED_WARD_TABLE,
  8: PRESCRIPTION_TABLE,
  9: PHARMACY_TABLE,
  10: LAB_TABLE,
  11: OT_TABLE,
  12: BLOODBANK_TABLE,
  13: NURSING_TABLE,
  14: BILLING_TABLE,
  15: FINANCIAL_TABLE,
  16: HR_TABLE,
  17: INVENTORY_TABLE,
  18: AMBULANCE_TABLE,
  19: SMS_TABLE,
  20: REPORTS_TABLE,
};




