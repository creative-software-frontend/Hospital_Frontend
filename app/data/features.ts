// data/features.ts
import { FiUser, FiActivity, FiCalendar, FiPlusSquare, FiHome, FiHeart, FiLayers, FiFileText, FiBriefcase, FiDatabase, FiUserCheck, FiDollarSign, FiTrendingUp, FiFolder, FiTruck, FiMessageSquare, FiPieChart } from "react-icons/fi";

export interface Feature {
    id: number;
    banglaTitle: string;
    englishTitle: string;
    icon: any;
    subFeatures: string[];
}

export const keyFeatures: Feature[] = [
    {
        id: 1,
        banglaTitle: "১. Patient Management",
        englishTitle: "Patient Management",
        icon: FiUser,
        subFeatures: [
            "Patient Registration", "Patient Profile Management", "Unique Patient ID",
            "Patient History Tracking", "Previous Treatment Records", "Medical Documents Upload",
            "Patient Visit History", "Emergency Patient Registration"
        ]
    },
    {
        id: 2,
        banglaTitle: "২. Doctor Management",
        englishTitle: "Doctor Management",
        icon: FiActivity,
        subFeatures: [
            "Doctor Profile Management", "Department Assignment", "Doctor Schedule Management",
            "Chamber Management", "Doctor Attendance", "Commission Setup",
            "Appointment Management", "Doctor Performance Report"
        ]
    },
    {
        id: 3,
        banglaTitle: "৩. Appointment Management",
        englishTitle: "Appointment Management",
        icon: FiCalendar,
        subFeatures: [
            "Online Appointment Booking", "Walk-in Appointment", "Doctor-wise Appointment",
            "SMS Confirmation", "Appointment Rescheduling", "Appointment Cancellation",
            "Queue Management", "Daily Appointment Report"
        ]
    },
    {
        id: 4,
        banglaTitle: "৪. OPD Management (Out Patient)",
        englishTitle: "OPD Management",
        icon: FiPlusSquare,
        subFeatures: [
            "OPD Registration", "Consultation Records", "Diagnosis Management",
            "Prescription Management", "Follow-up Schedule", "OPD Billing", "Doctor Notes"
        ]
    },
    {
        id: 5,
        banglaTitle: "৫. IPD Management (Indoor Patient)",
        englishTitle: "IPD Management",
        icon: FiHome,
        subFeatures: [
            "Patient Admission", "Bed Allocation", "Ward Management",
            "Cabin Management", "Nursing Notes", "Treatment Management",
            "Daily Monitoring", "Discharge Management", "Discharge Certificate"
        ]
    },
    {
        id: 6,
        banglaTitle: "৬. Emergency Management",
        englishTitle: "Emergency Management",
        icon: FiHeart,
        subFeatures: [
            "Emergency Registration", "Triage Management", "Emergency Doctor Assignment",
            "Emergency Billing", "Critical Patient Monitoring"
        ]
    },
    {
        id: 7,
        banglaTitle: "৭. Bed & Ward Management",
        englishTitle: "Bed & Ward Management",
        icon: FiLayers,
        subFeatures: [
            "Bed Allocation", "Bed Transfer", "Cabin Management",
            "Ward Status Monitoring", "Occupancy Report", "Available Bed Report"
        ]
    },
    {
        id: 8,
        banglaTitle: "৮. Prescription Management",
        englishTitle: "Prescription Management",
        icon: FiFileText,
        subFeatures: [
            "Digital Prescription", "Doctor Signature", "Medicine Recommendation",
            "Diagnosis Notes", "Follow-up Instructions", "Print Prescription", "Email Prescription"
        ]
    },
    {
        id: 9,
        banglaTitle: "৯. Pharmacy Management",
        englishTitle: "Pharmacy Management",
        icon: FiBriefcase,
        subFeatures: [
            "Medicine Purchase", "Medicine Sales", "Stock Management",
            "Expiry Tracking", "Batch Management", "Supplier Management",
            "Barcode System", "Pharmacy Billing"
        ]
    },
    {
        id: 10,
        banglaTitle: "১০. Laboratory Management",
        englishTitle: "Laboratory Management",
        icon: FiDatabase,
        subFeatures: [
            "Test Booking", "Sample Collection", "Test Processing",
            "Report Generation", "Pathology Management", "Radiology Management",
            "Online Report Delivery", "Lab Billing"
        ]
    },
    {
        id: 11,
        banglaTitle: "১১. Operation Theatre (OT) Management",
        englishTitle: "OT Management",
        icon: FiActivity,
        subFeatures: [
            "Surgery Scheduling", "OT Booking", "Surgeon Assignment",
            "Operation Records", "OT Expense Tracking", "Surgery Reports"
        ]
    },
    {
        id: 12,
        banglaTitle: "১২. Blood Bank Management",
        englishTitle: "Blood Bank Management",
        icon: FiHeart,
        subFeatures: [
            "Donor Management", "Blood Collection", "Blood Issue",
            "Blood Stock Monitoring", "Blood Group Tracking", "Blood Expiry Alert"
        ]
    },
    {
        id: 13,
        banglaTitle: "১৩. Nursing Management",
        englishTitle: "Nursing Management",
        icon: FiUserCheck,
        subFeatures: [
            "Nurse Assignment", "Nursing Notes", "Patient Monitoring",
            "Medication Tracking", "Shift Management"
        ]
    },
    {
        id: 14,
        banglaTitle: "১৪. Billing & Accounts Management",
        englishTitle: "Billing & Accounts Management",
        icon: FiDollarSign,
        subFeatures: [
            "Patient Billing", "OPD Billing", "IPD Billing",
            "Pharmacy Billing", "Lab Billing", "Service Billing",
            "Advance Payment", "Due Collection", "Refund Management"
        ]
    },
    {
        id: 15,
        banglaTitle: "১৫. Financial Accounting",
        englishTitle: "Financial Accounting",
        icon: FiTrendingUp,
        subFeatures: [
            "Income Management", "Expense Management", "General Ledger",
            "Cash Book", "Bank Book", "Trial Balance",
            "Profit & Loss", "Balance Sheet"
        ]
    },
    {
        id: 16,
        banglaTitle: "১৬. Human Resource Management (HRM)",
        englishTitle: "Human Resource Management",
        icon: FiBriefcase,
        subFeatures: [
            "Employee Management", "Attendance Management", "Payroll Management",
            "Leave Management", "Shift Management", "Employee Evaluation"
        ]
    },
    {
        id: 17,
        banglaTitle: "১৭. Inventory Management",
        englishTitle: "Inventory Management",
        icon: FiFolder,
        subFeatures: [
            "Medical Equipment Management", "Asset Management", "Inventory Tracking",
            "Purchase Management", "Stock Transfer", "Reorder Alert"
        ]
    },
    {
        id: 18,
        banglaTitle: "১৮. Ambulance Management",
        englishTitle: "Ambulance Management",
        icon: FiTruck,
        subFeatures: [
            "Ambulance Booking", "Driver Management", "Trip Tracking",
            "Fuel Expense Tracking", "Emergency Dispatch"
        ]
    },
    {
        id: 19,
        banglaTitle: "১৯. SMS & Notification System",
        englishTitle: "SMS & Notification System",
        icon: FiMessageSquare,
        subFeatures: [
            "Appointment Reminder", "Bill Notification", "Medicine Reminder",
            "Follow-up Reminder", "Promotional SMS"
        ]
    },
    {
        id: 20,
        banglaTitle: "২০. Reports & Analytics",
        englishTitle: "Reports & Analytics",
        icon: FiPieChart,
        subFeatures: [
            "Daily Collection Report", "Patient Report", "Doctor Report",
            "Appointment Report", "Pharmacy Sales Report", "Lab Income Report",
            "Financial Report", "Management Dashboard"
        ]
    }

];