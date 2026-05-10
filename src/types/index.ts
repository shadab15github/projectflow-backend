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
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskState =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'BLOCKED'
  | 'CANCELLED';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ITask {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  projectId: Types.ObjectId;
  title: string;
  description: string;
  state: TaskState;
  priority: TaskPriority;
  assigneeId?: Types.ObjectId;
  labels: string[];
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
