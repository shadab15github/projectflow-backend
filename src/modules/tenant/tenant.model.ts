import mongoose, { Schema, Document, Types } from "mongoose";
import { ITenant } from "../../types";

export interface ITenantDocument extends Omit<ITenant, "_id">, Document {
  _id: Types.ObjectId;
}

const tenantSchema = new Schema<ITenantDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    plan: {
      type: String,
      required: true,
      default: "free",
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

const Tenant = mongoose.model<ITenantDocument>("Tenant", tenantSchema);

export default Tenant;
