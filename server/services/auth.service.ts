import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { authRepository } from '../repositories/auth.repository';
import { createAuditLog } from './auditService';
import { LoginInput, PasswordResetInput } from '../validators/auth.validator';

export class AuthService {
  async login(
    input: LoginInput,
    ip: string = '127.0.0.1',
    userAgent?: string
  ): Promise<{ token: string; user: any; session: any }> {
    const user = await authRepository.findByIdentifier(input.email);

    if (!user) {
      await createAuditLog({
        action: 'LOGIN_FAILURE',
        entity: 'users',
        reason: 'User not found or identifier incorrect',
        ipAddress: ip,
      });

      const err: any = new Error('Invalid email or password');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      throw err;
    }

    // Check account lockout
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const waitMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
      await createAuditLog({
        institutionId: user.institution_id,
        actorId: user.id,
        actorEmail: user.email,
        role: user.role_code,
        action: 'SECURITY_EVENT',
        entity: 'users',
        entityId: user.id,
        reason: `Account locked attempt. Locked for ${waitMinutes} more minutes.`,
        ipAddress: ip,
      });

      const err: any = new Error(`Account is temporarily locked due to multiple failed login attempts. Please try again in ${waitMinutes} minutes.`);
      err.code = 'ACCOUNT_LOCKED';
      err.statusCode = 403;
      throw err;
    }

    // Check active status
    if (!user.is_active) {
      const err: any = new Error('This account has been deactivated. Please contact your college administrator.');
      err.code = 'USER_DEACTIVATED';
      err.statusCode = 401;
      throw err;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.password_hash);
    if (!isPasswordValid) {
      const { attempts, isLocked } = await authRepository.incrementFailedAttempts(user.id, 5, 15);

      await createAuditLog({
        institutionId: user.institution_id,
        actorId: user.id,
        actorEmail: user.email,
        role: user.role_code,
        action: 'LOGIN_FAILURE',
        entity: 'users',
        entityId: user.id,
        reason: `Incorrect password. Failed attempt #${attempts}${isLocked ? ' (Account locked for 15m)' : ''}`,
        ipAddress: ip,
      });

      const err: any = new Error('Invalid email or password');
      err.code = 'INVALID_CREDENTIALS';
      err.statusCode = 401;
      throw err;
    }

    // Reset failed login attempts on successful authentication
    await authRepository.resetFailedAttempts(user.id);

    // Create session (24h validity)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const sessionTokenSeed = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(sessionTokenSeed).digest('hex');
    
    const session = await authRepository.createSession(
      user.id,
      tokenHash,
      ip,
      userAgent,
      expiresAt
    );

