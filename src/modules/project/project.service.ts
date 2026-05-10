import { Types } from "mongoose";
import Project, { IProjectDocument } from "./project.model";
import {
  ProjectAccess,
  ProjectManagement,
  ProjectMemberRole,
  ProjectStatus,
  ProjectTemplate,
  Role,
} from "../../types";

interface MemberInput {
  userId: string;
  role?: ProjectMemberRole;
}

interface CreateProjectInput {
  tenantId: string;
  userId: string;
  name: string;
  description?: string;
  template?: ProjectTemplate;
  key: string;
  management?: ProjectManagement;
  access?: ProjectAccess;
  members?: MemberInput[];
}

interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  template?: ProjectTemplate;
  key?: string;
  management?: ProjectManagement;
  access?: ProjectAccess;
  members?: MemberInput[];
}

const MAX_SLUG_ATTEMPTS = 50;
const MAX_KEY_ATTEMPTS = 50;

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function isPrivileged(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

function baseSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "project";
}

async function generateUniqueProjectSlug(
  tenantId: string,
  name: string,
): Promise<string> {
  const root = baseSlug(name);
  let candidate = root;
  let attempt = 0;

  while (attempt < MAX_SLUG_ATTEMPTS) {
    const exists = await Project.exists({
      tenantId: toObjectId(tenantId),
      slug: candidate,
    });
    if (!exists) return candidate;
    attempt += 1;
    const suffix = Math.random().toString(36).slice(2, 7);
    candidate = `${root}-${suffix}`;
  }

  throw Object.assign(new Error("Could not generate unique project slug"), {
    status: 500,
  });
}

async function ensureUniqueKey(
  tenantId: string,
  key: string,
  ignoreProjectId?: string,
): Promise<void> {
  const filter: Record<string, unknown> = {
    tenantId: toObjectId(tenantId),
    key: key.toUpperCase(),
  };
  if (ignoreProjectId) {
    filter._id = { $ne: toObjectId(ignoreProjectId) };
  }
  const exists = await Project.exists(filter);
  if (exists) {
    throw Object.assign(
      new Error(`Project key "${key.toUpperCase()}" is already in use`),
      { status: 409 },
    );
  }
}

function normalizeMembers(
  ownerId: string,
  members: MemberInput[] | undefined,
): { userId: Types.ObjectId; role: ProjectMemberRole }[] {
  const map = new Map<string, ProjectMemberRole>();
  for (const m of members ?? []) {
    if (!m?.userId) continue;
    map.set(m.userId, m.role ?? "member");
  }
  // Owner is always an administrator on the project they create.
  map.set(ownerId, "administrator");

  return Array.from(map.entries()).map(([userId, role]) => ({
    userId: toObjectId(userId),
    role,
  }));
}

export async function listProjects(
  tenantId: string,
  userId: string,
  role: Role,
): Promise<IProjectDocument[]> {
  try {
    const filter: Record<string, unknown> = { tenantId: toObjectId(tenantId) };

    if (!isPrivileged(role)) {
      filter.$or = [
        { "members.userId": toObjectId(userId) },
        { createdBy: toObjectId(userId) },
      ];
    }

    return await Project.find(filter).sort({ updatedAt: -1 });
  } catch (error) {
    throw Object.assign(new Error("Failed to list projects"), { status: 500 });
  }
}

export async function getProjectById(
  id: string,
  tenantId: string,
): Promise<IProjectDocument | null> {
  try {
    return await Project.findOne({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
  } catch (error) {
    throw Object.assign(new Error("Failed to load project"), { status: 500 });
  }
}

export async function getProjectBySlug(
  slug: string,
  tenantId: string,
): Promise<IProjectDocument | null> {
  try {
    return await Project.findOne({
      slug: slug.toLowerCase(),
      tenantId: toObjectId(tenantId),
    });
  } catch (error) {
    throw Object.assign(new Error("Failed to load project"), { status: 500 });
  }
}

export async function createProject(
  input: CreateProjectInput,
): Promise<IProjectDocument> {
  try {
    const trimmedName = input.name.trim();
    const slug = await generateUniqueProjectSlug(input.tenantId, trimmedName);
    const key = input.key.trim().toUpperCase();

    await ensureUniqueKey(input.tenantId, key);

    const members = normalizeMembers(input.userId, input.members);

    const project = await Project.create({
      tenantId: toObjectId(input.tenantId),
      name: trimmedName,
      slug,
      description: input.description?.trim() ?? "",
      status: "active",
      template: input.template ?? "board",
      key,
      management: input.management ?? "team-managed",
      access: input.access ?? "open",
      members,
      createdBy: toObjectId(input.userId),
    });

    return project;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    if ((error as { code?: number }).code === 11000) {
      throw Object.assign(new Error("Project key or slug already exists"), {
        status: 409,
      });
    }
    throw Object.assign(new Error("Failed to create project"), { status: 500 });
  }
}

export async function updateProject(
  id: string,
  tenantId: string,
  input: UpdateProjectInput,
): Promise<IProjectDocument | null> {
  try {
    const update: Record<string, unknown> = {};

    if (input.name !== undefined) update.name = input.name.trim();
    if (input.description !== undefined)
      update.description = input.description.trim();
    if (input.status !== undefined) update.status = input.status;
    if (input.template !== undefined) update.template = input.template;
    if (input.management !== undefined) update.management = input.management;
    if (input.access !== undefined) update.access = input.access;

    if (input.key !== undefined) {
      const newKey = input.key.trim().toUpperCase();
      await ensureUniqueKey(tenantId, newKey, id);
      update.key = newKey;
    }

    if (input.members !== undefined) {
      const project = await Project.findOne({
        _id: toObjectId(id),
        tenantId: toObjectId(tenantId),
      });
      if (!project) return null;
      update.members = normalizeMembers(
        project.createdBy.toString(),
        input.members,
      );
    }

    return await Project.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: toObjectId(tenantId) },
      { $set: update },
      { new: true },
    );
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    if ((error as { code?: number }).code === 11000) {
      throw Object.assign(new Error("Project key already exists"), {
        status: 409,
      });
    }
    throw Object.assign(new Error("Failed to update project"), { status: 500 });
  }
}

export async function deleteProject(
  id: string,
  tenantId: string,
): Promise<boolean> {
  try {
    const result = await Project.findOneAndDelete({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    return result !== null;
  } catch (error) {
    throw Object.assign(new Error("Failed to delete project"), { status: 500 });
  }
}

export async function isProjectMember(
  projectId: string,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  try {
    const exists = await Project.exists({
      _id: toObjectId(projectId),
      tenantId: toObjectId(tenantId),
      "members.userId": toObjectId(userId),
    });
    return exists !== null;
  } catch (error) {
    throw Object.assign(new Error("Failed to verify project membership"), {
      status: 500,
    });
  }
}

export { MAX_KEY_ATTEMPTS };
