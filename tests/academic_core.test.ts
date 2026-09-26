import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { seedDatabase } from '../server/db/seed';
import { dbClient } from '../server/db';

let adminToken: string;
let facultyToken: string;
let studentToken: string;
let cseDeptId: string;
let cseProgId: string;
let ayId: string;
let semId: string;
let secAId: string;
let secBId: string;
let testStudentId: string;

beforeAll(async () => {
  await seedDatabase();

  // Login Admin
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin.vance@campus.edu', password: 'Password@123' });
  adminToken = adminLogin.body.data.token;

  // Login Faculty
  const facultyLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 's.jenkins@campus.edu', password: 'Password@123' });
  facultyToken = facultyLogin.body.data.token;

  // Login Student
  const studentLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'm.chen@campus.edu', password: 'Password@123' });
  studentToken = studentLogin.body.data.token;

  // Get Academic Hierarchy IDs
  const deptRes = await dbClient.query(`SELECT id FROM departments WHERE code = 'CSE' LIMIT 1`);
  cseDeptId = deptRes.rows[0].id;

  const progRes = await dbClient.query(`SELECT id FROM programs WHERE department_id = $1 LIMIT 1`, [cseDeptId]);
  cseProgId = progRes.rows[0].id;

  const ayRes = await dbClient.query(`SELECT id FROM academic_years WHERE is_current = true LIMIT 1`);
  ayId = ayRes.rows[0].id;

  const semRes = await dbClient.query(`SELECT id FROM semesters WHERE academic_year_id = $1 LIMIT 1`, [ayId]);
  semId = semRes.rows[0].id;

  const secRes = await dbClient.query(`SELECT id, name FROM sections WHERE program_id = $1 ORDER BY name ASC`, [cseProgId]);
  secAId = secRes.rows[0].id;
  if (secRes.rows.length > 1) {
    secBId = secRes.rows[1].id;
  } else {
    const secBRes = await dbClient.query(`
      INSERT INTO sections (program_id, semester_id, name, capacity)
      VALUES ($1, $2, 'Section B', 60)
      RETURNING id
    `, [cseProgId, semId]);
    secBId = secBRes.rows[0].id;
  }
});


describe('Academic Core: Departments & Hierarchy', () => {
  let _createdDeptId: string;

  it('allows admin to create a new department', async () => {
    const res = await request(app)
      .post('/api/v1/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Aerospace Engineering',
        code: 'AERO',
        description: 'Department of Aerospace and Aeronautical Engineering',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('AERO');
    _createdDeptId = res.body.data.id;
  });

  it('enforces department code uniqueness within institution', async () => {
    const res = await request(app)
      .post('/api/v1/academics/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Duplicate Aerospace',
        code: 'AERO',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_DEPARTMENT_CODE');
  });

  it('rejects non-admin from creating a department (RBAC)', async () => {
    const res = await request(app)
      .post('/api/v1/academics/departments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        name: 'Chemical Engineering',
        code: 'CHEM',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('retrieves department statistics rollup (students, faculty, courses, attendance)', async () => {
    const res = await request(app)
      .get(`/api/v1/academics/departments/${cseDeptId}/stats`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.studentCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.facultyCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.courseCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.averageAttendancePercentage).toBeDefined();
  });
});

describe('Academic Core: Courses & Offerings', () => {
  it('allows admin to create a course with code uniqueness check', async () => {
    const res = await request(app)
      .post('/api/v1/academics/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'CS501',
        name: 'Advanced Distributed Systems',
        credits: 4,
        type: 'elective',
        departmentId: cseDeptId,
        programId: cseProgId,
        semesterId: semId,
        description: 'Principles of large-scale distributed systems and consensus',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.code).toBe('CS501');
  });

  it('rejects duplicate course code under the same department', async () => {
    const res = await request(app)
      .post('/api/v1/academics/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'CS501',
        name: 'Another Distributed Systems',
        credits: 3,
        type: 'core',
        departmentId: cseDeptId,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_COURSE_CODE');
  });

  it('lists courses with department filtering and pagination', async () => {
    const res = await request(app)
      .get(`/api/v1/academics/courses?departmentId=${cseDeptId}&page=1&limit=10`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('Academic Core: Student Profile & Section Transfers', () => {
  it('allows admin to create a student with automated section enrollment', async () => {
    const res = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'Priya',
        lastName: 'Nair',
        email: 'priya.nair@student.campus.edu',
        rollNumber: 'CS26-088',
        registrationNumber: 'REG-2026-088',
        departmentId: cseDeptId,
        programId: cseProgId,
        academicYearId: ayId,
        currentSemesterId: semId,
        currentSectionId: secAId,
        dateOfBirth: '2004-05-15',
        gender: 'female',
        bloodGroup: 'B+',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rollNumber).toBe('CS26-088');
    testStudentId = res.body.data.id;

    // Verify enrollment created in PostgreSQL
    const enrollRes = await dbClient.query(
      `SELECT * FROM enrollments WHERE student_id = $1`,
      [testStudentId]
    );
    expect(enrollRes.rows.length).toBeGreaterThan(0);
  });

  it('performs auditable section transfer with history tracking', async () => {
    const res = await request(app)
      .post(`/api/v1/students/${testStudentId}/transfer-section`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        toSectionId: secBId,
        reason: 'Laboratory schedule balancing and batch re-allocation',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transferId).toBeDefined();

    // Verify student current_section_id updated
    const stuRes = await dbClient.query(`SELECT current_section_id FROM students WHERE id = $1`, [testStudentId]);
    expect(stuRes.rows[0].current_section_id).toBe(secBId);

    // Verify transfer record in section_transfers table
    const transferRes = await dbClient.query(
      `SELECT * FROM section_transfers WHERE student_id = $1`,
      [testStudentId]
    );
    expect(transferRes.rows.length).toBe(1);
    expect(transferRes.rows[0].from_section_id).toBe(secAId);
    expect(transferRes.rows[0].to_section_id).toBe(secBId);
  });

  it('returns complete student academic dossier including transfers', async () => {
    const res = await request(app)
      .get(`/api/v1/students/${testStudentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overview).toBeDefined();
    expect(res.body.data.academic).toBeDefined();
    expect(res.body.data.attendance).toBeDefined();
    expect(res.body.data.enrolledCourses).toBeDefined();
    expect(res.body.data.sectionTransfers).toHaveLength(1);
  });

  it('prevents student from transferring their own section (RBAC)', async () => {
    const res = await request(app)
      .post(`/api/v1/students/${testStudentId}/transfer-section`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        toSectionId: secAId,
        reason: 'Unauthorized self-transfer',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
