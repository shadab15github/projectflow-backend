import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email(),
  password: z.string().min(8).max(128),
  orgName: z.string().trim().min(2).max(100),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join(', ');
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }

    const result = await authService.register(parsed.data);

    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    res.status(201).json({
      user: {
        _id: result.user._id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.user.tenantId,
      },
      token: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: formatZodError(parsed.error) });
      return;
    }

    const result = await authService.login(parsed.data);

    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    res.json({
      user: {
        _id: result.user._id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        tenantId: result.user.tenantId,
      },
      token: result.accessToken,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!token) {
      res.status(401).json({ message: 'No refresh token provided' });
      return;
    }

    const result = await authService.refreshToken(token);

    res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, COOKIE_OPTIONS);

    res.json({ token: result.accessToken });
  } catch (error) {
    next(error);
  }
}
