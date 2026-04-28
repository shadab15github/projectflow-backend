import mongoose, { Schema, Document, Types } from "mongoose";
import { IProject, ProjectStatus } from "../../types";

export interface IProjectDocument extends Omit<IProject, "_id">, Document {
  _id: Types.ObjectId;
}

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
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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

const Project = mongoose.model<IProjectDocument>("Project", projectSchema);

export default Project;
