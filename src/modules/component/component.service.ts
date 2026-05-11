import { Types } from "mongoose";
import Component, { IComponentDocument } from "./component.model";
import WorkItem from "../workItem/workItem.model";
import * as projectService from "../project/project.service";
import { Role } from "../../types";

export interface CreateComponentInput {
  tenantId: string;
  userId: string;
  projectId: string;
  name: string;
  description?: string;
  leadId?: string | null;
  defaultAssigneeId?: string | null;
}

export interface UpdateComponentInput {
  name?: string;
  description?: string;
  leadId?: string | null;
  defaultAssigneeId?: string | null;
}

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function isPrivileged(role: Role): boolean {
  return role === "manager" || role === "admin" || role === "super_admin";
}

async function ensureProjectAccess(
  projectId: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<void> {
  const project = await projectService.getProjectById(projectId, tenantId);
  if (!project) throw httpError("Project not found", 404);
  if (role === "super_admin" || role === "admin") return;
  const isMember = project.members.some(
    (m) => m.userId.toString() === userId,
  );
  const isCreator = project.createdBy.toString() === userId;
  if (!isMember && !isCreator) {
    throw httpError("Not a member of this project", 403);
  }
}

export async function listComponents(
  tenantId: string,
  projectId: string,
  userId: string,
  role: Role,
): Promise<IComponentDocument[]> {
  await ensureProjectAccess(projectId, tenantId, userId, role);
  return Component.find({
    tenantId: toObjectId(tenantId),
    projectId: toObjectId(projectId),
  }).sort({ name: 1 });
}

export async function getComponentById(
  id: string,
  tenantId: string,
): Promise<IComponentDocument | null> {
  return Component.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
}

export async function createComponent(
  input: CreateComponentInput,
  role: Role,
): Promise<IComponentDocument> {
  if (!isPrivileged(role)) {
    throw httpError("Only managers and admins can create components", 403);
  }
  await ensureProjectAccess(
    input.projectId,
    input.tenantId,
    input.userId,
    role,
  );

  try {
    return await Component.create({
      tenantId: toObjectId(input.tenantId),
      projectId: toObjectId(input.projectId),
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      leadId: input.leadId ? toObjectId(input.leadId) : null,
      defaultAssigneeId: input.defaultAssigneeId
        ? toObjectId(input.defaultAssigneeId)
        : null,
      createdBy: toObjectId(input.userId),
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw httpError("A component with that name already exists", 409);
    }
    throw error;
  }
}

export async function updateComponent(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
  input: UpdateComponentInput,
): Promise<IComponentDocument | null> {
  if (!isPrivileged(role)) {
    throw httpError("Only managers and admins can update components", 403);
  }
  const component = await Component.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
  if (!component) return null;
  await ensureProjectAccess(
    component.projectId.toString(),
    tenantId,
    userId,
    role,
  );

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.description !== undefined)
    update.description = input.description.trim();
  if (input.leadId !== undefined)
    update.leadId = input.leadId ? toObjectId(input.leadId) : null;
  if (input.defaultAssigneeId !== undefined)
    update.defaultAssigneeId = input.defaultAssigneeId
      ? toObjectId(input.defaultAssigneeId)
      : null;

  try {
    return await Component.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: toObjectId(tenantId) },
      { $set: update },
      { new: true },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw httpError("A component with that name already exists", 409);
    }
    throw error;
  }
}

export async function deleteComponent(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  if (!isPrivileged(role)) {
    throw httpError("Only managers and admins can delete components", 403);
  }
  const component = await Component.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
  if (!component) return false;
  await ensureProjectAccess(
    component.projectId.toString(),
    tenantId,
    userId,
    role,
  );

  // Detach this component from any work items that reference it.
  await WorkItem.updateMany(
    {
      tenantId: toObjectId(tenantId),
      componentIds: component._id,
    },
    { $pull: { componentIds: component._id } },
  );
  await Component.deleteOne({ _id: component._id });
  return true;
}