    // Sign JWT embedding userId, sessionId, and role
    const token = jwt.sign(
      {
        userId: user.id,
        sessionId: session.id,
        role: user.role_code || 'STUDENT',
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Audit log
    await createAuditLog({
      institutionId: user.institution_id,
      actorId: user.id,
      actorEmail: user.email,
      role: user.role_code,
      action: 'LOGIN_SUCCESS',
      entity: 'user_sessions',
      entityId: session.id,
      reason: 'Authenticated successfully via password',
      ipAddress: ip,
    });

    return {
      token,
      user: {
        id: user.id,
        institutionId: user.institution_id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role_code,
        roleName: user.role_name,
        departmentId: user.department_id,
        departmentName: user.department_name,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
      },
      session: {
        id: session.id,
        expiresAt: session.expires_at,
      },
    };
  }

  async logout(sessionId?: string, userId?: string, ip: string = '127.0.0.1'): Promise<void> {
    if (sessionId) {
      await authRepository.revokeSession(sessionId);
    }
    if (userId) {
      await createAuditLog({
        actorId: userId,
        action: 'LOGOUT',
        entity: 'user_sessions',
        entityId: sessionId || userId,
        reason: 'User session logged out',
        ipAddress: ip,
      });
    }
  }

  async logoutAll(userId: string, ip: string = '127.0.0.1'): Promise<number> {
    const revokedCount = await authRepository.revokeAllUserSessions(userId);

    await createAuditLog({
      actorId: userId,
      action: 'LOGOUT_ALL',
      entity: 'user_sessions',
      reason: `Revoked all active sessions (${revokedCount} sessions invalidated)`,
      ipAddress: ip,
    });

    return revokedCount;
  }

  async getSession(userId: string, sessionId?: string): Promise<any> {
    const user = await authRepository.findById(userId);
    if (!user || !user.is_active) {
      const err: any = new Error('Account inactive or not found');
      err.code = 'USER_DEACTIVATED';
      err.statusCode = 401;
      throw err;
    }

    const institution = await authRepository.getInstitutionInfo(user.institution_id);

    return {
      user: {
        id: user.id,
        institutionId: user.institution_id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        role: user.role_code,
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
      },
      institution: institution ? {
        id: institution.id,
        name: institution.name,
        code: institution.code,
      } : null,
      role: user.role_code,
      roleName: user.role_name,
      department: user.department_id ? {
        id: user.department_id,
        name: user.department_name,
      } : null,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      session: sessionId ? { id: sessionId } : null,
    };
  }

  async forgotPassword(
    email: string,
    ip: string = '127.0.0.1'
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await authRepository.findByIdentifier(email);

    // Standardized generic message prevents user enumeration
    const genericResponse = {
      message: 'If the email address is associated with an active account, password reset instructions have been dispatched.',
    };

    if (!user || !user.is_active) {
      return genericResponse;
    }

    // Generate cryptographically secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    await authRepository.createPasswordResetToken(user.id, tokenHash, expiresAt);

    await createAuditLog({
      institutionId: user.institution_id,
      actorId: user.id,
      actorEmail: user.email,
      role: user.role_code,
      action: 'PASSWORD_RESET_REQUEST',
      entity: 'password_reset_tokens',
      reason: 'User requested password reset token',
      ipAddress: ip,
    });

    return {
      message: genericResponse.message,
      // Expose resetToken in non-production environments for automated testing and development
      resetToken: process.env.NODE_ENV !== 'production' ? rawToken : undefined,
    };
  }

  async resetPassword(
    input: PasswordResetInput,
    ip: string = '127.0.0.1'
  ): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
    const tokenRecord = await authRepository.findValidPasswordResetToken(tokenHash);

    if (!tokenRecord) {
      const err: any = new Error('Password reset token is invalid or has expired');
      err.code = 'INVALID_TOKEN';
      err.statusCode = 400;
      throw err;
    }

    // Hash new password using bcrypt
    const passwordHash = await bcrypt.hash(input.newPassword, 10);

    // Update password, mark token used, and revoke all active sessions
    await authRepository.updatePassword(tokenRecord.user_id, passwordHash);
    await authRepository.markPasswordResetTokenUsed(tokenRecord.id);
    await authRepository.revokeAllUserSessions(tokenRecord.user_id);

    await createAuditLog({
      actorId: tokenRecord.user_id,
      action: 'PASSWORD_RESET',
      entity: 'users',
      entityId: tokenRecord.user_id,
      reason: 'Password successfully changed and all active sessions revoked',
      ipAddress: ip,
    });

    return { message: 'Password has been successfully reset. Please sign in with your new credentials.' };
  }

  async verifyEmail(
    token: string,
    ip: string = '127.0.0.1'
  ): Promise<{ message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const tokenRecord = await authRepository.findValidEmailVerificationToken(tokenHash);

    if (!tokenRecord) {
      const err: any = new Error('Email verification token is invalid or has expired');
      err.code = 'INVALID_TOKEN';
      err.statusCode = 400;
      throw err;
    }

    await authRepository.markEmailVerificationTokenVerified(tokenRecord.id, tokenRecord.user_id);

    await createAuditLog({
      actorId: tokenRecord.user_id,
      action: 'EMAIL_VERIFIED',
      entity: 'users',
      entityId: tokenRecord.user_id,
      reason: 'Email verified successfully',
      ipAddress: ip,
    });

    return { message: 'Email address has been verified successfully.' };
  }
}

export const authService = new AuthService();
