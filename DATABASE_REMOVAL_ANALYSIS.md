# Final Database Dependency & Removal Analysis

**Scope:** All 106 tables. Read-only. No changes made.

## Category 1 — SAFE TO REMOVE (0 code refs, 0 incoming FKs, 0 data rows)

These can be dropped with a single migration, no code changes needed.

| Table | Rows | Code refs | Incoming FKs | Why safe |
|---|---|---|---|---|
| `smsgateway` | 0 | 0 | none | No model, no service, no UI. Completely orphaned. |
| `emailsetting` | 0 | 0 | none | Same. |
| `salarycomponent` | 0 | 0 | none | Same. HR settings use `annualLeaveDays` instead. |

**Impact:** None. No feature, API, or report references them.

---

## Category 2 — REMOVE ONLY AFTER DEPENDENCY CHANGES

These have 0 direct code references but are referenced by Prisma models (foreign keys / back-relations). Dropping them requires updating the dependent models and services first. All have 0 data rows except `prescriptiontemplate` (0) and `union` (9,080 rows).

### 2a. Bed & Ward legacy structures

| Table | Rows | Dependency to fix before drop |
|---|---|---|
| `bedstatus` | 0 | Remove `"bed-statuses"` kind from `bedWard.registry.ts` + `bedWard.validation.ts`; remove `Branch.bedStatuses` relation. |
| `ward` | 0 | Remove `Branch.wards`, `Floor.wards`, `Room.ward` relations. |
| `room` | 0 | Remove `Branch.rooms`, `DoctorSchedule.roomId` (FK + column), `Bed.roomId`, `Ward.rooms` relations. |
| `bed` | 0 | Migrate `ipd.service.ts` (2 refs: `prisma.bed.findFirst` + `tx.bed.update`) to use `BedDefinition`; remove `Branch.beds`, `Admission.bedId` (already repointed to `BedDefinition`), `Bed.roomId`/`Bed.branchId` relations. |

### 2b. Lab module (future, backend read-only)

| Table | Rows | Dependency to fix |
|---|---|---|
| `labcategory` | 0 | Remove `LabTest.category` relation + `categoryId` column on `LabTest`. |
| `labtestparameter` | 0 | Remove `LabTest.parameters` + `LabResultValue.parameter` relations + `parameterId` column. |
| `labsample` | 0 | Remove `Branch.labSamples`, `LabOrder.labSample`, `LabResult.labSample` relations + `labSampleId` columns. |
| `labresult` | 0 | Remove `Branch.labResults`, `Doctor.labResults`, `LabOrderItem.labResult`, `LabSample.labResult`, `LabResultValue.labResult` relations + `labResultId` columns. |
| `labresultvalue` | 0 | Remove `LabTestParameter.labResultValues`, `LabResult.labResultValues` relations. |

### 2c. Inventory module (future, no backend)

| Table | Rows | Dependency to fix |
|---|---|---|
| `inventorycategory` | 0 | Remove `InventoryItem.category` relation + `categoryId` column. |
| `warehouse` | 0 | Remove `Branch.warehouses`, `Employee.warehouses`, `InventoryStock.warehouse` relations + `warehouseId` columns. |
| `inventoryitem` | 0 | Remove `Branch.inventoryItems`, `MedicineUnit.inventoryItems`, `InventoryCategory.inventoryItems`, `InventoryStock.inventoryItem` relations + `inventoryItemId` columns. |
| `inventorystock` | 0 | Remove `Branch.inventoryStocks`, `Warehouse.inventoryStocks`, `InventoryItem.inventoryStocks` relations. |

### 2d. Accounting module (future, no backend)

| Table | Rows | Dependency to fix |
|---|---|---|
| `accountcategory` | 0 | Remove `Account.category` relation + `categoryId` column. |
| `account` | 0 | Remove `Branch.accounts`, `AccountCategory.accounts`, `AccountingEntry.account` relations + `accountId` columns. |
| `accountingtransaction` | 0 | Remove `Branch.accountingTransactions`, `AccountingEntry.transaction` relations + `transactionId` columns. |
| `accountingentry` | 0 | Remove `Account.accountingEntries`, `AccountingTransaction.accountingEntries` relations. |

### 2e. Billing (future, backend writes invoices only)

| Table | Rows | Dependency to fix |
|---|---|---|
| `payment` | 0 | Remove `Branch.payments`, `Patient.payments`, `PaymentMethod.payments`, `Invoice.payments`, `PaymentAllocation.payment` relations + `paymentId` columns. |
| `paymentallocation` | 0 | Remove `Invoice.paymentAllocations`, `Payment.paymentAllocations` relations. |

### 2f. Pharmacy lookups (future, backend writes medicines)

