import { Types } from "mongoose";
import User, { IUserDocument } from "../auth/auth.model";

function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export async function listUsers(tenantId: string): Promise<IUserDocument[]> {
  try {
    return await User.find({ tenantId: toObjectId(tenantId) })
      .select("-passwordHash")
      .sort({ name: 1 });
  } catch (error) {
    throw Object.assign(new Error("Failed to list users"), { status: 500 });
  }
}
