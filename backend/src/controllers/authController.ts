import { Response } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import { generateToken } from '../utils/jwt';
import { successResponse, errorResponse } from '../utils/response';
import { RegisterInput, LoginInput } from '../utils/validation';

export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password, name, role }: RegisterInput = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      errorResponse(res, 'User with this email already exists', 409);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || 'STAFF',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    successResponse(res, { user, token }, 'User registered successfully', 201);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginInput = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      errorResponse(res, 'Invalid email or password', 401);
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      errorResponse(res, 'Invalid email or password', 401);
      return;
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const { passwordHash: _passwordHash, ...userWithoutPassword } = user;

    successResponse(res, { user: userWithoutPassword, token }, 'Login successful');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const logout = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    res.clearCookie('token');
    successResponse(res, null, 'Logout successful');
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      errorResponse(res, 'Not authenticated', 401);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    successResponse(res, user);
  } catch (error: any) {
    errorResponse(res, error.message, 500);
  }
};
