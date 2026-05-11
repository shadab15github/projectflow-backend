import { Request } from 'express';
import { Types } from 'mongoose';

export type Role = 'super_admin' | 'admin' | 'manager' | 'user';

export interface TokenPayload {
  userId: string;
  tenantId: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: TokenPayload;
}

export interface IUser {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITenant {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: Date;
}

export type ProjectStatus = 'active' | 'archived';

export type ProjectTemplate = 'board' | 'list';

export type ProjectManagement = 'team-managed' | 'company-managed';

export type ProjectAccess = 'open' | 'private';

export type ProjectMemberRole = 'administrator' | 'member' | 'viewer';

export interface IProjectMember {
  userId: Types.ObjectId;
  role: ProjectMemberRole;
}

export interface IProject {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  template: ProjectTemplate;
  key: string;
  management: ProjectManagement;
  access: ProjectAccess;
  members: IProjectMember[];
  nextWorkItemNumber: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type WorkItemType = 'segment' | 'task' | 'subtask';

export type WorkItemState =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'BLOCKED'
  | 'CANCELLED';

export type WorkItemPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface IWorkItemAttachment {
  name: string;
  url: string;
  publicId?: string;
  mimeType?: string;
  size?: number;
  uploadedAt: Date;
}

export interface IWorkItem {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  projectId: Types.ObjectId;
  type: WorkItemType;
  parentId: Types.ObjectId | null;
  number: number;
  key: string;
  title: string;
  description: string;
  state: WorkItemState;
  priority: WorkItemPriority;
  assigneeId: Types.ObjectId | null;
  reporterId: Types.ObjectId;
  labels: string[];
  componentIds: Types.ObjectId[];
  sprintId: Types.ObjectId | null;
  storyPoints: number | null;
  dueDate: Date | null;
  attachments: IWorkItemAttachment[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type SprintState = 'planned' | 'active' | 'closed';

export interface ISprint {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  goal: string;
  state: SprintState;
  startDate: Date | null;
  endDate: Date | null;
  startedAt: Date | null;
  closedAt: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IComponent {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  description: string;
  leadId: Types.ObjectId | null;
  defaultAssigneeId: Types.ObjectId | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterBody {
  name: string;
  email: string;
  password: string;
  orgName: string;
}

export interface LoginBody {
  email: string;
  password: string;
}
