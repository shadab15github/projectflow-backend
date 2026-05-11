import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest, SprintState } from "../../types";
import * as sprintService from "./sprint.service";

const objectIdRegex = /^[a-f\d]{24}$/i;

const stateSchema = z.enum(["planned", "active", "closed"]);

const createSchema = z.object({
  projectId: z.string().regex(objectIdRegex),
  name: z.string().trim().min(2).max(200),
  goal: z.string().trim().max(2000).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    goal: z.string().trim().max(2000).optional(),
    startDate: z.string().datetime().nullable().optional(),
    endDate: z.string().datetime().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  });

const closeSchema = z.object({
  rolloverSprintId: z
    .string()
    .regex(objectIdRegex)
    .nullable()
    .optional(),
});

const listQuerySchema = z.object({
  projectId: z.string().regex(objectIdRegex),
  state: stateSchema.optional(),
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
    const sprints = await sprintService.listSprints(
      tenantId,
      parsed.data.projectId,
      userId,
      role,
      parsed.data.state as SprintState | undefined,
    );
    res.json({ sprints });
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
      res.status(400).json({ message: "Invalid sprint id" });
      return;
    }
    const sprint = await sprintService.getSprintById(id, tenantId);
    if (!sprint) {
      res.status(404).json({ message: "Sprint not found" });
      return;
    }
    res.json({ sprint });
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
    const sprint = await sprintService.createSprint(
      { tenantId, userId, ...parsed.data },
      role,
    );
    res.status(201).json({ sprint });
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
      res.status(400).json({ message: "Invalid sprint id" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }
    const sprint = await sprintService.updateSprint(
      id,
      tenantId,
      userId,
      role,
      parsed.data,
    );
    if (!sprint) {
      res.status(404).json({ message: "Sprint not found" });
      return;
    }
    res.json({ sprint });
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}

export async function start(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId, role } = req.user!;
    const id = req.params.id as string;
    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid sprint id" });
      return;
    }
    const sprint = await sprintService.startSprint(
      id,
      tenantId,
      userId,
      role,
    );
    if (!sprint) {
      res.status(404).json({ message: "Sprint not found" });
      return;
    }
    res.json({ sprint });
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}

export async function close(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId, role } = req.user!;
    const id = req.params.id as string;
    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid sprint id" });
      return;
    }
    const parsed = closeSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }
    const result = await sprintService.closeSprint(
      id,
      tenantId,
      userId,
      role,
      { rolloverSprintId: parsed.data.rolloverSprintId ?? null },
    );
    res.json(result);
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
      res.status(400).json({ message: "Invalid sprint id" });
      return;
    }
    const ok = await sprintService.deleteSprint(id, tenantId, userId, role);
    if (!ok) {
      res.status(404).json({ message: "Sprint not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}

export async function report(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId, role } = req.user!;
    const id = req.params.id as string;
    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid sprint id" });
      return;
    }
    const data = await sprintService.sprintReport(
      id,
      tenantId,
      userId,
      role,
    );
    res.json(data);
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}
