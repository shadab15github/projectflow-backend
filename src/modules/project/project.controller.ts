import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest } from "../../types";
import * as projectService from "./project.service";

const objectIdRegex = /^[a-f\d]{24}$/i;
const projectKeyRegex = /^[A-Z][A-Z0-9]{1,9}$/;

const memberInputSchema = z.object({
  userId: z.string().regex(objectIdRegex),
  role: z.enum(["administrator", "member", "viewer"]).optional(),
});

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional(),
  template: z.enum(["board", "list"]).optional(),
  key: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(
      z
        .string()
        .regex(
          projectKeyRegex,
          "Key must be 2–10 uppercase letters/digits and start with a letter",
        ),
    ),
  management: z.enum(["team-managed", "company-managed"]).optional(),
  access: z.enum(["open", "private"]).optional(),
  members: z.array(memberInputSchema).optional(),
});

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(2000).optional(),
    status: z.enum(["active", "archived"]).optional(),
    template: z.enum(["board", "list"]).optional(),
    key: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .pipe(z.string().regex(projectKeyRegex))
      .optional(),
    management: z.enum(["team-managed", "company-managed"]).optional(),
    access: z.enum(["open", "private"]).optional(),
    members: z.array(memberInputSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
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

export async function list(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!requireUser(req, res)) return;
    const { tenantId, userId, role } = req.user!;

    const projects = await projectService.listProjects(tenantId, userId, role);
    res.json({ projects });
  } catch (error) {
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
    const identifier = req.params.id as string;

    const project = objectIdRegex.test(identifier)
      ? await projectService.getProjectById(identifier, tenantId)
      : await projectService.getProjectBySlug(identifier, tenantId);

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ project });
  } catch (error) {
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
    const { tenantId, userId } = req.user!;

    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }

    const project = await projectService.createProject({
      tenantId,
      userId,
      name: parsed.data.name,
      description: parsed.data.description,
      template: parsed.data.template,
      key: parsed.data.key,
      management: parsed.data.management,
      access: parsed.data.access,
      members: parsed.data.members,
    });

    res.status(201).json({ project });
  } catch (error) {
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
    const { tenantId } = req.user!;
    const id = req.params.id as string;

    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid project id" });
      return;
    }

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }

    const project = await projectService.updateProject(id, tenantId, parsed.data);
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ project });
  } catch (error) {
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
    const { tenantId } = req.user!;
    const id = req.params.id as string;

    if (!objectIdRegex.test(id)) {
      res.status(400).json({ message: "Invalid project id" });
      return;
    }

    const deleted = await projectService.deleteProject(id, tenantId);
    if (!deleted) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
