import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requirePermission } from "../../middleware/permission.middleware";
import { validate } from "../../middleware/validation.middleware";
import * as controller from "./nursing-note.controller";
import { createNursingNoteSchema, listNursingNotesQuerySchema, nursingNoteIdParamSchema, updateNursingNoteSchema } from "./nursing-note.validation";

const router = Router();
router.use(requireAuth);
router.get("/", validate({ query: listNursingNotesQuerySchema }), requirePermission("nursingNote", "read"), controller.listNursingNotes);
router.get("/:id", validate({ params: nursingNoteIdParamSchema }), requirePermission("nursingNote", "read"), controller.getNursingNote);
router.post("/", validate({ body: createNursingNoteSchema }), requirePermission("nursingNote", "create"), controller.createNursingNote);
router.patch("/:id", validate({ params: nursingNoteIdParamSchema, body: updateNursingNoteSchema }), requirePermission("nursingNote", "update"), controller.updateNursingNote);
router.delete("/:id", validate({ params: nursingNoteIdParamSchema }), requirePermission("nursingNote", "update"), controller.deleteNursingNote);
export default router;
