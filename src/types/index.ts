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

export interface IProject {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  description: string;
  status: ProjectStatus;
  members: Types.ObjectId[];
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
