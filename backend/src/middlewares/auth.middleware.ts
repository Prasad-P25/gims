import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthenticatedRequest, AuthPayload, UserRole } from '../types';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { logger } from '../utils/logger';

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      sendUnauthorized(res, 'No authorization header provided');
      return;
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      sendUnauthorized(res, 'Invalid authorization format. Use: Bearer <token>');
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendUnauthorized(res, 'Token has expired');
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      sendUnauthorized(res, 'Invalid token');
      return;
    }
    logger.error('Authentication error:', error);
    sendUnauthorized(res, 'Authentication failed');
  }
};

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'User not authenticated');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
};

export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer === 'Bearer' && token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      req.user = decoded;
    }

    next();
  } catch {
    // Invalid token, but continue without authentication
    next();
  }
};

// Generate tokens
export const generateTokens = (payload: AuthPayload): { accessToken: string; refreshToken: string } => {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as string,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
};

export const verifyRefreshToken = (token: string): AuthPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthPayload;
};