| Table | Rows | Dependency to fix |
|---|---|---|
| `medicinecategory` | 0 | Remove `Medicine.category` relation + `categoryId` column from `Medicine` model and `pharmacy.service.ts` / `pharmacy.validation.ts`. |
| `medicineunit` | 0 | Remove `Medicine.unit` relation + `unitId` column from `Medicine` model and `pharmacy.service.ts` / `pharmacy.validation.ts`; remove `InventoryItem.unit` relation. |

### 2g. Other

| Table | Rows | Dependency to fix |
|---|---|---|
| `prescriptiontemplate` | 0 | Remove `Branch.prescriptionTemplates` and `PrescriptionSetting.template` relations + `templateId` column. |
| `union` | 9,080 | Remove `Upazila.unions` back-relation + `Union` model. Loses imported national reference data. |

---

## Category 3 — MUST KEEP (actively used by implemented features)

All tables below are read or written by at least one implemented, working feature (Settings, Patient, Doctor, Nurse, Employee, Bed & Ward, Appointment backend, Nursing, or system/auth).

| Table | Why it must stay |
|---|---|
| `_prisma_migrations` | System (migration history) |
| `user`, `userrole`, `role`, `rolepermission`, `permission` | Auth & RBAC |
| `usersession`, `loginattempt`, `auditlog` | Auth / audit |
| `systemmaintenance`, `codesequence` | System |
| `branch`, `department`, `designation`, `employeetype`, `shifttype` | Organization |
| `employee` | HR (implemented) |
| `patient`, `patientcontact`, `patientdocument` | Patient (implemented) |
| `patientvital`, `medicationadministration`, `nursingnote` | Nursing (implemented) |
| `doctor`, `doctorattendance`, `doctorschedule` | Doctor (implemented) |
| `chamber`, `chamberschedule` | Doctor (implemented) |
| `nurse` | Nurse (implemented) |
| `floor`, `bedgroup`, `bedtype`, `beddefinition`, `bedtransfer` | Bed & Ward (implemented) |
| `appointment`, `medicalrecord`, `medicalrecorddiagnosis` | Appointment (backend) |
| `diagnosis`, `diagnosiscategory` | Read via treatment records |
| `prescription`, `prescriptionitem` | Read via medication tracking |
| `admission` | IPD (backend) |
| `medicine`, `medicinebatch`, `stockmovement` | Pharmacy (backend) |
| `labtest`, `laborder`, `laborderitem` | Lab (read-only via treatment records) |
| `invoice`, `invoiceitem`, `paymentmethod` | Billing (backend writes invoices) |
| `service`, `servicecategory` | Settings |
| All `*setting` tables (15) | Settings |
| `integration`, `documenttemplate`, `reportsetting` | Settings |
| `backuplog`, `backupsetting` | Settings |
| `division`, `district`, `upazila` | Address cascade (used by forms) |
| `union` | Moved to Category 2 (no UI consumer) |
| `visittype`, `bloodgroup`, `documenttype`, `patientrelationship` | Master data (used by forms) |
| `leavetype` | Now active (Leave Management) |
| `employeeattendance` | Now active (Attendance Management) |
| `employeeevaluation` | Now active (Employee Evaluation) |

---

## Summary counts

| Category | Count | Tables |
|---|---|---|
| SAFE TO REMOVE | 3 | `smsgateway`, `emailsetting`, `salarycomponent` |
| REMOVE AFTER DEPENDENCY CHANGES | 23 | `bedstatus`, `prescriptiontemplate`, `ward`, `room`, `bed`, `labcategory`, `labtestparameter`, `labsample`, `labresult`, `labresultvalue`, `inventorycategory`, `warehouse`, `inventoryitem`, `inventorystock`, `accountcategory`, `account`, `accountingtransaction`, `accountingentry`, `payment`, `paymentallocation`, `medicinecategory`, `medicineunit`, `union` |
| MUST KEEP | 80 | (listed above) |
| **Total** | **106** | |

## Data preservation notes

- All Tier 2 tables have **0 rows** except `union` (9,080 imported rows) and `prescriptiontemplate` (0 rows — earlier count of 6 was `documenttemplate`, a different table).
- No existing data needs migration for any table except `union` (reference data) and `prescriptiontemplate` (none).
- Removing `medicineunit`/`medicinecategory` requires dropping `categoryId`/`unitId` from `Medicine` and `unitId` from `InventoryItem`.
- Removing `bed` requires updating `ipd.service.ts` (2 references) to use `BedDefinition`.

## Recommendation

1. **Remove the 3 SAFE tables now** (`smsgateway`, `emailsetting`, `salarycomponent`) — zero risk, no code changes.
2. **Remove Tier 2 tables in batches** grouped by module (Lab, Inventory, Accounting, Billing, Pharmacy, Bed legacy, PrescriptionTemplate, Union), each with its dependency updates and a migration.
3. **Keep all MUST KEEP tables** — they are referenced by implemented or backend-active features.

**No changes have been made. Waiting for your approval before implementation.**
