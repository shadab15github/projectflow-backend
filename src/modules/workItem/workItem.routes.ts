import { Router } from "express";
import authMiddleware from "../../middleware/authMiddleware";
import requireRole from "../../middleware/roleMiddleware";
import * as workItemController from "./workItem.controller";

const router = Router();

router.use(authMiddleware);

router.get("/mine", workItemController.listMine);
router.get("/", workItemController.list);
router.get("/:id", workItemController.getOne);

router.post(
  "/",
  requireRole("manager", "admin", "super_admin", "user"),
  workItemController.create,
);

router.patch("/:id", workItemController.update);

router.delete(
  "/:id",
  requireRole("manager", "admin", "super_admin"),
  workItemController.remove,
);

export default router;
