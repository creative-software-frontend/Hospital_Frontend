import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { success, created, list } from "../../utils/apiResponse";
import * as patientService from "./patient.service";

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