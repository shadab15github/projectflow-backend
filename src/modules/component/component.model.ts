import mongoose, { Schema, Document, Types } from "mongoose";
import { IComponent } from "../../types";

export interface IComponentDocument
  extends Omit<IComponent, "_id">,
    Document {
  _id: Types.ObjectId;
}

const componentSchema = new Schema<IComponentDocument>(
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
    description: {
      type: String,
      default: "",
      trim: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    defaultAssigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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

componentSchema.index(
  { tenantId: 1, projectId: 1, name: 1 },
  { unique: true },
);

const Component = mongoose.model<IComponentDocument>(
  "Component",
  componentSchema,
);

export default Component;
