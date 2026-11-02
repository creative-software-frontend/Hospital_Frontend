import { z } from "zod";

const optionalDate = z.string().trim().optional().nullable().transform((value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
});

export const nursingNoteIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listNursingNotesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  patientId: z.coerce.number().int().positive().optional(),
  nurseId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
});

export const createNursingNoteSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  nurseId: z.coerce.number().int().positive(),
  admissionId: z.coerce.number().int().positive().optional().nullable(),
  noteType: z.string().trim().min(1).max(50).default("GENERAL"),
  note: z.string().trim().min(1).max(2000),
  observedAt: optionalDate,
});

export const updateNursingNoteSchema = createNursingNoteSchema
  .omit({ patientId: true, nurseId: true })
  .partial();

export type ListNursingNotesQuery = z.infer<typeof listNursingNotesQuerySchema>;
export type CreateNursingNoteInput = z.infer<typeof createNursingNoteSchema>;
export type UpdateNursingNoteInput = z.infer<typeof updateNursingNoteSchema>;
