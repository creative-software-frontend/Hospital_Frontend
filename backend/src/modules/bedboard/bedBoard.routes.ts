import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validation.middleware";
import { requireAuth } from "../../middleware/auth.middleware";
import * as bedBoardController from "./bedBoard.controller";

const router = Router();
router.use(requireAuth);

const bedBoardQuerySchema = z.object({
  branchId: z.coerce.number().int().positive().optional(),
});

// Read-only bed board shown from the top bar. Scoped to the caller's branch
// unless a (valid) branchId is supplied.
router.get("/", validate({ query: bedBoardQuerySchema }), bedBoardController.getBedBoard);

export default router;
