import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest, WorkItemState, WorkItemType } from "../../types";
import * as workItemService from "./workItem.service";

const objectIdRegex = /^[a-f\d]{24}$/i;

const typeSchema = z.enum(["segment", "task", "subtask"]);
const stateSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "BLOCKED",
  "CANCELLED",
]);
const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().trim().url().max(2000),
  publicId: z.string().trim().max(200).optional(),
  mimeType: z.string().trim().max(120).optional(),
  size: z.number().int().nonnegative().optional(),
});

const createSchema = z.object({
  projectId: z.string().regex(objectIdRegex),
  type: typeSchema,
  parentId: z.string().regex(objectIdRegex).nullable().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(10000).optional(),
  state: stateSchema.optional(),
  priority: prioritySchema.optional(),
  assigneeId: z.string().regex(objectIdRegex).nullable().optional(),
  reporterId: z.string().regex(objectIdRegex).nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  componentIds: z.array(z.string().regex(objectIdRegex)).max(20).optional(),
  sprintId: z.string().regex(objectIdRegex).nullable().optional(),
  storyPoints: z.number().min(0).max(1000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  attachments: z.array(attachmentSchema).max(20).optional(),
});

const updateSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(10000).optional(),
    state: stateSchema.optional(),
    priority: prioritySchema.optional(),
    assigneeId: z.string().regex(objectIdRegex).nullable().optional(),
    reporterId: z.string().regex(objectIdRegex).nullable().optional(),
    labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    componentIds: z.array(z.string().regex(objectIdRegex)).max(20).optional(),
    sprintId: z.string().regex(objectIdRegex).nullable().optional(),
    storyPoints: z.number().min(0).max(1000).nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    parentId: z.string().regex(objectIdRegex).nullable().optional(),
    attachments: z.array(attachmentSchema).max(20).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "At least one field is required",
  });

const sortBySchema = z.enum([
  "updatedAt",
  "createdAt",
  "title",
  "state",
  "priority",
  "key",
]);

const listQuerySchema = z.object({
  projectId: z.string().regex(objectIdRegex),
  type: typeSchema.optional(),
  state: stateSchema.optional(),
  assigneeId: z
    .union([z.string().regex(objectIdRegex), z.literal("none")])
    .optional(),
  assigneeIds: z.string().trim().max(2000).optional(),
  sprintId: z.union([z.string().regex(objectIdRegex), z.literal("none")]).optional(),
  parentId: z.union([z.string().regex(objectIdRegex), z.literal("none")]).optional(),
  search: z.string().trim().max(200).optional(),
  hideDone: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sortBy: sortBySchema.optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
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

    let assigneeIds: (string | "none")[] | undefined;
    if (parsed.data.assigneeIds) {
      const tokens = parsed.data.assigneeIds
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const valid: (string | "none")[] = [];
      for (const t of tokens) {
        if (t === "none" || objectIdRegex.test(t)) {
          valid.push(t as string | "none");
        } else {
          res.status(400).json({ message: `Invalid assigneeId: ${t}` });
          return;
        }
      }
      if (valid.length > 0) assigneeIds = valid;
    }

    const result = await workItemService.listWorkItems(
      {
        tenantId,
        projectId: parsed.data.projectId,
        type: parsed.data.type as WorkItemType | undefined,
        state: parsed.data.state as WorkItemState | undefined,
        assigneeId: parsed.data.assigneeId,
        assigneeIds,
        sprintId: parsed.data.sprintId,
        parentId: parsed.data.parentId,
        search: parsed.data.search,
        hideDone: parsed.data.hideDone,
        page: parsed.data.page,
        limit: parsed.data.limit,
        sortBy: parsed.data.sortBy,
        sortDir: parsed.data.sortDir,
      },
      userId,
      role,
    );
    res.json(result);
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}

export async function listMine(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId } = req.user!;
    const items = await workItemService.listMine(tenantId, userId);
    res.json({ items });
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
      res.status(400).json({ message: "Invalid work item id" });
      return;
    }

    const item = await workItemService.getWorkItemById(
      id,
      tenantId,
      userId,
      role,
    );
    if (!item) {
      res.status(404).json({ message: "Work item not found" });
      return;
    }
    res.json({ item });
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

    const item = await workItemService.createWorkItem(
      {
        tenantId,
        userId,
        ...parsed.data,
      },
      role,
    );
    res.status(201).json({ item });
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
      res.status(400).json({ message: "Invalid work item id" });
      return;
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }

    const item = await workItemService.updateWorkItem(
      id,
      tenantId,
      userId,
      role,
      parsed.data,
    );
    if (!item) {
      res.status(404).json({ message: "Work item not found" });
      return;
    }
    res.json({ item });
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
      res.status(400).json({ message: "Invalid work item id" });
      return;
    }

    const ok = await workItemService.deleteWorkItem(
      id,
      tenantId,
      userId,
      role,
    );
    if (!ok) {
      res.status(404).json({ message: "Work item not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (sendError(res, error)) return;
    next(error);
  }
}
