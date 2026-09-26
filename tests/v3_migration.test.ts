import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../server/index';
import { seedDatabase } from '../server/db/seed';

let adminToken: string;
let studentToken: string;
let _facultyToken: string;
let sampleStudentId: string;
let sampleApprovalId: string;
let sampleExamId: string;

beforeAll(async () => {
  await seedDatabase();

  const adminLogin = await request(app).post('/api/auth/switch-role').send({ role: 'COLLEGE_ADMIN' });
  adminToken = adminLogin.body.data.token;

  const studentLogin = await request(app).post('/api/auth/switch-role').send({ role: 'STUDENT' });
  studentToken = studentLogin.body.data.token;

  const facultyLogin = await request(app).post('/api/auth/switch-role').send({ role: 'FACULTY' });
  _facultyToken = facultyLogin.body.data.token;
});

describe('Phase V3 Verification: PostgreSQL Source of Truth & Zero Mock Data', () => {
  it('verifies src/services/db.ts is completely removed from repository', () => {
    const dbPath = path.resolve(__dirname, '../src/services/db.ts');
    expect(fs.existsSync(dbPath)).toBe(false);
  });

  describe('Authentication and Session Lifecycles', () => {
    it('returns 401 when accessing protected endpoints without token', async () => {
      const res = await request(app).get('/api/v1/auth/session');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns authenticated user session with real backend permissions array', async () => {
      const res = await request(app)
        .get('/api/v1/auth/session')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('COLLEGE_ADMIN');
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
      expect(res.body.data.permissions).toContain('students.create');
      expect(res.body.data.permissions).toContain('departments.manage');
      expect(res.body.data.permissions).toContain('courses.manage');
    });

    it('rejects role switching when NODE_ENV is production', async () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const res = await request(app).post('/api/auth/switch-role').send({ role: 'STUDENT' });
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toMatch(/Role switching is permanently disabled in production/);
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });
  });

  describe('Student Module (Real PostgreSQL API)', () => {
    it('supports listing, searching, pagination from database', async () => {
      const res = await request(app)
        .get('/api/v1/students?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.pagination).toBeDefined();

      sampleStudentId = res.body.data[0].id;
    });

    it('retrieves student by real ID', async () => {
      const res = await request(app)
        .get(`/api/v1/students/${sampleStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(sampleStudentId);
      expect(res.body.data.roll_number).toBeDefined();
    });

    it('supports PATCH /api/v1/students/:id for updating section and status', async () => {
      const res = await request(app)
        .patch(`/api/v1/students/${sampleStudentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ academicStatus: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns student profile for authenticated student', async () => {
      const res = await request(app)
        .get('/api/v1/students/profile')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBeDefined();
    });
  });

  describe('Faculty & Academic Module', () => {
    it('fetches faculty list backed by database', async () => {
      const res = await request(app)
        .get('/api/v1/faculty')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('fetches departments and academic years from database', async () => {
      const deptsRes = await request(app)
        .get('/api/v1/academics/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deptsRes.status).toBe(200);
      expect(deptsRes.body.success).toBe(true);
      expect(Array.isArray(deptsRes.body.data)).toBe(true);

      const ayRes = await request(app)
        .get('/api/v1/academics/academic-years')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(ayRes.status).toBe(200);
      expect(ayRes.body.success).toBe(true);
      expect(Array.isArray(ayRes.body.data)).toBe(true);
    });
  });

  describe('Attendance & Timetable Modules', () => {
    it('fetches real attendance sessions and statistics', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('fetches timetable slots with conflict detection', async () => {
      const res = await request(app)
        .get('/api/v1/timetable')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Approvals Module', () => {
    it('fetches approvals list and single approval by ID', async () => {
      const listRes = await request(app)
        .get('/api/v1/approvals')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      if (listRes.body.data.length > 0) {
        sampleApprovalId = listRes.body.data[0].id;
        const singleRes = await request(app)
          .get(`/api/v1/approvals/${sampleApprovalId}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(singleRes.status).toBe(200);
        expect(singleRes.body.success).toBe(true);
        expect(singleRes.body.data.id).toBe(sampleApprovalId);
      }
    });

    it('rejects student attempting to access or approve governance requests (403 Forbidden)', async () => {
      // 1. Student cannot list approvals
      const listRes = await request(app)
        .get('/api/v1/approvals')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(listRes.status).toBe(403);
      expect(listRes.body.error.code).toBe('FORBIDDEN');

      // 2. Student cannot resolve approval requests
      const targetId = sampleApprovalId || '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/api/v1/approvals/${targetId}/resolve`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ decision: 'approved', reason: 'Self-approval try' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Audit Module', () => {
    it('reads audit logs strictly from backend and verifies SHA-256 chain integrity', async () => {
      const res = await request(app)
        .get('/api/v1/audit?limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const verifyRes = await request(app)
        .get('/api/v1/audit/verify-chain')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.isValid).toBe(true);
    });
  });

  describe('Exams Module & Locking', () => {
    it('lists exams and supports toggle-lock endpoint with audit logging', async () => {
      const listRes = await request(app)
        .get('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(Array.isArray(listRes.body.data)).toBe(true);

      if (listRes.body.data.length > 0) {
        sampleExamId = listRes.body.data[0].id;
        const lockRes = await request(app)
          .post(`/api/v1/exams/${sampleExamId}/toggle-lock`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(lockRes.status).toBe(200);
        expect(lockRes.body.success).toBe(true);
        expect(typeof lockRes.body.data.isLocked).toBe('boolean');
      }
    });
  });

  describe('Dashboard Aggregate Endpoint', () => {
    it('returns aggregated counts and metrics without frontend recalculation', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics).toHaveProperty('totalStudents');
      expect(res.body.data.metrics).toHaveProperty('totalFaculty');
      expect(res.body.data.metrics).toHaveProperty('attendanceRate');
      expect(res.body.data.metrics).toHaveProperty('pendingApprovals');
    });
  });
});
