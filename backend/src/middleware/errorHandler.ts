import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../config/logger';
import { errorResponse } from '../utils/response';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    errorResponse(res, `Validation error: ${errors}`, 400);
    return;
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      errorResponse(res, 'A record with this value already exists', 409);
      return;
    }
    if (err.code === 'P2025') {
      errorResponse(res, 'Record not found', 404);
      return;
    }
  }

  errorResponse(
    res,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    err.statusCode || 500
  );
};

export const notFoundHandler = (req: Request, res: Response): void => {
  errorResponse(res, `Route ${req.originalUrl} not found`, 404);
};
