import { Router } from "express";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import * as patientController from "./patient.controller";
import {
  contactIdParamSchema,
  createContactSchema,
  createPatientSchema,
  listPatientsQuerySchema,
  patientIdParamSchema,
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