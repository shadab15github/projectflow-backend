import mongoose, { Schema, Document, Types } from "mongoose";
import {
  IProject,
  ProjectAccess,
  ProjectManagement,
  ProjectMemberRole,
  ProjectStatus,
  ProjectTemplate,
} from "../../types";

export interface IProjectDocument extends Omit<IProject, "_id">, Document {
  _id: Types.ObjectId;
}

const projectMemberSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["administrator", "member", "viewer"] as ProjectMemberRole[],
      default: "member",
      required: true,
    },
  },
  { _id: false },
);

const projectSchema = new Schema<IProjectDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "archived"] as ProjectStatus[],
      default: "active",
    },
    template: {
      type: String,
      enum: ["board", "list"] as ProjectTemplate[],
      default: "board",
    },
    key: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    management: {
      type: String,
      enum: ["team-managed", "company-managed"] as ProjectManagement[],
      default: "team-managed",
    },
    access: {
      type: String,
      enum: ["open", "private"] as ProjectAccess[],
      default: "open",
    },
    members: {
      type: [projectMemberSchema],
      default: [],
    },
    nextWorkItemNumber: {
      type: Number,
      default: 1,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ tenantId: 1, name: 1 });
projectSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
projectSchema.index({ tenantId: 1, key: 1 }, { unique: true });

const Project = mongoose.model<IProjectDocument>("Project", projectSchema);

export default Project;
