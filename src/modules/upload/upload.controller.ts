import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest } from "../../types";
import * as cloudinaryService from "./cloudinary.service";

const objectIdRegex = /^[a-f\d]{24}$/i;

const signSchema = z.object({
  projectId: z.string().regex(objectIdRegex),
});

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
    .join(", ");
}

function sendError(res: Response, error: unknown): boolean {
  const status = (error as { status?: number }).status;
  const message = (error as { message?: string }).message;
  if (status && message) {
    res.status(status).json({ message });
    return true;
  }
  return false;
}

export async function sign(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    const parsed = signSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }

    const signature = cloudinaryService.signUpload({
      tenantId: req.user.tenantId,
      projectId: parsed.data.projectId,
    });
    res.json(signature);
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}
