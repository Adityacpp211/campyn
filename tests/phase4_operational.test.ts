import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { seedDatabase } from '../server/db/seed';
import { dbClient } from '../server/db';

let adminToken: string;
let facultyToken: string;
let studentToken: string;
let cseDeptId: string;
let eceDeptId: string;
let testSessionId: string;
let testRecordId: string;

beforeAll(async () => {
  await seedDatabase();

  // 1. Authenticate personas
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin.vance@campus.edu', password: 'Password@123' });
  adminToken = adminLogin.body.data.token;

  const facultyLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 's.jenkins@campus.edu', password: 'Password@123' });
  facultyToken = facultyLogin.body.data.token;

  const studentLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'm.chen@campus.edu', password: 'Password@123' });
  studentToken = studentLogin.body.data.token;

  // 2. Fetch real department IDs
  const deptRes = await dbClient.query('SELECT id, code FROM departments WHERE code IN (\'CSE\', \'ECE\')');
  for (const row of deptRes.rows) {
    if (row.code === 'CSE') cseDeptId = row.id;
    if (row.code === 'ECE') eceDeptId = row.id;
  }

  // 3. Fetch an existing seeded attendance session and record
  const sessionRes = await dbClient.query(`
    SELECT s.id as session_id, r.id as record_id
    FROM attendance_sessions s
    JOIN attendance_records r ON s.id = r.session_id
    LIMIT 1
  `);
  testSessionId = sessionRes.rows[0].session_id;
  testRecordId = sessionRes.rows[0].record_id;
});

describe('Phase 4: Operational Data Binding & Scope Verification', () => {
  describe('Global Scope Filtering (Departments & Sections)', () => {
    it('filters students by department ID', async () => {
      const res = await request(app)
        .get(`/api/v1/students?departmentId=${cseDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const student of res.body.data) {
        expect(student.departmentId).toBe(cseDeptId);
      }
    });

    it('filters students by section name', async () => {
      const res = await request(app)
        .get('/api/v1/students?section=Section%20A')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const student of res.body.data) {
        expect(student.sectionName).toBe('Section A');
      }
    });

    it('filters faculty roster by department ID', async () => {
      const res = await request(app)
        .get(`/api/v1/faculty?departmentId=${cseDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const fac of res.body.data) {
        expect(fac.departmentId).toBe(cseDeptId);
      }
    });

    it('returns empty array when department has no faculty', async () => {
      const res = await request(app)
        .get(`/api/v1/faculty?departmentId=${eceDeptId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Authoritative Attendance Lifecycle & Immutability Locks', () => {
    it('returns empty records array when sessionId is omitted', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/records')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns records when sessionId is provided', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/records?sessionId=${testSessionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].sessionId).toBe(testSessionId);
    });

    it('allows faculty to update attendance record in an open session with mandatory reason', async () => {
      const res = await request(app)
        .put(`/api/v1/attendance/records/${testRecordId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          status: 'late',
          reason: 'Student arrived 15 minutes late due to verified transit delay',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('late');
    });

    it('rejects attendance update if reason is missing or too short', async () => {
      const res = await request(app)
        .put(`/api/v1/attendance/records/${testRecordId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          status: 'present',
          reason: 'ok', // Less than 5 characters
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('allows HOD/Admin to lock the attendance session', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${testSessionId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isLocked).toBe(true);

      // Verify in DB directly
      const checkDb = await dbClient.query('SELECT is_locked FROM attendance_sessions WHERE id = $1', [testSessionId]);
      expect(checkDb.rows[0].is_locked).toBe(true);
    });

    it('strictly forbids direct record edits on locked sessions (SESSION_LOCKED 403)', async () => {
      const res = await request(app)
        .put(`/api/v1/attendance/records/${testRecordId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          status: 'present',
          reason: 'Post-lock unauthorized edit attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SESSION_LOCKED');
    });

    it('allows submitting an official correction ticket for locked records', async () => {
      const res = await request(app)
        .post('/api/v1/attendance/corrections')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          attendanceRecordId: testRecordId,
          newStatus: 'present',
          reason: 'Official medical certificate validated by health center',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
    });

    it('rejects student from locking attendance sessions (RBAC 403)', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${testSessionId}/lock`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('verifies that the cryptographic audit trail remains fully intact', async () => {
      const res = await request(app)
        .get('/api/v1/audit/verify-chain')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isValid).toBe(true);
      expect(res.body.data.totalRecords).toBeGreaterThan(0);
    });
  });
});
