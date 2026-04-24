import { Router } from "express";
import authMiddleware from "../../middleware/authMiddleware";
import * as tenantController from "./tenant.controller";

const router = Router();

router.use(authMiddleware);

router.get("/me", tenantController.getMe);

export default router;
