import { Types } from "mongoose";
import Project, { IProjectDocument } from "./project.model";
import { ProjectStatus, Role } from "../../types";

interface CreateProjectInput {
  tenantId: string;
  userId: string;
  name: string;
  description?: string;
  members?: string[];
}

interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  members?: string[];
}

const MAX_SLUG_ATTEMPTS = 50;

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

export async function listProjects(
  tenantId: string,
  userId: string,
  role: Role,
): Promise<IProjectDocument[]> {
  try {
    const filter: Record<string, unknown> = { tenantId: toObjectId(tenantId) };

    if (!isPrivileged(role)) {
      filter.$or = [
        { members: toObjectId(userId) },
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
    const memberIds = new Set<string>(input.members ?? []);
    memberIds.add(input.userId);

    const trimmedName = input.name.trim();
    const slug = await generateUniqueProjectSlug(input.tenantId, trimmedName);

    const project = await Project.create({
      tenantId: toObjectId(input.tenantId),
      name: trimmedName,
      slug,
      description: input.description?.trim() ?? "",
      status: "active",
      members: Array.from(memberIds).map(toObjectId),
      createdBy: toObjectId(input.userId),
    });

    return project;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
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
    if (input.members !== undefined)
      update.members = input.members.map(toObjectId);

    return await Project.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: toObjectId(tenantId) },
      { $set: update },
      { new: true },
    );
  } catch (error) {
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
      members: toObjectId(userId),
    });
    return exists !== null;
  } catch (error) {
    throw Object.assign(new Error("Failed to verify project membership"), {
      status: 500,
    });
  }
}
