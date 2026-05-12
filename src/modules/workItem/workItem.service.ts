import { Types } from "mongoose";
import WorkItem, { IWorkItemDocument } from "./workItem.model";
import Project from "../project/project.model";
import Sprint from "../sprint/sprint.model";
import Component from "../component/component.model";
import * as projectService from "../project/project.service";
import {
  IWorkItemAttachment,
  Role,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from "../../types";

export interface ListWorkItemsFilter {
  tenantId: string;
  projectId: string;
  type?: WorkItemType;
  state?: WorkItemState;
  assigneeId?: string;
  sprintId?: string | "none";
  parentId?: string | "none";
  search?: string;
  hideDone?: boolean;
  page?: number;
  limit?: number;
}

export interface ListWorkItemsResult {
  items: IWorkItemDocument[];
  total: number;
  page: number;
  limit: number;
}

export interface AttachmentInput {
  name: string;
  url: string;
  publicId?: string;
  mimeType?: string;
  size?: number;
}

export interface CreateWorkItemInput {
  tenantId: string;
  userId: string;
  projectId: string;
  type: WorkItemType;
  parentId?: string | null;
  title: string;
  description?: string;
  state?: WorkItemState;
  priority?: WorkItemPriority;
  assigneeId?: string | null;
  reporterId?: string | null;
  labels?: string[];
  componentIds?: string[];
  sprintId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  attachments?: AttachmentInput[];
}

export interface UpdateWorkItemInput {
  title?: string;
  description?: string;
  state?: WorkItemState;
  priority?: WorkItemPriority;
  assigneeId?: string | null;
  reporterId?: string | null;
  labels?: string[];
  componentIds?: string[];
  sprintId?: string | null;
  storyPoints?: number | null;
  dueDate?: string | null;
  parentId?: string | null;
  attachments?: AttachmentInput[];
}

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function isPrivileged(role: Role): boolean {
  return role === "manager" || role === "admin" || role === "super_admin";
}

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
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

async function validateParent(
  type: WorkItemType,
  parentId: string | null | undefined,
  projectId: string,
  tenantId: string,
): Promise<Types.ObjectId | null> {
  if (type === "segment") {
    if (parentId) throw httpError("Segments cannot have a parent", 400);
    return null;
  }

  if (type === "task") {
    if (!parentId) return null;
    const parent = await WorkItem.findOne({
      _id: toObjectId(parentId),
      tenantId: toObjectId(tenantId),
      projectId: toObjectId(projectId),
    });
    if (!parent) throw httpError("Parent segment not found", 400);
    if (parent.type !== "segment") {
      throw httpError("Parent of a task must be a segment", 400);
    }
    return parent._id;
  }

  // subtask
  if (!parentId) throw httpError("Subtasks require a parent task", 400);
  const parent = await WorkItem.findOne({
    _id: toObjectId(parentId),
    tenantId: toObjectId(tenantId),
    projectId: toObjectId(projectId),
  });
  if (!parent) throw httpError("Parent task not found", 400);
  if (parent.type !== "task") {
    throw httpError("Parent of a subtask must be a task", 400);
  }
  return parent._id;
}

async function validateSprint(
  sprintId: string | null | undefined,
  projectId: string,
  tenantId: string,
): Promise<Types.ObjectId | null> {
  if (!sprintId) return null;
  const sprint = await Sprint.findOne({
    _id: toObjectId(sprintId),
    tenantId: toObjectId(tenantId),
    projectId: toObjectId(projectId),
  });
  if (!sprint) throw httpError("Sprint not found", 400);
  if (sprint.state === "closed") {
    throw httpError("Cannot assign work to a closed sprint", 400);
  }
  return sprint._id;
}

async function validateComponents(
  componentIds: string[] | undefined,
  projectId: string,
  tenantId: string,
): Promise<Types.ObjectId[]> {
  if (!componentIds || componentIds.length === 0) return [];
  const ids = componentIds.map(toObjectId);
  const count = await Component.countDocuments({
    _id: { $in: ids },
    tenantId: toObjectId(tenantId),
    projectId: toObjectId(projectId),
  });
  if (count !== ids.length) {
    throw httpError("One or more components are invalid", 400);
  }
  return ids;
}

function normalizeAttachments(
  attachments: AttachmentInput[] | undefined,
): IWorkItemAttachment[] {
  if (!attachments) return [];
  return attachments.map((a) => ({
    name: a.name.trim(),
    url: a.url.trim(),
    publicId: a.publicId,
    mimeType: a.mimeType,
    size: a.size,
    uploadedAt: new Date(),
  }));
}

async function allocateNumber(
  projectId: string,
  tenantId: string,
): Promise<{ number: number; key: string }> {
  const project = await Project.findOneAndUpdate(
    { _id: toObjectId(projectId), tenantId: toObjectId(tenantId) },
    { $inc: { nextWorkItemNumber: 1 } },
    { new: false },
  );
  if (!project) throw httpError("Project not found", 404);
  const number = project.nextWorkItemNumber ?? 1;
  return { number, key: `${project.key}-${number}` };
}

export async function listWorkItems(
  filter: ListWorkItemsFilter,
  userId: string,
  role: Role,
): Promise<ListWorkItemsResult> {
  try {
    await ensureProjectAccess(filter.projectId, filter.tenantId, userId, role);

    const query: Record<string, unknown> = {
      tenantId: toObjectId(filter.tenantId),
      projectId: toObjectId(filter.projectId),
    };

    if (filter.type) query.type = filter.type;
    if (filter.state) query.state = filter.state;
    if (filter.assigneeId) query.assigneeId = toObjectId(filter.assigneeId);

    if (filter.sprintId === "none") query.sprintId = null;
    else if (filter.sprintId) query.sprintId = toObjectId(filter.sprintId);

    if (filter.parentId === "none") query.parentId = null;
    else if (filter.parentId) query.parentId = toObjectId(filter.parentId);

    if (filter.hideDone) {
      query.state = { $ne: "DONE" };
    }

    if (filter.search && filter.search.length > 0) {
      const escaped = filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      query.$or = [{ title: regex }, { key: regex }];
    }

    const page = filter.page && filter.page > 0 ? filter.page : 1;
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 25;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      WorkItem.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      WorkItem.countDocuments(query),
    ]);

    return { items, total, page, limit };
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw httpError("Failed to list work items", 500);
  }
}

