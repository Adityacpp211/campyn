import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { seedDatabase } from '../server/db/seed';
import { dbClient } from '../server/db';

let adminToken: string;
let _facultyToken: string;
let sc1Id: string;
let sc2Id: string;
let createdSlotId: string;

beforeAll(async () => {
  await seedDatabase();

  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin.vance@campus.edu', password: 'Password@123' });
  adminToken = adminLogin.body.data.token;

  const facultyLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 's.jenkins@campus.edu', password: 'Password@123' });
  _facultyToken = facultyLogin.body.data.token;

  // Get two distinct section courses
  const scRes = await dbClient.query(`
    SELECT sc.id, sc.faculty_id, sc.section_id, c.code
    FROM section_courses sc
    JOIN courses c ON sc.course_id = c.id
    ORDER BY sc.created_at ASC
    LIMIT 2
  `);
  sc1Id = scRes.rows[0].id;
  sc2Id = scRes.rows[1].id;
});

describe('Timetable System & Server-Side Conflict Detection Engine', () => {
  it('creates an initial timetable slot successfully', async () => {
    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionCourseId: sc1Id,
        dayOfWeek: 'Friday',
        startTime: '09:00',
        endTime: '10:00',
        roomNumber: 'LH-301',
        slotType: 'lecture',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.room_number || res.body.data.roomNumber).toBe('LH-301');
    createdSlotId = res.body.data.id;
  });

  it('rejects slot creation with invalid time range (startTime >= endTime)', async () => {
    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionCourseId: sc1Id,
        dayOfWeek: 'Friday',
        startTime: '11:00',
        endTime: '10:00',
        roomNumber: 'LH-302',
        slotType: 'lecture',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('detects and rejects ROOM collision on overlapping time', async () => {
    // Attempt to schedule sc2Id in same room LH-301 during 09:30-10:30 on Friday
    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionCourseId: sc2Id,
        dayOfWeek: 'Friday',
        startTime: '09:30',
        endTime: '10:30',
        roomNumber: 'LH-301',
        slotType: 'lecture',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TIMETABLE_CONFLICT');
    expect(res.body.error.message).toMatch(/LH-301 is already scheduled/i);
  });

  it('detects and rejects FACULTY or SECTION collision on overlapping time', async () => {
    // Attempt to schedule sc1Id (same faculty and section) in different room LH-202 during 09:15-10:15 on Friday
    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionCourseId: sc1Id,
        dayOfWeek: 'Friday',
        startTime: '09:15',
        endTime: '10:15',
        roomNumber: 'LH-202',
        slotType: 'lecture',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TIMETABLE_CONFLICT');
  });

  it('allows non-overlapping slot on the same day in the same room', async () => {
    // 10:00 to 11:00 is contiguous, non-overlapping with 09:00-10:00
    const res = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionCourseId: sc2Id,
        dayOfWeek: 'Friday',
        startTime: '10:00',
        endTime: '11:00',
        roomNumber: 'LH-301',
        slotType: 'lecture',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('retrieves timetable slots with day and section filtering', async () => {
    const res = await request(app)
      .get('/api/v1/timetable?dayOfWeek=Friday')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('allows deletion of a timetable slot and removes the reservation', async () => {
    const deleteRes = await request(app)
      .delete(`/api/v1/timetable/${createdSlotId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // Verify LH-301 at 09:00-10:00 is now free to be booked
    const retryRes = await request(app)
      .post('/api/v1/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionCourseId: sc2Id,
        dayOfWeek: 'Friday',
        startTime: '09:00',
        endTime: '10:00',
        roomNumber: 'LH-301',
        slotType: 'lecture',
      });

    expect(retryRes.status).toBe(201);
    expect(retryRes.body.success).toBe(true);
  });
});

