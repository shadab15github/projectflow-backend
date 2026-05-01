import { Router } from "express";
import authMiddleware from "../../middleware/authMiddleware";
import requireRole from "../../middleware/roleMiddleware";
import * as taskController from "./task.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", taskController.list);
router.get("/:id", taskController.getOne);

router.post(
  "/",
  requireRole("manager", "admin", "super_admin"),
  taskController.create,
);

router.patch("/:id", taskController.update);

router.delete(
  "/:id",
  requireRole("manager", "admin", "super_admin"),
  taskController.remove,
);

export default router;
