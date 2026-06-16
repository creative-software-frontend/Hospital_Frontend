// data/features.ts
import {
    FiUser, FiActivity, FiCalendar, FiPlusSquare, FiHome, FiHeart, FiLayers, FiFileText, FiBriefcase,
    FiDatabase, FiUserCheck, FiDollarSign, FiTrendingUp, FiFolder, FiTruck, FiMessageSquare, FiPieChart,
    FiClipboard, FiEdit, FiAlertCircle, FiClock, FiPrinter, FiMail, FiBarChart2, FiTag, FiPackage,
    FiShoppingCart, FiRefreshCcw, FiMapPin, FiAlertTriangle, FiCreditCard, FiCheckSquare, FiBell, FiSettings,
    FiUsers, FiNavigation, FiToggleRight, FiDroplet, FiThermometer, FiBookOpen,
    FiStar, FiRepeat, FiPhone, FiGlobe, FiZap, FiLock
} from "react-icons/fi";

export interface SubFeatureItem {
    label: string;
    icon: any;
}

export interface Feature {
    id: number;
    englishTitle: string;
    icon: any;
    subFeatures: SubFeatureItem[];
}

export const keyFeatures: Feature[] = [
    {
        id: 1,
        englishTitle: "Patient Management",
        icon: FiUser,
        subFeatures: [
            { label: "Patient Registration", icon: FiClipboard },
            { label: "Patient Profile Management", icon: FiUser },
            { label: "Unique Patient ID", icon: FiTag },
            { label: "Patient History Tracking", icon: FiActivity },
            { label: "Previous Treatment Records", icon: FiFileText },
            { label: "Medical Documents Upload", icon: FiBookOpen },
            { label: "Patient Visit History", icon: FiClock },
            { label: "Emergency Patient Registration", icon: FiAlertCircle },
        ]
    },
    {
        id: 2,
        englishTitle: "Doctor Management",
        icon: FiActivity,
        subFeatures: [
            { label: "Doctor Profile Management", icon: FiUser },
            { label: "Department Assignment", icon: FiFolder },
            { label: "Doctor Schedule Management", icon: FiCalendar },
            { label: "Chamber Management", icon: FiHome },
            { label: "Doctor Attendance", icon: FiCheckSquare },
            { label: "Commission Setup", icon: FiDollarSign },
            { label: "Appointment Management", icon: FiCalendar },
            { label: "Doctor Performance Report", icon: FiBarChart2 },
        ]
    },
    {
        id: 3,
        englishTitle: "Appointment Management",
        icon: FiCalendar,
        subFeatures: [
            { label: "Online Appointment Booking", icon: FiGlobe },
            { label: "Walk-in Appointment", icon: FiUser },
            { label: "Doctor-wise Appointment", icon: FiActivity },
            { label: "SMS Confirmation", icon: FiPhone },
            { label: "Appointment Rescheduling", icon: FiRepeat },
            { label: "Appointment Cancellation", icon: FiAlertCircle },
            { label: "Queue Management", icon: FiUsers },
            { label: "Daily Appointment Report", icon: FiFileText },
        ]
    },
    {
        id: 4,
        englishTitle: "OPD Management",
        icon: FiPlusSquare,
        subFeatures: [
            { label: "OPD Registration", icon: FiClipboard },
            { label: "Consultation Records", icon: FiFileText },
            { label: "Diagnosis Management", icon: FiActivity },
            { label: "Prescription Management", icon: FiEdit },
            { label: "Follow-up Schedule", icon: FiCalendar },
            { label: "OPD Billing", icon: FiDollarSign },
            { label: "Doctor Notes", icon: FiBookOpen },
        ]
    },
    {
        id: 5,
        englishTitle: "IPD Management",
        icon: FiHome,
        subFeatures: [
            { label: "Patient Admission", icon: FiClipboard },
            { label: "Bed Allocation", icon: FiLayers },
            { label: "Ward Management", icon: FiHome },
            { label: "Cabin Management", icon: FiLock },
            { label: "Nursing Notes", icon: FiEdit },
            { label: "Treatment Management", icon: FiActivity },
            { label: "Daily Monitoring", icon: FiThermometer },
            { label: "Discharge Management", icon: FiNavigation },
            { label: "Discharge Certificate", icon: FiFileText },
        ]
    },
    {
        id: 6,
        englishTitle: "Emergency Management",
        icon: FiHeart,
        subFeatures: [
            { label: "Emergency Registration", icon: FiAlertCircle },
            { label: "Triage Management", icon: FiAlertTriangle },
            { label: "Emergency Doctor Assignment", icon: FiActivity },
            { label: "Emergency Billing", icon: FiDollarSign },
            { label: "Critical Patient Monitoring", icon: FiThermometer },
        ]
    },
    {
        id: 7,
        englishTitle: "Bed & Ward Management",
        icon: FiLayers,
        subFeatures: [
            { label: "Bed Allocation", icon: FiLayers },
            { label: "Bed Transfer", icon: FiRepeat },
            { label: "Cabin Management", icon: FiHome },
            { label: "Ward Status Monitoring", icon: FiActivity },
            { label: "Occupancy Report", icon: FiBarChart2 },
            { label: "Available Bed Report", icon: FiFileText },
        ]
    },
    {
        id: 8,
        englishTitle: "Prescription Management",
        icon: FiFileText,
        subFeatures: [
            { label: "Digital Prescription", icon: FiEdit },
            { label: "Doctor Signature", icon: FiCheckSquare },
            { label: "Medicine Recommendation", icon: FiBriefcase },
            { label: "Diagnosis Notes", icon: FiClipboard },
            { label: "Follow-up Instructions", icon: FiCalendar },
            { label: "Print Prescription", icon: FiPrinter },
            { label: "Email Prescription", icon: FiMail },
        ]
    },
    {
        id: 9,
        englishTitle: "Pharmacy Management",
        icon: FiBriefcase,
        subFeatures: [
            { label: "Medicine Purchase", icon: FiShoppingCart },
            { label: "Medicine Sales", icon: FiDollarSign },
            { label: "Stock Management", icon: FiPackage },
            { label: "Expiry Tracking", icon: FiClock },
            { label: "Batch Management", icon: FiTag },
            { label: "Supplier Management", icon: FiUsers },
            { label: "Barcode System", icon: FiToggleRight },
            { label: "Pharmacy Billing", icon: FiCreditCard },
        ]
    },
    {
        id: 10,
        englishTitle: "Laboratory Management",
        icon: FiDatabase,
        subFeatures: [
            { label: "Test Booking", icon: FiCalendar },
            { label: "Sample Collection", icon: FiDroplet },
            { label: "Test Processing", icon: FiActivity },
            { label: "Report Generation", icon: FiFileText },
            { label: "Pathology Management", icon: FiDatabase },
            { label: "Radiology Management", icon: FiZap },
            { label: "Online Report Delivery", icon: FiGlobe },
            { label: "Lab Billing", icon: FiCreditCard },
        ]
    },
    {
        id: 11,
        englishTitle: "OT Management",
        icon: FiActivity,
        subFeatures: [
            { label: "Surgery Scheduling", icon: FiCalendar },
            { label: "OT Booking", icon: FiClipboard },
            { label: "Surgeon Assignment", icon: FiActivity },
            { label: "Operation Records", icon: FiFileText },
            { label: "OT Expense Tracking", icon: FiDollarSign },
            { label: "Surgery Reports", icon: FiBarChart2 },
        ]
    },
    {
        id: 12,
        englishTitle: "Blood Bank Management",
        icon: FiHeart,
        subFeatures: [
            { label: "Donor Management", icon: FiUsers },
            { label: "Blood Collection", icon: FiDroplet },
            { label: "Blood Issue", icon: FiPackage },
            { label: "Blood Stock Monitoring", icon: FiActivity },
            { label: "Blood Group Tracking", icon: FiTag },
            { label: "Blood Expiry Alert", icon: FiAlertTriangle },
        ]
    },
    {
        id: 13,
        englishTitle: "Nursing Management",
        icon: FiUserCheck,
        subFeatures: [
            { label: "Nurse Assignment", icon: FiUsers },
            { label: "Nursing Notes", icon: FiEdit },
            { label: "Patient Monitoring", icon: FiThermometer },
            { label: "Medication Tracking", icon: FiBriefcase },
            { label: "Shift Management", icon: FiClock },
        ]
    },
    {
        id: 14,
        englishTitle: "Billing & Accounts Management",
        icon: FiDollarSign,
        subFeatures: [
            { label: "Patient Billing", icon: FiCreditCard },
            { label: "OPD Billing", icon: FiPlusSquare },
            { label: "IPD Billing", icon: FiHome },
            { label: "Pharmacy Billing", icon: FiBriefcase },
            { label: "Lab Billing", icon: FiDatabase },
            { label: "Service Billing", icon: FiTag },
            { label: "Advance Payment", icon: FiDollarSign },
            { label: "Due Collection", icon: FiRefreshCcw },
            { label: "Refund Management", icon: FiRepeat },
        ]
    },
    {
        id: 15,
        englishTitle: "Financial Accounting",
        icon: FiTrendingUp,
        subFeatures: [
            { label: "Income Management", icon: FiTrendingUp },
            { label: "Expense Management", icon: FiBarChart2 },
            { label: "General Ledger", icon: FiBookOpen },
            { label: "Cash Book", icon: FiDollarSign },
            { label: "Bank Book", icon: FiCreditCard },
            { label: "Trial Balance", icon: FiCheckSquare },
            { label: "Profit & Loss", icon: FiPieChart },
            { label: "Balance Sheet", icon: FiFileText },
        ]
    },
    {
        id: 16,
        englishTitle: "Human Resource Management",
        icon: FiBriefcase,
        subFeatures: [
            { label: "Employee Management", icon: FiUsers },
            { label: "Attendance Management", icon: FiCheckSquare },
            { label: "Payroll Management", icon: FiDollarSign },
            { label: "Leave Management", icon: FiCalendar },
            { label: "Shift Management", icon: FiClock },
            { label: "Employee Evaluation", icon: FiStar },
        ]
    },
    {
        id: 17,
        englishTitle: "Inventory Management",
        icon: FiFolder,
        subFeatures: [
            { label: "Medical Equipment Management", icon: FiSettings },
            { label: "Asset Management", icon: FiPackage },
            { label: "Inventory Tracking", icon: FiActivity },
            { label: "Purchase Management", icon: FiShoppingCart },
            { label: "Stock Transfer", icon: FiRepeat },
            { label: "Reorder Alert", icon: FiAlertTriangle },
        ]
    },
    {
        id: 18,
        englishTitle: "Ambulance Management",
        icon: FiTruck,
        subFeatures: [
            { label: "Ambulance Booking", icon: FiPhone },
            { label: "Driver Management", icon: FiUser },
            { label: "Trip Tracking", icon: FiMapPin },
            { label: "Fuel Expense Tracking", icon: FiDollarSign },
            { label: "Emergency Dispatch", icon: FiNavigation },
        ]
    },
    {
        id: 19,
        englishTitle: "SMS & Notification System",
        icon: FiMessageSquare,
        subFeatures: [
            { label: "Appointment Reminder", icon: FiBell },
            { label: "Bill Notification", icon: FiCreditCard },
            { label: "Medicine Reminder", icon: FiBriefcase },
            { label: "Follow-up Reminder", icon: FiCalendar },
            { label: "Promotional SMS", icon: FiMessageSquare },
        ]
    },
    {
        id: 20,
        englishTitle: "Reports & Analytics",
        icon: FiPieChart,
        subFeatures: [
            { label: "Daily Collection Report", icon: FiDollarSign },
            { label: "Patient Report", icon: FiUser },
            { label: "Doctor Report", icon: FiActivity },
            { label: "Appointment Report", icon: FiCalendar },
            { label: "Pharmacy Sales Report", icon: FiBriefcase },
            { label: "Lab Income Report", icon: FiDatabase },
            { label: "Financial Report", icon: FiTrendingUp },
            { label: "Management Dashboard", icon: FiPieChart },
        ]
    },
];