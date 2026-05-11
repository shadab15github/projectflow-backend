import { Types } from "mongoose";
import Sprint, { ISprintDocument } from "./sprint.model";
import WorkItem from "../workItem/workItem.model";
import * as projectService from "../project/project.service";
import { Role, SprintState } from "../../types";

export interface CreateSprintInput {
  tenantId: string;
  userId: string;
  projectId: string;
  name: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateSprintInput {
  name?: string;
  goal?: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface SprintReport {
  sprint: ISprintDocument;
  completed: {
    count: number;
    storyPoints: number;
  };
  incomplete: {
    count: number;
    storyPoints: number;
  };
  cancelled: {
    count: number;
    storyPoints: number;
  };
  total: {
    count: number;
    storyPoints: number;
  };
  items: {
    completed: string[];
    incomplete: string[];
    cancelled: string[];
  };
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

export async function listSprints(
  tenantId: string,
  projectId: string,
  userId: string,
  role: Role,
  state?: SprintState,
): Promise<ISprintDocument[]> {
  await ensureProjectAccess(projectId, tenantId, userId, role);
  const query: Record<string, unknown> = {
    tenantId: toObjectId(tenantId),
    projectId: toObjectId(projectId),
  };
  if (state) query.state = state;
  return Sprint.find(query).sort({ createdAt: -1 });
}

export async function getActiveSprint(
  tenantId: string,
  projectId: string,
): Promise<ISprintDocument | null> {
  return Sprint.findOne({
    tenantId: toObjectId(tenantId),
    projectId: toObjectId(projectId),
    state: "active",
  });
}

export async function getSprintById(
  id: string,
  tenantId: string,
): Promise<ISprintDocument | null> {
  return Sprint.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
}

export async function createSprint(
  input: CreateSprintInput,
  role: Role,
): Promise<ISprintDocument> {
  if (!isPrivileged(role)) {
    throw httpError("Only managers and admins can create sprints", 403);
  }
  await ensureProjectAccess(
    input.projectId,
    input.tenantId,
    input.userId,
    role,
  );

  const sprint = await Sprint.create({
    tenantId: toObjectId(input.tenantId),
    projectId: toObjectId(input.projectId),
    name: input.name.trim(),
    goal: input.goal?.trim() ?? "",
    state: "planned",
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    createdBy: toObjectId(input.userId),
  });
  return sprint;
}

export async function updateSprint(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
  input: UpdateSprintInput,
): Promise<ISprintDocument | null> {
  if (!isPrivileged(role)) {
    throw httpError("Only managers and admins can update sprints", 403);
  }
  const sprint = await Sprint.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
  if (!sprint) return null;

  await ensureProjectAccess(
    sprint.projectId.toString(),
    tenantId,
    userId,
    role,
  );

  if (sprint.state === "closed") {
    throw httpError("Closed sprints cannot be edited", 400);
  }

  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.goal !== undefined) update.goal = input.goal.trim();
  if (input.startDate !== undefined)
    update.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.endDate !== undefined)
    update.endDate = input.endDate ? new Date(input.endDate) : null;

  return Sprint.findOneAndUpdate(
    { _id: toObjectId(id), tenantId: toObjectId(tenantId) },
    { $set: update },
    { new: true },
  );
}

export async function startSprint(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<ISprintDocument | null> {
  if (!isPrivileged(role)) {
    throw httpError("Only managers and admins can start sprints", 403);
  }
  const sprint = await Sprint.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
  if (!sprint) return null;
  await ensureProjectAccess(
    sprint.projectId.toString(),
    tenantId,
    userId,
    role,
  );

  if (sprint.state === "active") return sprint;
  if (sprint.state === "closed") {
    throw httpError("Closed sprints cannot be restarted", 400);
  }

  const existingActive = await Sprint.findOne({
    tenantId: toObjectId(tenantId),
    projectId: sprint.projectId,
    state: "active",
  });
  if (existingActive) {
    throw httpError(
      "Another sprint is already active. Close it before starting a new one.",
      409,
    );
  }

  sprint.state = "active";
  sprint.startedAt = new Date();
  await sprint.save();
  return sprint;
}

export async function closeSprint(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
  options: { rolloverSprintId?: string | null } = {},
): Promise<{ sprint: ISprintDocument; rolledOver: number; completed: number }> {
  if (!isPrivileged(role)) {
    throw httpError("Only managers and admins can close sprints", 403);
  }
  const sprint = await Sprint.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
  if (!sprint) throw httpError("Sprint not found", 404);
  await ensureProjectAccess(
    sprint.projectId.toString(),
    tenantId,
    userId,
    role,
  );
  if (sprint.state === "closed") {
    throw httpError("Sprint is already closed", 400);
  }
  if (sprint.state === "planned") {
    throw httpError("Sprint has not been started", 400);
  }

  let rollover: Types.ObjectId | null = null;
  if (options.rolloverSprintId) {
    const target = await Sprint.findOne({
      _id: toObjectId(options.rolloverSprintId),
      tenantId: toObjectId(tenantId),
      projectId: sprint.projectId,
    });
    if (!target) throw httpError("Rollover sprint not found", 400);
    if (target.state === "closed") {
      throw httpError("Cannot roll over to a closed sprint", 400);
    }
    rollover = target._id;
  }

  // Items still incomplete go to rollover sprint (or backlog if null).
  const rolloverResult = await WorkItem.updateMany(
    {
      tenantId: toObjectId(tenantId),
      projectId: sprint.projectId,
      sprintId: sprint._id,
      state: { $nin: ["DONE", "CANCELLED"] },
    },
    { $set: { sprintId: rollover } },
  );

  // Count completed items before closing the sprint.
  const completed = await WorkItem.countDocuments({
    tenantId: toObjectId(tenantId),
    projectId: sprint.projectId,
    sprintId: sprint._id,
    state: "DONE",
  });

  sprint.state = "closed";
  sprint.closedAt = new Date();
  await sprint.save();

  return {
    sprint,
    rolledOver: rolloverResult.modifiedCount,
    completed,
  };
}

export async function deleteSprint(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  if (!isPrivileged(role)) {
    throw httpError("Only managers and admins can delete sprints", 403);
  }
  const sprint = await Sprint.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
  if (!sprint) return false;
  await ensureProjectAccess(
    sprint.projectId.toString(),
    tenantId,
    userId,
    role,
  );
  if (sprint.state === "active") {
    throw httpError("Active sprints must be closed before deletion", 400);
  }
  // Detach any items still pointing at the sprint.
  await WorkItem.updateMany(
    {
      tenantId: toObjectId(tenantId),
      sprintId: sprint._id,
    },
    { $set: { sprintId: null } },
  );
  await Sprint.deleteOne({ _id: sprint._id });
  return true;
}

export async function sprintReport(
  id: string,
  tenantId: string,
  userId: string,
  role: Role,
): Promise<SprintReport> {
  const sprint = await Sprint.findOne({
    _id: toObjectId(id),
    tenantId: toObjectId(tenantId),
  });
  if (!sprint) throw httpError("Sprint not found", 404);
  await ensureProjectAccess(
    sprint.projectId.toString(),
    tenantId,
    userId,
    role,
  );

  const items = await WorkItem.find({
    tenantId: toObjectId(tenantId),
    projectId: sprint.projectId,
    sprintId: sprint._id,
  });

  const completed: string[] = [];
  const incomplete: string[] = [];
  const cancelled: string[] = [];
  let completedPoints = 0;
  let incompletePoints = 0;
  let cancelledPoints = 0;

  for (const item of items) {
    const points = item.storyPoints ?? 0;
    if (item.state === "DONE") {
      completed.push(item._id.toString());
      completedPoints += points;
    } else if (item.state === "CANCELLED") {
      cancelled.push(item._id.toString());
      cancelledPoints += points;
    } else {
      incomplete.push(item._id.toString());
      incompletePoints += points;
    }
  }

  return {
    sprint,
    completed: { count: completed.length, storyPoints: completedPoints },
    incomplete: { count: incomplete.length, storyPoints: incompletePoints },
    cancelled: { count: cancelled.length, storyPoints: cancelledPoints },
    total: {
      count: items.length,
      storyPoints: completedPoints + incompletePoints + cancelledPoints,
    },
    items: { completed, incomplete, cancelled },
  };
}
