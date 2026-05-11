import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest } from "../../types";
import * as componentService from "./component.service";

const objectIdRegex = /^[a-f\d]{24}$/i;

const createSchema = z.object({
  projectId: z.string().regex(objectIdRegex),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  leadId: z.string().regex(objectIdRegex).nullable().optional(),
  defaultAssigneeId: z.string().regex(objectIdRegex).nullable().optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    leadId: z.string().regex(objectIdRegex).nullable().optional(),
    defaultAssigneeId: z.string().regex(objectIdRegex).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  });

const listQuerySchema = z.object({
  projectId: z.string().regex(objectIdRegex),
});

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
    .join(", ");
}

function requireUser(req: AuthRequest, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return false;
  }
  return true;
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

export async function list(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId, role } = req.user!;
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }
    const components = await componentService.listComponents(
      tenantId,
      parsed.data.projectId,
      userId,
      role,
    );
    res.json({ components });
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}

export async function getOne(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId } = req.user!;
    const id = req.params.id as string;
    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid component id" });
      return;
    }
    const component = await componentService.getComponentById(id, tenantId);
    if (!component) {
      res.status(404).json({ message: "Component not found" });
      return;
    }
    res.json({ component });
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId, role } = req.user!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }
    const component = await componentService.createComponent(
      { tenantId, userId, ...parsed.data },
      role,
    );
    res.status(201).json({ component });
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}

export async function update(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId, role } = req.user!;
    const id = req.params.id as string;
    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid component id" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }
    const component = await componentService.updateComponent(
      id,
      tenantId,
      userId,
      role,
      parsed.data,
    );
    if (!component) {
      res.status(404).json({ message: "Component not found" });
      return;
    }
    res.json({ component });
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}

export async function remove(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId, role } = req.user!;
    const id = req.params.id as string;
    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid component id" });
      return;
    }
    const ok = await componentService.deleteComponent(
      id,
      tenantId,
      userId,
      role,
    );
    if (!ok) {
      res.status(404).json({ message: "Component not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}
