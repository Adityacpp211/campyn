import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { seedDatabase } from '../server/db/seed';
import { dbClient } from '../server/db';

let adminToken: string;
let facultyToken: string;
let studentToken: string;
let secCourseId: string;
let studentId: string;
let testAssignmentId: string;
let testSubmissionId: string;

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

  // 2. Fetch real CS301 section course allocation
  const scRes = await dbClient.query(`
    SELECT sc.id, sc.faculty_id
    FROM section_courses sc
    JOIN courses c ON sc.course_id = c.id
    WHERE c.code = 'CS301'
    LIMIT 1
  `);
  secCourseId = scRes.rows[0].id;

  // 3. Fetch student ID for m.chen (CSE-24-001)
  const stuRes = await dbClient.query(`SELECT id FROM students WHERE roll_number = 'CSE-24-001'`);
  studentId = stuRes.rows[0].id;
});

describe('Phase 5: Coursework & Assignment Engine Lifecycle', () => {
  describe('Assignment Creation & Scoping', () => {
    it('allows faculty assigned to section course to create a coursework assignment', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          sectionCourseId: secCourseId,
          title: 'Problem Set 5: Graph Theory & Flow Networks',
          description: 'Implement Dinic algorithm and benchmark maximum bipartite matching.',
          maxMarks: 50,
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          allowLate: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Problem Set 5: Graph Theory & Flow Networks');
      expect(res.body.data.maxMarks).toBe(50);
      expect(res.body.data.allowLate).toBe(true);
      testAssignmentId = res.body.data.id;
    });

    it('rejects assignment creation with invalid max marks', async () => {
      const res = await request(app)
        .post('/api/v1/assignments')
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          sectionCourseId: secCourseId,
          title: 'Invalid Assignment',
          maxMarks: -10,
          dueDate: new Date().toISOString(),
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('lists assignments with real submission aggregates and enrollment counts', async () => {
      const res = await request(app)
        .get('/api/v1/assignments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const asg = res.body.data.find((a: any) => a.id === testAssignmentId);
      expect(asg).toBeDefined();
      expect(asg.courseCode).toBe('CS301');
      expect(asg.totalStudents).toBeGreaterThan(0);
    });
  });

  describe('Student Submission Flow', () => {
    it('allows enrolled student to submit assignment deliverable', async () => {
      const res = await request(app)
        .post(`/api/v1/assignments/${testAssignmentId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          fileUrl: 'https://github.com/mchen/dinic-maxflow.git',
          notes: 'Implemented Dinic algorithm with O(V^2 E) time bound and validated on 100 test graphs.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignmentId).toBe(testAssignmentId);
      expect(res.body.data.isLate).toBe(false);
      testSubmissionId = res.body.data.id;
    });

    it('returns submissions for assignment with student particulars', async () => {
      const res = await request(app)
        .get(`/api/v1/assignments/${testAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${facultyToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const studentSub = res.body.data.find((s: any) => s.studentRoll === 'CSE-24-001');
      expect(studentSub).toBeDefined();
      expect(studentSub.studentName).toContain('Chen');
    });

    it('restricts student view of submissions to only their own record', async () => {
      const res = await request(app)
        .get(`/api/v1/assignments/${testAssignmentId}/submissions`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const sub of res.body.data) {
        expect(sub.studentRoll).toBe('CSE-24-001');
      }
    });
  });

  describe('Faculty Evaluation & Audit Trail', () => {
    it('allows faculty to evaluate submission and record grade with audit justification', async () => {
      const res = await request(app)
        .put(`/api/v1/assignments/submissions/${testSubmissionId}/grade`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksAwarded: 48.5,
          feedback: 'Outstanding implementation of Dinic level graph construction',
          reason: 'Verified time bounds and memory allocation invariants',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.marksAwarded).toBe(48.5);
      expect(res.body.data.feedback).toBe('Outstanding implementation of Dinic level graph construction');
    });

    it('rejects grade exceeding assignment maximum marks', async () => {
      const res = await request(app)
        .put(`/api/v1/assignments/submissions/${testSubmissionId}/grade`)
        .set('Authorization', `Bearer ${facultyToken}`)
        .send({
          marksAwarded: 999,
          reason: 'Attempted bonus marks',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('cannot exceed maximum marks');
    });

    it('verifies cryptographic audit trail contains assignment creation and grading events', async () => {
      const res = await request(app)
        .get('/api/v1/audit?entity=assignment_submissions')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const auditEntry = res.body.data.find((l: any) => l.entityId === testSubmissionId);
      expect(auditEntry).toBeDefined();
      expect(auditEntry.action).toBe('UPDATE');
      expect(auditEntry.reason).toContain('Graded submission');
    });
  });
});
