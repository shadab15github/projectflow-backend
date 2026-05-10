import { Response, NextFunction } from "express";
import { AuthRequest } from "../../types";
import * as userService from "./user.service";

export async function list(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    const users = await userService.listUsers(req.user.tenantId);
    const safe = users.map((u) => ({
      _id: u._id.toString(),
      tenantId: u.tenantId.toString(),
      email: u.email,
      name: u.name,
      role: u.role,
      avatar: u.avatar,
      createdAt: u.createdAt,
    }));
    res.json({ users: safe });
  } catch (error) {
    next(error);
  }
}
