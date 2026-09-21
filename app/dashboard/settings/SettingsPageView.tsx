// dashboard/settings/SettingsPageView.tsx
"use client";

import type { SettingsPageData } from "@/app/data/settingsData";
import { UserRoleManagementView } from "@/app/dashboard/settings/users/UserRoleManagementView";
import { GeneralSettingsView } from "@/app/dashboard/settings/general/GeneralSettingsView";
import { BranchSettingsView } from "@/app/dashboard/settings/branches/BranchSettingsView";
import { SecuritySettingsView } from "@/app/dashboard/settings/security/SecuritySettingsView";
import { DepartmentsView } from "@/app/dashboard/settings/departments/DepartmentsView";
import { DoctorsView } from "@/app/dashboard/settings/doctors/DoctorsView";
import { ServicesView } from "@/app/dashboard/settings/services/ServicesView";
import { PatientConfigurationView } from "@/app/dashboard/settings/patient/PatientConfigurationView";
import { OpdSettingsView } from "@/app/dashboard/settings/clinical/opd/OpdSettingsView";
import { IpdSettingsView } from "@/app/dashboard/settings/clinical/ipd/IpdSettingsView";
import { EmergencySettingsView } from "@/app/dashboard/settings/clinical/emergency/EmergencySettingsView";
import { PrescriptionSettingsView } from "@/app/dashboard/settings/clinical/prescription/PrescriptionSettingsView";
import { PharmacySettingsView } from "@/app/dashboard/settings/pharmacy/PharmacySettingsView";
import { LabSettingsView } from "@/app/dashboard/settings/laboratory/LabSettingsView";
import { BillingSettingsView } from "@/app/dashboard/settings/billing/BillingSettingsView";
import { AccountingSettingsView } from "@/app/dashboard/settings/accounting/AccountingSettingsView";
import { HrSettingsView } from "@/app/dashboard/settings/hr/HrSettingsView";
import { InventorySettingsView } from "@/app/dashboard/settings/inventory/InventorySettingsView";
import { NotificationSettingsView } from "@/app/dashboard/settings/notification/NotificationSettingsView";
import { PrintDocumentView } from "@/app/dashboard/settings/print-document/PrintDocumentView";
import { ApiIntegrationView } from "@/app/dashboard/settings/api-integration/ApiIntegrationView";
import { BackupDatabaseView } from "@/app/dashboard/settings/backup-database/BackupDatabaseView";
import { ReportsView } from "@/app/dashboard/settings/reports/ReportsView";
import { MasterDataView } from "@/app/dashboard/settings/master-data/MasterDataView";
import { LocalizationView } from "@/app/dashboard/settings/localization/LocalizationView";
import { SystemMaintenanceView } from "@/app/dashboard/settings/system-maintenance/SystemMaintenanceView";
import { AuditCenterView } from "@/app/dashboard/settings/audit/AuditCenterView";
import { MockSettingsView } from "@/app/dashboard/settings/mock/MockSettingsView";

export const SettingsPageView = ({
  page,
  pageKey,
}: {
  page: SettingsPageData;
  pageKey?: string;
}) => {
  if (pageKey === "user-role-management") {
    return <UserRoleManagementView />;
  }

  if (pageKey === "general-settings") {
    return <GeneralSettingsView />;
  }

  if (pageKey === "branch-settings") {
    return <BranchSettingsView />;
  }

  if (pageKey === "security") {
    return <SecuritySettingsView />;
  }

  if (pageKey === "hc-departments") {
    return <DepartmentsView />;
  }

  if (pageKey === "hc-doctors") {
    return <DoctorsView />;
  }

  if (pageKey === "hc-services") {
    return <ServicesView />;
  }

  if (pageKey === "hc-patients") {
    return <PatientConfigurationView />;
  }

  if (pageKey === "clinical-opd") {
    return <OpdSettingsView />;
  }

  if (pageKey === "clinical-ipd") {
    return <IpdSettingsView />;
  }

  if (pageKey === "clinical-emergency") {
    return <EmergencySettingsView />;
  }

  if (pageKey === "clinical-prescription") {
    return <PrescriptionSettingsView />;
  }

  if (pageKey === "pharmacy-settings") {
    return <PharmacySettingsView />;
  }

  if (pageKey === "laboratory-settings") {
    return <LabSettingsView />;
  }

  if (pageKey === "billing-settings") {
    return <BillingSettingsView />;
  }

  if (pageKey === "accounting-settings") {
    return <AccountingSettingsView />;
  }

  if (pageKey === "hr-payroll") {
    return <HrSettingsView />;
  }

  if (pageKey === "inventory") {
    return <InventorySettingsView />;
  }

  if (pageKey === "notification") {
    return <NotificationSettingsView />;
  }

  if (pageKey === "print-document") {
    return <PrintDocumentView />;
  }

  if (pageKey === "api-integration") {
    return <ApiIntegrationView />;
  }

  if (pageKey === "backup-database") {
    return <BackupDatabaseView />;
  }

  if (pageKey === "reports") {
    return <ReportsView />;
  }

  if (pageKey === "master-data") {
    return <MasterDataView />;
  }

  if (pageKey === "localization") {
    return <LocalizationView />;
  }

  if (pageKey === "system-maintenance") {
    return <SystemMaintenanceView />;
  }

  if (pageKey === "audit-center") {
    return <AuditCenterView />;
  }

  return <MockSettingsView page={page} />;
};
