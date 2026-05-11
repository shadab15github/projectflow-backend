import mongoose, { Schema, Document, Types } from "mongoose";
import { ISprint, SprintState } from "../../types";

export interface ISprintDocument extends Omit<ISprint, "_id">, Document {
  _id: Types.ObjectId;
}

const SPRINT_STATES: SprintState[] = ["planned", "active", "closed"];

const sprintSchema = new Schema<ISprintDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    goal: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      enum: SPRINT_STATES,
      default: "planned",
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

sprintSchema.index({ tenantId: 1, projectId: 1, state: 1 });

// At most one active sprint per project at any time.
sprintSchema.index(
  { tenantId: 1, projectId: 1 },
  {
    unique: true,
    partialFilterExpression: { state: "active" },
    name: "one_active_sprint_per_project",
  },
);

const Sprint = mongoose.model<ISprintDocument>("Sprint", sprintSchema);

export default Sprint;