export async function getWorkItemById(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<IWorkItemDocument | null> {
  try {
    const item = await WorkItem.findOne({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    if (!item) return null;
    await ensureProjectAccess(
      item.projectId.toString(),
      tenantId,
      userId,
      role,
    );
    return item;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw httpError("Failed to load work item", 500);
  }
}

export async function createWorkItem(
  input: CreateWorkItemInput,
  role: Role,
): Promise<IWorkItemDocument> {
  try {
    await ensureProjectAccess(
      input.projectId,
      input.tenantId,
      input.userId,
      role,
    );

    const parentId = await validateParent(
      input.type,
      input.parentId ?? null,
      input.projectId,
      input.tenantId,
    );

    const sprintId = await validateSprint(
      input.sprintId ?? null,
      input.projectId,
      input.tenantId,
    );

    const componentIds = await validateComponents(
      input.componentIds,
      input.projectId,
      input.tenantId,
    );

    const { number, key } = await allocateNumber(
      input.projectId,
      input.tenantId,
    );

    const item = await WorkItem.create({
      tenantId: toObjectId(input.tenantId),
      projectId: toObjectId(input.projectId),
      type: input.type,
      parentId,
      number,
      key,
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      state: input.state ?? "TODO",
      priority: input.priority ?? "medium",
      assigneeId: input.assigneeId ? toObjectId(input.assigneeId) : null,
      reporterId: input.reporterId
        ? toObjectId(input.reporterId)
        : toObjectId(input.userId),
      labels: input.labels ?? [],
      componentIds,
      sprintId,
      storyPoints:
        input.storyPoints === undefined ? null : input.storyPoints,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      attachments: normalizeAttachments(input.attachments),
      createdBy: toObjectId(input.userId),
    });

    return item;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    if ((error as { code?: number }).code === 11000) {
      throw httpError("Duplicate work item key", 409);
    }
    throw httpError("Failed to create work item", 500);
  }
}

export async function updateWorkItem(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
  input: UpdateWorkItemInput,
): Promise<IWorkItemDocument | null> {
  try {
    const item = await WorkItem.findOne({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    if (!item) return null;

    await ensureProjectAccess(
      item.projectId.toString(),
      tenantId,
      userId,
      role,
    );

    if (!isPrivileged(role)) {
      const isAssignee = item.assigneeId?.toString() === userId;
      const isReporter = item.reporterId.toString() === userId;
      const isCreator = item.createdBy.toString() === userId;
      if (!isAssignee && !isReporter && !isCreator) {
        throw httpError(
          "You can only update items you are assigned to or reported",
          403,
        );
      }
    }

    const update: Record<string, unknown> = {};

    if (input.title !== undefined) update.title = input.title.trim();
    if (input.description !== undefined)
      update.description = input.description.trim();
    if (input.state !== undefined) update.state = input.state;
    if (input.priority !== undefined) update.priority = input.priority;
    if (input.assigneeId !== undefined) {
      update.assigneeId = input.assigneeId
        ? toObjectId(input.assigneeId)
        : null;
    }
    if (input.reporterId !== undefined && input.reporterId) {
      update.reporterId = toObjectId(input.reporterId);
    }
    if (input.labels !== undefined) update.labels = input.labels;
    if (input.storyPoints !== undefined)
      update.storyPoints = input.storyPoints;
    if (input.dueDate !== undefined)
      update.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.attachments !== undefined)
      update.attachments = normalizeAttachments(input.attachments);

    if (input.componentIds !== undefined) {
      update.componentIds = await validateComponents(
        input.componentIds,
        item.projectId.toString(),
        tenantId,
      );
    }

    if (input.sprintId !== undefined) {
      update.sprintId = await validateSprint(
        input.sprintId,
        item.projectId.toString(),
        tenantId,
      );
    }

    if (input.parentId !== undefined) {
      const parentId = await validateParent(
        item.type,
        input.parentId,
        item.projectId.toString(),
        tenantId,
      );
      if (parentId && parentId.equals(item._id)) {
        throw httpError("An item cannot be its own parent", 400);
      }
      update.parentId = parentId;
    }

    return await WorkItem.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: toObjectId(tenantId) },
      { $set: update },
      { new: true },
    );
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw httpError("Failed to update work item", 500);
  }
}

export async function deleteWorkItem(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  try {
    const item = await WorkItem.findOne({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    if (!item) return false;

    await ensureProjectAccess(
      item.projectId.toString(),
      tenantId,
      userId,
      role,
    );

    // Cascade rules:
    //  - Deleting a segment: detach its task children (parentId -> null) so
    //    they become standalone tasks. Subtasks of those tasks are unaffected.
    //  - Deleting a task: cascade-delete its subtasks, since subtasks cannot
    //    exist without a parent task in our hierarchy rules.
    if (item.type === "segment") {
      await WorkItem.updateMany(
        {
          tenantId: toObjectId(tenantId),
          parentId: item._id,
        },
        { $set: { parentId: null } },
      );
    } else if (item.type === "task") {
      await WorkItem.deleteMany({
        tenantId: toObjectId(tenantId),
        parentId: item._id,
        type: "subtask",
      });
    }

    const result = await WorkItem.findOneAndDelete({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    return result !== null;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw httpError("Failed to delete work item", 500);
  }
}

export async function listMine(
  tenantId: string,
  userId: string,
): Promise<IWorkItemDocument[]> {
  try {
    return await WorkItem.find({
      tenantId: toObjectId(tenantId),
      assigneeId: toObjectId(userId),
    })
      .sort({ updatedAt: -1 })
      .limit(50);
  } catch (error) {
    throw httpError("Failed to list assigned work items", 500);
  }
}
