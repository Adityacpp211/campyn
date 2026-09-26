import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { seedDatabase } from '../server/db/seed';
import { dbClient } from '../server/db';

let adminToken: string;
let facultyToken: string;
let _studentToken: string;
let sectionCourseId: string;
let studentId: string;
let sessionId: string;
let recordId: string;

beforeAll(async () => {
  await seedDatabase();

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
  _studentToken = studentLogin.body.data.token;

  // Get assigned section course for Sarah Jenkins
  const scRes = await dbClient.query(`
    SELECT sc.id 
    FROM section_courses sc
    JOIN faculty f ON sc.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    WHERE u.email = 's.jenkins@campus.edu'
    LIMIT 1
  `);
  sectionCourseId = scRes.rows[0].id;

  // Get enrolled student
  const stuRes = await dbClient.query(`
    SELECT s.id 
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE u.email = 'm.chen@campus.edu'
    LIMIT 1
  `);
  studentId = stuRes.rows[0].id;
});

describe('Attendance Lifecycle: Sessions, Locking & Corrections', () => {
  it('creates an attendance session in OPEN state with records', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        sectionCourseId,
        sessionDate: '2026-09-24',
        slotStart: '09:00:00',
        slotEnd: '10:00:00',
        records: [{ studentId, status: 'present' }],
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sessionId).toBeDefined();
    sessionId = res.body.data.sessionId;

    // Get the record ID
    const recRes = await request(app)
      .get(`/api/v1/attendance/records?sessionId=${sessionId}`)
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(recRes.status).toBe(200);
    expect(recRes.body.data.length).toBeGreaterThan(0);
    recordId = recRes.body.data[0].id;
  });

  it('allows record update while session is OPEN with justification reason', async () => {
    const res = await request(app)
      .put(`/api/v1/attendance/records/${recordId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        status: 'absent',
        reason: 'Marked present by mistake; student was absent during roll call',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('absent');
  });

  it('locks the attendance session and prevents further direct edits', async () => {
    const lockRes = await request(app)
      .post(`/api/v1/attendance/sessions/${sessionId}/lock`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(lockRes.status).toBe(200);
    expect(lockRes.body.success).toBe(true);
    expect(lockRes.body.data.status).toBe('LOCKED');

    // Attempt direct edit on locked session
    const editRes = await request(app)
      .put(`/api/v1/attendance/records/${recordId}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        status: 'present',
        reason: 'Attempting to change status after locking session',
      });

    expect(editRes.status).toBe(403);
    expect(editRes.body.success).toBe(false);
    expect(editRes.body.error.code).toBe('SESSION_LOCKED');
  });

  it('submits a formal attendance correction request for locked session via governance workflow', async () => {
    const res = await request(app)
      .post('/api/v1/attendance/corrections')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        attendanceRecordId: recordId,
        newStatus: 'excused',
        reason: 'Medical leave certificate submitted to department head',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.requestType).toBe('ATTENDANCE_CORRECTION');
  });

  it('computes server-side attendance statistics and percentage rollup', async () => {
    const res = await request(app)
      .get(`/api/v1/attendance/stats?studentId=${studentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overallPercentage).toBeDefined();
    expect(res.body.data.totalClasses).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.courseBreakdown)).toBe(true);
  });

  it('computes department-wide attendance stats and identifies shortage students', async () => {
    const res = await request(app)
      .get('/api/v1/attendance/department-stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalStudentsEnrolled).toBeGreaterThanOrEqual(1);
    expect(res.body.data.averageAttendancePercentage).toBeDefined();
    expect(Array.isArray(res.body.data.shortageStudents)).toBe(true);
  });
});
