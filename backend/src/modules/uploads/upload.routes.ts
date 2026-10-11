import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { singleFile, uploadFile } from "./upload.controller";

const router = Router();

// Any authenticated staff member may attach a photo/signature/CV. The file kind
// and MIME type are validated in the controller.
router.use(requireAuth);

router.post("/", singleFile, uploadFile);

export default router;
