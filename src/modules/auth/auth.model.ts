import mongoose, { Schema, Document, Types } from "mongoose";
import { IUser, Role } from "../../types";

export interface IUserDocument extends Omit<IUser, "_id">, Document {
  _id: Types.ObjectId;
}

const userSchema = new Schema<IUserDocument>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["super_admin", "admin", "manager", "user"] as Role[],
      default: "admin",
    },
    avatar: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

// Compound unique index: email must be unique per tenant to allow same email across different tenants
userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model<IUserDocument>("User", userSchema);

export default User;
