import { Types } from "mongoose";
import Task, { ITaskDocument } from "./task.model";
import * as projectService from "../project/project.service";
import { Role, TaskPriority, TaskState } from "../../types";

interface ListTasksFilter {
  tenantId: string;
  projectId: string;
  state?: TaskState;
  assigneeId?: string;
}

interface CreateTaskInput {
  tenantId: string;
  userId: string;
  projectId: string;
  title: string;
  description?: string;
  state?: TaskState;
  priority?: TaskPriority;
  assigneeId?: string | null;
  labels?: string[];
}

interface UpdateTaskInput {
  title?: string;
  description?: string;
  state?: TaskState;
  priority?: TaskPriority;
  assigneeId?: string | null;
  labels?: string[];
}

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
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
  if (!project) {
    throw Object.assign(new Error("Project not found"), { status: 404 });
  }

  if (role === "super_admin" || role === "admin") return;

  const isMember = project.members.some(
    (memberId) => memberId.toString() === userId,
  );
  const isCreator = project.createdBy.toString() === userId;
  if (!isMember && !isCreator) {
    throw Object.assign(new Error("Not a member of this project"), {
      status: 403,
    });
  }
}

export async function listTasks(
  filter: ListTasksFilter,
  userId: string,
  role: Role,
): Promise<ITaskDocument[]> {
  try {
    await ensureProjectAccess(filter.projectId, filter.tenantId, userId, role);

    const query: Record<string, unknown> = {
      tenantId: toObjectId(filter.tenantId),
      projectId: toObjectId(filter.projectId),
    };

    if (filter.state) query.state = filter.state;
    if (filter.assigneeId) query.assigneeId = toObjectId(filter.assigneeId);

    return await Task.find(query).sort({ updatedAt: -1 });
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw Object.assign(new Error("Failed to list tasks"), { status: 500 });
  }
}

export async function getTaskById(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<ITaskDocument | null> {
  try {
    const task = await Task.findOne({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    if (!task) return null;

    await ensureProjectAccess(
      task.projectId.toString(),
      tenantId,
      userId,
      role,
    );

    return task;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw Object.assign(new Error("Failed to load task"), { status: 500 });
  }
}

export async function createTask(
  input: CreateTaskInput,
  role: Role,
): Promise<ITaskDocument> {
  try {
    await ensureProjectAccess(
      input.projectId,
      input.tenantId,
      input.userId,
      role,
    );

    const task = await Task.create({
      tenantId: toObjectId(input.tenantId),
      projectId: toObjectId(input.projectId),
      title: input.title.trim(),
      description: input.description?.trim() ?? "",
      state: input.state ?? "TODO",
      priority: input.priority ?? "medium",
      assigneeId: input.assigneeId ? toObjectId(input.assigneeId) : undefined,
      labels: input.labels ?? [],
      createdBy: toObjectId(input.userId),
    });

    return task;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw Object.assign(new Error("Failed to create task"), { status: 500 });
  }
}

export async function updateTask(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
  input: UpdateTaskInput,
): Promise<ITaskDocument | null> {
  try {
    const task = await Task.findOne({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    if (!task) return null;

    await ensureProjectAccess(
      task.projectId.toString(),
      tenantId,
      userId,
      role,
    );

    if (!isPrivileged(role)) {
      const isAssignee = task.assigneeId?.toString() === userId;
      const isCreator = task.createdBy.toString() === userId;
      if (!isAssignee && !isCreator) {
        throw Object.assign(
          new Error("You can only update tasks you are assigned to"),
          { status: 403 },
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
    if (input.labels !== undefined) update.labels = input.labels;

    return await Task.findOneAndUpdate(
      { _id: toObjectId(id), tenantId: toObjectId(tenantId) },
      { $set: update },
      { new: true },
    );
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw Object.assign(new Error("Failed to update task"), { status: 500 });
  }
}

export async function deleteTask(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  try {
    const task = await Task.findOne({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    if (!task) return false;

    await ensureProjectAccess(
      task.projectId.toString(),
      tenantId,
      userId,
      role,
    );

    const result = await Task.findOneAndDelete({
      _id: toObjectId(id),
      tenantId: toObjectId(tenantId),
    });
    return result !== null;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw Object.assign(new Error("Failed to delete task"), { status: 500 });
  }
}
