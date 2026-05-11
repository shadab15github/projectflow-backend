import { Router } from "express";
import authMiddleware from "../../middleware/authMiddleware";
import * as uploadController from "./upload.controller";

const router = Router();

router.use(authMiddleware);

router.post("/sign", uploadController.sign);

export default router;
