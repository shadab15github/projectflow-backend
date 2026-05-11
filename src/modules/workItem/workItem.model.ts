import mongoose, { Schema, Document, Types } from "mongoose";
import {
  IWorkItem,
  IWorkItemAttachment,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from "../../types";

export interface IWorkItemDocument
  extends Omit<IWorkItem, "_id">,
    Document {
  _id: Types.ObjectId;
}

const WORK_ITEM_TYPES: WorkItemType[] = ["segment", "task", "subtask"];

const WORK_ITEM_STATES: WorkItemState[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "BLOCKED",
  "CANCELLED",
];

const WORK_ITEM_PRIORITIES: WorkItemPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

const attachmentSchema = new Schema<IWorkItemAttachment>(
  {
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
    mimeType: { type: String, trim: true },
    size: { type: Number },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const workItemSchema = new Schema<IWorkItemDocument>(
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
    type: {
      type: String,
      enum: WORK_ITEM_TYPES,
      required: true,
      index: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "WorkItem",
      default: null,
      index: true,
    },
    number: {
      type: Number,
      required: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
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
      enum: WORK_ITEM_STATES,
      default: "TODO",
      index: true,
    },
    priority: {
      type: String,
      enum: WORK_ITEM_PRIORITIES,
      default: "medium",
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    labels: {
      type: [String],
      default: [],
    },
    componentIds: {
      type: [Schema.Types.ObjectId],
      ref: "Component",
      default: [],
    },
    sprintId: {
      type: Schema.Types.ObjectId,
      ref: "Sprint",
      default: null,
      index: true,
    },
    storyPoints: {
      type: Number,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    attachments: {
      type: [attachmentSchema],
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

workItemSchema.index({ tenantId: 1, projectId: 1, state: 1 });
workItemSchema.index({ tenantId: 1, projectId: 1, type: 1 });
workItemSchema.index({ tenantId: 1, projectId: 1, sprintId: 1 });
workItemSchema.index({ tenantId: 1, projectId: 1, parentId: 1 });
workItemSchema.index({ tenantId: 1, assigneeId: 1 });
workItemSchema.index({ tenantId: 1, projectId: 1, key: 1 }, { unique: true });

const WorkItem = mongoose.model<IWorkItemDocument>(
  "WorkItem",
  workItemSchema,
);

export default WorkItem;
