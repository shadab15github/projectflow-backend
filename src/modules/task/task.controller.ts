import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest, TaskState } from "../../types";
import * as taskService from "./task.service";

const objectIdRegex = /^[a-f\d]{24}$/i;

const taskStateSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "BLOCKED",
  "CANCELLED",
]);

const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const createTaskSchema = z.object({
  projectId: z.string().regex(objectIdRegex),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).optional(),
  state: taskStateSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().regex(objectIdRegex).nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

const updateTaskSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    state: taskStateSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assigneeId: z.string().regex(objectIdRegex).nullable().optional(),
    labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const listQuerySchema = z.object({
  projectId: z.string().regex(objectIdRegex),
  state: taskStateSchema.optional(),
  assigneeId: z.string().regex(objectIdRegex).optional(),
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

    const tasks = await taskService.listTasks(
      {
        tenantId,
        projectId: parsed.data.projectId,
        state: parsed.data.state as TaskState | undefined,
        assigneeId: parsed.data.assigneeId,
      },
      userId,
      role,
    );
    res.json({ tasks });
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
    const { tenantId, userId, role } = req.user!;
    const id = req.params.id as string;

    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid task id" });
      return;
    }

    const task = await taskService.getTaskById(id, tenantId, userId, role);
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.json({ task });
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

    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }

    const task = await taskService.createTask(
      {
        tenantId,
        userId,
        projectId: parsed.data.projectId,
        title: parsed.data.title,
        description: parsed.data.description,
        state: parsed.data.state,
        priority: parsed.data.priority,
        assigneeId: parsed.data.assigneeId ?? undefined,
        labels: parsed.data.labels,
      },
      role,
    );

    res.status(201).json({ task });
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
      res.status(400).json({ message: "Invalid task id" });
      return;
    }

    const parsed = updateTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }

    const task = await taskService.updateTask(
      id,
      tenantId,
      userId,
      role,
      parsed.data,
    );
    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.json({ task });
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
      res.status(400).json({ message: "Invalid task id" });
      return;
    }

    const deleted = await taskService.deleteTask(id, tenantId, userId, role);
    if (!deleted) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}
