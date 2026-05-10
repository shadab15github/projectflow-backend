import { Router } from "express";
import authMiddleware from "../../middleware/authMiddleware";
import * as userController from "./user.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", userController.list);

export default router;
