import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User, { IUserDocument } from './auth.model';
import { RegisterBody, LoginBody, TokenPayload } from '../../types';

const SALT_ROUNDS = 10;

function generateAccessToken(payload: TokenPayload): string {
  const secret: jwt.Secret = process.env.JWT_SECRET as string;
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign({ ...payload }, secret, options);
}

function generateRefreshToken(payload: TokenPayload): string {
  const secret: jwt.Secret = process.env.REFRESH_TOKEN_SECRET as string;
  const options: jwt.SignOptions = { expiresIn: '7d' };
  return jwt.sign({ ...payload }, secret, options);
}

export async function register(body: RegisterBody): Promise<{
  user: IUserDocument;
  accessToken: string;
  refreshToken: string;
}> {
  const { name, email, password, orgName } = body;

  // Create a tenant ID — Tenant module (B-03) will expand this to a full Tenant record
  const tenantId = new mongoose.Types.ObjectId();

  const existingUser = await User.findOne({ tenantId, email });
  if (existingUser) {
    throw Object.assign(new Error('User with this email already exists'), { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({
    tenantId,
    email,
    passwordHash,
    name,
    role: 'admin', // First user in a tenant is admin
  });

  const tokenPayload: TokenPayload = {
    userId: user._id.toString(),
    tenantId: user.tenantId.toString(),
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  return { user, accessToken, refreshToken };
}

export async function login(body: LoginBody): Promise<{
  user: IUserDocument;
  accessToken: string;
  refreshToken: string;
}> {
  const { email, password } = body;

  // Find user across all tenants by email
  const user = await User.findOne({ email });
  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const tokenPayload: TokenPayload = {
    userId: user._id.toString(),
    tenantId: user.tenantId.toString(),
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  return { user, accessToken, refreshToken };
}

export async function refreshToken(token: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  try {
    const decoded = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as TokenPayload;

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 401 });
    }

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      tenantId: user.tenantId.toString(),
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }
}
