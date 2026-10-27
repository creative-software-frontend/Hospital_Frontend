import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as patientController from "./patient.controller";
import {
  contactIdParamSchema,
  createContactSchema,
  createPatientDocumentSchema,
  createPatientSchema,
  listPatientsQuerySchema,
  patientDocumentParamSchema,
  patientIdParamSchema,
  patientVisitsQuerySchema,
  treatmentRecordsQuerySchema,
  updateContactSchema,
  updatePatientSchema,
  updatePatientStatusSchema,
} from "./patient.validation";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  validate({ query: listPatientsQuerySchema }),
  requirePermission("patient", "read"),
  patientController.listPatients,
);

// Declared before "/:id" so "configuration" is never parsed as a patient id.
router.get(
  "/configuration",
  requirePermission("patient", "create"),
  patientController.getPatientConfiguration,
);

router.post(
  "/",
  validate({ body: createPatientSchema }),
  requirePermission("patient", "create"),
  patientController.createPatient,
);

router.get(
  "/:id",
  validate({ params: patientIdParamSchema }),
  requirePermission("patient", "read"),
  patientController.getPatient,
);

// Read-only clinical timeline (appointments + visits + admissions).
router.get(
  "/:id/history",
  validate({ params: patientIdParamSchema }),
  requirePermission("patient", "read"),
  patientController.getPatientHistory,
);

// Read-only full treatment records (diagnoses + medicines + lab tests).
router.get(
  "/:id/treatment-records",
  validate({ params: patientIdParamSchema, query: treatmentRecordsQuerySchema }),
  requirePermission("patient", "read"),
  patientController.listPatientTreatmentRecords,
);

// Read-only visit ledger (compact, filterable encounter list).
router.get(
  "/:id/visits",
  validate({ params: patientIdParamSchema, query: patientVisitsQuerySchema }),
  requirePermission("patient", "read"),
  patientController.listPatientVisits,
);

router.patch(
  "/:id",
  validate({ params: patientIdParamSchema, body: updatePatientSchema }),
  requirePermission("patient", "update"),
  patientController.updatePatient,
);

router.patch(
  "/:id/status",
  validate({ params: patientIdParamSchema, body: updatePatientStatusSchema }),
  requirePermission("patient", "update"),
  patientController.updatePatientStatus,
);

router.delete(
  "/:id",
  validate({ params: patientIdParamSchema }),
  requirePermission("patient", "delete"),
  patientController.deletePatient,
);

// Uploaded document sub-resources (scans, referral letters, insurance cards).
router.get(
  "/:id/documents",
  validate({ params: patientIdParamSchema }),
  requirePermission("patient", "read"),
  patientController.listPatientDocuments,
);

router.post(
  "/:id/documents",
  validate({ params: patientIdParamSchema, body: createPatientDocumentSchema }),
  requirePermission("patient", "update"),
  patientController.createPatientDocument,
);

router.delete(
  "/:id/documents/:documentId",
  validate({ params: patientDocumentParamSchema }),
  requirePermission("patient", "update"),
  patientController.deletePatientDocument,
);

// Contact sub-resources
router.get(
  "/:id/contacts",
  validate({ params: patientIdParamSchema }),
  requirePermission("patient", "read"),
  patientController.listContacts,
);

router.post(
  "/:id/contacts",
  validate({ params: patientIdParamSchema, body: createContactSchema }),
  requirePermission("patient", "update"),
  patientController.createContact,
);

router.patch(
  "/:id/contacts/:contactId",
  validate({ params: contactIdParamSchema, body: updateContactSchema }),
  requirePermission("patient", "update"),
  patientController.updateContact,
);

router.delete(
  "/:id/contacts/:contactId",
  validate({ params: contactIdParamSchema }),
  requirePermission("patient", "update"),
  patientController.deleteContact,
);

export default router;