import { Router } from "express";
import authMiddleware from "../../middleware/authMiddleware";
import requireRole from "../../middleware/roleMiddleware";
import * as projectController from "./project.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", projectController.list);
router.get("/:id", projectController.getOne);

router.post(
  "/",
  requireRole("manager", "admin", "super_admin"),
  projectController.create,
);

router.patch(
  "/:id",
  requireRole("manager", "admin", "super_admin"),
  projectController.update,
);

router.delete(
  "/:id",
  requireRole("admin", "super_admin"),
  projectController.remove,
);

export default router;
