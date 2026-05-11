import { Router } from "express";
import authMiddleware from "../../middleware/authMiddleware";
import * as componentController from "./component.controller";

const router = Router();

router.use(authMiddleware);

router.get("/", componentController.list);
router.get("/:id", componentController.getOne);
router.post("/", componentController.create);
router.patch("/:id", componentController.update);
router.delete("/:id", componentController.remove);

export default router;
