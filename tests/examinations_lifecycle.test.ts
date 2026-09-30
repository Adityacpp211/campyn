import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { seedDatabase } from '../server/db/seed';
import { dbClient } from '../server/db';

let adminToken: string;
let facultyToken: string;
let studentToken: string;
let semesterId: string;
let courseId: string;
let testExamId: string;
let testMarksId: string;

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

  // 2. Fetch semester ID and CS301 course ID
  const semRes = await dbClient.query(`SELECT id FROM semesters LIMIT 1`);
  semesterId = semRes.rows[0].id;

  const courseRes = await dbClient.query(`SELECT id FROM courses WHERE code = 'CS301'`);
  courseId = courseRes.rows[0].id;
});

describe('Phase 6: Examination & Marks Lifecycle', () => {
  describe('Examination Scheduling', () => {
    it('allows college administrator to schedule a new examination session', async () => {
      const res = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          semesterId,
          title: 'Fall 2026 End-Semester Comprehensive Exams',
          examType: 'final',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Fall 2026 End-Semester Comprehensive Exams');
      expect(res.body.data.examType).toBe('final');
      expect(res.body.data.isLocked).toBe(false);
      testExamId = res.body.data.id;
    });

    it('rejects exam creation by unauthorized student persona', async () => {
      const res = await request(app)
        .post('/api/v1/exams')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          semesterId,
          title: 'Unauthorized Student Exam',
          examType: 'final',
        });

      expect(res.status).toBe(403);
    });
  });

  describe('Roster Population & Marks Entry', () => {
    it('auto-populates student marks entries from enrolled student cohort', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${testExamId}/populate-roster`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          courseId,
          maxMarks: 100,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.populatedCount).toBeGreaterThan(0);
    });

    it('fetches populated marks entries for the examination', async () => {
      const res = await request(app)
        .get(`/api/v1/exams/${testExamId}/marks`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      const entry = res.body.data.find((m: any) => m.studentRoll === 'CSE-24-001');
      expect(entry).toBeDefined();
      expect(entry.maxMarks).toBe(100);
      testMarksId = entry.id;
    });

    it('allows faculty to enter and update student marks with mandatory justification', async () => {
      const res = await request(app)
        .put(`/api/v1/exams/marks/${testMarksId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksObtained: 92.5,
          grade: 'A+',
          reason: 'Comprehensive theory examination and lab viva evaluation verified',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.marksObtained).toBe(92.5);
      expect(res.body.data.grade).toBe('A+');
    });

    it('rejects marks update without mandatory audit justification reason', async () => {
      const res = await request(app)
        .put(`/api/v1/exams/marks/${testMarksId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksObtained: 85,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects marks obtained exceeding maximum marks boundary', async () => {
      const res = await request(app)
        .put(`/api/v1/exams/marks/${testMarksId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksObtained: 150,
          reason: 'Excess marks attempted',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Locking & Cryptographic Audit Verification', () => {
    it('allows administrator to lock and publish examination results', async () => {
      const res = await request(app)
        .post(`/api/v1/exams/${testExamId}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isLocked).toBe(true);
      expect(res.body.data.isPublished).toBe(true);
    });

    it('strictly forbids marks modifications once examination is locked', async () => {
      const res = await request(app)
        .put(`/api/v1/exams/marks/${testMarksId}`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksObtained: 70,
          reason: 'Attempted modification on locked exam',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('locked');
    });

    it('confirms cryptographic SHA-256 chain integrity verification includes exam marks audit', async () => {
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
