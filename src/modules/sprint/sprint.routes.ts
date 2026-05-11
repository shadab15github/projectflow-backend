import { Router } from "express";
import authMiddleware from "../../middleware/authMiddleware";
import * as sprintController from "./sprint.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", sprintController.list);
router.get("/:id", sprintController.getOne);
router.get("/:id/report", sprintController.report);

router.post("/", sprintController.create);
router.patch("/:id", sprintController.update);
router.post("/:id/start", sprintController.start);
router.post("/:id/close", sprintController.close);
router.delete("/:id", sprintController.remove);

export default router;
