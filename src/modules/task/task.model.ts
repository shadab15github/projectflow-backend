import mongoose, { Schema, Document, Types } from "mongoose";
import { ITask, TaskPriority, TaskState } from "../../types";

export interface ITaskDocument extends Omit<ITask, "_id">, Document {
  _id: Types.ObjectId;
}

const TASK_STATES: TaskState[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "BLOCKED",
  "CANCELLED",
];

const TASK_PRIORITIES: TaskPriority[] = ["low", "medium", "high", "urgent"];

const taskSchema = new Schema<ITaskDocument>(
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
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      enum: TASK_STATES,
      default: "TODO",
      index: true,
    },
    priority: {
      type: String,
      enum: TASK_PRIORITIES,
      default: "medium",
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    labels: {
      type: [String],
      default: [],
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

taskSchema.index({ tenantId: 1, projectId: 1, state: 1 });
taskSchema.index({ tenantId: 1, assigneeId: 1 });

const Task = mongoose.model<ITaskDocument>("Task", taskSchema);

export default Task;
