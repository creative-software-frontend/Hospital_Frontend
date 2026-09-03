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

  return <MockSettingsView page={page} />;
};
