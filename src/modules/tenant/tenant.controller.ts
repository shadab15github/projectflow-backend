import { Response, NextFunction } from "express";
import { AuthRequest } from "../../types";
import * as tenantService from "./tenant.service";

export async function getMe(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const tenant = await tenantService.getTenantById(req.user.tenantId);
    if (!tenant) {
      res.status(404).json({ message: "Tenant not found" });
      return;
    }

    res.json({
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        createdAt: tenant.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
