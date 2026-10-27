import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as patientService from "./patient.service";

/**
 * GET /api/patients/configuration
 *
 * Registration settings for the branch the caller will register into. Guarded
 * by patient create (not patientSetting:read) because the person filling in the
 * form is exactly the person who lacks the settings permission.
 */
export const getPatientConfiguration = asyncHandler(async (req: Request, res: Response) => {
  const requestedBranchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const configuration = await patientService.getPatientRegistrationConfig(
    req.user!,
    Number.isFinite(requestedBranchId) ? requestedBranchId : undefined,
  );
  success(res, { configuration });
});

/**
 * POST /api/patients
 */
export const createPatient = asyncHandler(async (req: Request, res: Response) => {
  const result = await patientService.createPatient(req.user!, req.body);
  created(res, { patient: result });
});

/**
 * GET /api/patients
 */
export const listPatients = asyncHandler(async (req: Request, res: Response) => {
  const result = await patientService.listPatients(req.user!, req.query as never);
  list(res, result.data, result.pagination);
});

/**
 * GET /api/patients/:id
 */
export const getPatient = asyncHandler(async (req: Request, res: Response) => {
  const patient = await patientService.getPatient(req.user!, Number(req.params.id));
  success(res, { patient });
});

/**
 * GET /api/patients/:id/history
 */
export const getPatientHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await patientService.getPatientHistory(req.user!, Number(req.params.id));
  success(res, history);
});

/**
 * GET /api/patients/:id/treatment-records
 */
export const listPatientTreatmentRecords = asyncHandler(async (req: Request, res: Response) => {
  const result = await patientService.listPatientTreatmentRecords(
    req.user!,
    Number(req.params.id),
    (req.validatedQuery ?? {}) as never,
  );
  // Flat paginated payload (data + pagination) plus the patient header the
  // records belong to, so the UI does not need a second request.
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    patient: result.patient,
  });
});

/**
 * GET /api/patients/:id/visits
 */
export const listPatientVisits = asyncHandler(async (req: Request, res: Response) => {
  const result = await patientService.listPatientVisits(
    req.user!,
    Number(req.params.id),
    (req.validatedQuery ?? {}) as never,
  );
  // Ledger page: paginated rows plus the patient header and the whole-history
  // summary the stat tile row renders.
  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
    patient: result.patient,
    summary: result.summary,
  });
});

/**
 * PATCH /api/patients/:id
 */
export const updatePatient = asyncHandler(async (req: Request, res: Response) => {
  const patient = await patientService.updatePatient(req.user!, Number(req.params.id), req.body);
  success(res, { patient });
});

/**
 * PATCH /api/patients/:id/status
 */
export const updatePatientStatus = asyncHandler(async (req: Request, res: Response) => {
  const result = await patientService.updatePatientStatus(req.user!, Number(req.params.id), req.body);
  success(res, { patient: result });
});

/**
 * DELETE /api/patients/:id
 */
export const deletePatient = asyncHandler(async (req: Request, res: Response) => {
  await patientService.deletePatient(req.user!, Number(req.params.id));
  success(res, { message: "Patient deleted successfully" });
});

/**
 * GET /api/patients/:id/documents
 */
export const listPatientDocuments = asyncHandler(async (req: Request, res: Response) => {
  const documents = await patientService.listPatientDocuments(req.user!, Number(req.params.id));
  success(res, { documents });
});

/**
 * POST /api/patients/:id/documents
 */
export const createPatientDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await patientService.createPatientDocument(
    req.user!,
    Number(req.params.id),
    req.body,
  );
  created(res, { document });
});

/**
 * DELETE /api/patients/:id/documents/:documentId
 */
export const deletePatientDocument = asyncHandler(async (req: Request, res: Response) => {
  await patientService.deletePatientDocument(
    req.user!,
    Number(req.params.id),
    Number(req.params.documentId),
  );
  success(res, { message: "Document deleted successfully" });
});

/**
 * GET /api/patients/:id/contacts
 */
export const listContacts = asyncHandler(async (req: Request, res: Response) => {
  const contacts = await patientService.listContacts(req.user!, Number(req.params.id));
  success(res, { contacts });
});

/**
 * POST /api/patients/:id/contacts
 */
export const createContact = asyncHandler(async (req: Request, res: Response) => {
  const contact = await patientService.createContact(req.user!, Number(req.params.id), req.body);
  created(res, { contact });
});

/**
 * PATCH /api/patients/:id/contacts/:contactId
 */
export const updateContact = asyncHandler(async (req: Request, res: Response) => {
  const contact = await patientService.updateContact(
    req.user!,
    Number(req.params.id),
    Number(req.params.contactId),
    req.body,
  );
  success(res, { contact });
});

/**
 * DELETE /api/patients/:id/contacts/:contactId
 */
export const deleteContact = asyncHandler(async (req: Request, res: Response) => {
  await patientService.deleteContact(req.user!, Number(req.params.id), Number(req.params.contactId));
  success(res, { message: "Contact deleted successfully" });
});