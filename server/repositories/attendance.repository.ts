import { dbClient, withTransaction } from '../db';
import { RecordAttendanceInput, AttendanceCorrectionInput } from '../validators/attendance.validator';

export class AttendanceRepository {
  async getSessions(
    institutionId: string,
    options: { sectionCourseId?: string; date?: string; facultyId?: string; status?: string }
  ): Promise<any[]> {
    let sql = `
      SELECT 
        ats.id,
        ats.section_course_id as "sectionCourseId",
        ats.session_date as "sessionDate",
        ats.slot_start as "slotStart",
        ats.slot_end as "slotEnd",
        ats.is_locked as "isLocked",
        COALESCE(ats.status, CASE WHEN ats.is_locked THEN 'LOCKED' ELSE 'SUBMITTED' END) as status,
        ats.locked_at as "lockedAt",
        c.code as "courseCode",
        c.name as "courseName",
        sec.name as "sectionName",
        u.first_name || ' ' || u.last_name as "recordedByName",
        (SELECT COUNT(*)::int FROM attendance_records ar WHERE ar.session_id = ats.id) as "totalRecords",
        (SELECT COUNT(*)::int FROM attendance_records ar WHERE ar.session_id = ats.id AND ar.status = 'present') as "presentCount"
      FROM attendance_sessions ats
      JOIN section_courses sc ON ats.section_course_id = sc.id
      JOIN courses c ON sc.course_id = c.id
      JOIN sections sec ON sc.section_id = sec.id
      JOIN programs p ON sec.program_id = p.id
      JOIN departments d ON p.department_id = d.id
      JOIN users u ON ats.recorded_by = u.id
      WHERE d.institution_id = $1
    `;
    const params: any[] = [institutionId];

    if (options.sectionCourseId) {
      params.push(options.sectionCourseId);
      sql += ` AND ats.section_course_id = $${params.length}`;
    }

    if (options.date) {
      params.push(options.date);
      sql += ` AND ats.session_date = $${params.length}`;
    }

    if (options.facultyId) {
      params.push(options.facultyId);
      sql += ` AND sc.faculty_id = $${params.length}`;
    }

    if (options.status) {
      params.push(options.status);
      sql += ` AND ats.status = $${params.length}`;
    }

    sql += ` ORDER BY ats.session_date DESC, ats.slot_start DESC LIMIT 100`;

    const res = await dbClient.query(sql, params);
    return res.rows;
  }

  async getSessionRecords(sessionId: string): Promise<any[]> {
    const sql = `
      SELECT 
        ar.id,
        ar.session_id as "sessionId",
        ar.student_id as "studentId",
        ar.status,
        ar.recorded_at as "recordedAt",
        s.roll_number as "rollNumber",
        u.first_name as "firstName",
        u.last_name as "lastName"
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE ar.session_id = $1
      ORDER BY s.roll_number ASC
    `;
    const res = await dbClient.query(sql, [sessionId]);
    return res.rows;
  }

  async isRecordLocked(recordId: string): Promise<boolean> {
    const res = await dbClient.query(`
      SELECT ats.is_locked, ats.status
      FROM attendance_records ar
      JOIN attendance_sessions ats ON ar.session_id = ats.id
      WHERE ar.id = $1
    `, [recordId]);

    if (res.rows.length === 0) return false;
    return res.rows[0].is_locked || res.rows[0].status === 'LOCKED';
  }

  async lockSession(sessionId: string, userId: string): Promise<any> {
    const res = await dbClient.query(`
      UPDATE attendance_sessions
      SET is_locked = TRUE, status = 'LOCKED', locked_at = CURRENT_TIMESTAMP, locked_by = $2
      WHERE id = $1
      RETURNING id, is_locked, is_locked as "isLocked", status, locked_at, locked_at as "lockedAt", locked_by as "lockedBy"
    `, [sessionId, userId]);

    return res.rows[0] || null;
  }

  async recordSessionWithTransaction(
    userId: string,
    input: RecordAttendanceInput
  ): Promise<{ sessionId: string; recordCount: number }> {
    return await withTransaction(async (tx) => {
      // 1. Create the attendance session (defaults to SUBMITTED)
      const sessRes = await tx.query<{ id: string }>(
        `
        INSERT INTO attendance_sessions (section_course_id, session_date, slot_start, slot_end, recorded_by, status)
        VALUES ($1, $2, $3, $4, $5, 'SUBMITTED')
        RETURNING id
      `,
        [input.sectionCourseId, input.sessionDate, input.slotStart, input.slotEnd, userId]
      );
      const sessionId = sessRes.rows[0].id;

      // 2. Insert attendance records
      for (const rec of input.records) {
        await tx.query(
          `
          INSERT INTO attendance_records (session_id, student_id, status)
          VALUES ($1, $2, $3)
          ON CONFLICT (session_id, student_id)
          DO UPDATE SET status = EXCLUDED.status, recorded_at = CURRENT_TIMESTAMP
        `,
          [sessionId, rec.studentId, rec.status]
        );
      }

      return { sessionId, recordCount: input.records.length };
    });
  }

  async createCorrectionRequest(
    userId: string,
    institutionId: string,
    input: AttendanceCorrectionInput
  ): Promise<any> {
    return await withTransaction(async (tx) => {
      const recRes = await tx.query(
        `SELECT id, status FROM attendance_records WHERE id = $1`,
        [input.attendanceRecordId]
      );
      if (recRes.rows.length === 0) {
        throw new Error('Attendance record not found');
      }
      const prevStatus = recRes.rows[0].status;

      const corrRes = await tx.query(
        `
        INSERT INTO attendance_corrections (attendance_record_id, requested_by, previous_status, new_status, reason, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING id
      `,
        [input.attendanceRecordId, userId, prevStatus, input.newStatus, input.reason]
      );
      const correctionId = corrRes.rows[0].id;

      // Link approval request
      await tx.query(
        `
        INSERT INTO approval_requests (institution_id, requester_id, entity, entity_id, request_type, reason, status)
        VALUES ($1, $2, 'attendance_corrections', $3, 'ATTENDANCE_CORRECTION', $4, 'pending')
      `,
        [institutionId, userId, correctionId, input.reason]
      );

      return {
        correctionId,
        previousStatus: prevStatus,
        newStatus: input.newStatus,
        status: 'pending',
        requestType: 'ATTENDANCE_CORRECTION',
      };
    });
  }

  // --- STATISTICAL CALCULATIONS ---
  async getStudentAttendanceStats(studentId: string): Promise<any> {
    // Overall stats
    const overallRes = await dbClient.query(`
      SELECT 
        COUNT(ar.id)::int as "totalClasses",
        COUNT(CASE WHEN ar.status = 'present' THEN 1 END)::int as "presentCount",
        COUNT(CASE WHEN ar.status = 'absent' THEN 1 END)::int as "absentCount",
        COUNT(CASE WHEN ar.status = 'late' THEN 1 END)::int as "lateCount",
        COUNT(CASE WHEN ar.status = 'excused' THEN 1 END)::int as "excusedCount",
        COALESCE(
          ROUND((COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::numeric / NULLIF(COUNT(ar.id), 0)) * 100, 1),
          100.0
        )::numeric as "percentage"
      FROM attendance_records ar
      WHERE ar.student_id = $1
    `, [studentId]);

    const overall = overallRes.rows[0];
    const isShortage = Number(overall.percentage) < 75.0;

    // Course breakdown
    const courseRes = await dbClient.query(`
      SELECT 
        c.id as "courseId",
        c.code as "courseCode",
        c.name as "courseName",
        COUNT(ar.id)::int as "totalClasses",
        COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::int as "attendedClasses",
        COALESCE(
          ROUND((COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::numeric / NULLIF(COUNT(ar.id), 0)) * 100, 1),
          100.0
        )::numeric as "percentage"
      FROM attendance_records ar
      JOIN attendance_sessions sess ON ar.session_id = sess.id
      JOIN section_courses sc ON sess.section_course_id = sc.id
      JOIN courses c ON sc.course_id = c.id
      WHERE ar.student_id = $1
      GROUP BY c.id, c.code, c.name
      ORDER BY c.code ASC
    `, [studentId]);

    const courseBreakdown = courseRes.rows.map((c: any) => ({
      ...c,
      isShortage: Number(c.percentage) < 75.0,
    }));

    return {
      overallPercentage: overall.percentage,
      totalClasses: overall.totalClasses,
      isShortage,
      courseBreakdown,
      overall: {
        ...overall,
        isShortage,
      },
      courses: courseBreakdown,
    };
  }

  async getDepartmentAttendanceStats(departmentIdOrCode: string): Promise<any> {
    // Resolve department UUID
    let deptId = departmentIdOrCode;
    const deptRes = await dbClient.query(`
      SELECT id FROM departments WHERE id::text = $1 OR code = $1 LIMIT 1
    `, [departmentIdOrCode]);
    if (deptRes.rows.length > 0) {
      deptId = deptRes.rows[0].id;
    }

    // Total students in department
    const totalStudentsRes = await dbClient.query(`
      SELECT COUNT(s.id)::int as "total"
      FROM students s
      JOIN programs p ON s.program_id = p.id
      WHERE p.department_id = $1
    `, [deptId]);
    const totalStudentsEnrolled = totalStudentsRes.rows[0]?.total || 0;

    // Department average attendance
    const avgRes = await dbClient.query(`
      SELECT 
        COALESCE(
          ROUND((COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::numeric / NULLIF(COUNT(ar.id), 0)) * 100, 1),
          100.0
        )::numeric as "average"
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      JOIN programs p ON s.program_id = p.id
      WHERE p.department_id = $1
    `, [deptId]);
    const averageAttendancePercentage = avgRes.rows[0]?.average || 100.0;

    // Shortage students in department (< 75%)
    const shortageRes = await dbClient.query(`
      SELECT 
        s.id,
        s.roll_number as "rollNumber",
        CONCAT(u.first_name, ' ', u.last_name) as "studentName",
        sec.name as "sectionName",
        COUNT(ar.id)::int as "totalClasses",
        ROUND((COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::numeric / NULLIF(COUNT(ar.id), 0)) * 100, 1)::numeric as "percentage"
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN programs p ON s.program_id = p.id
      JOIN sections sec ON s.current_section_id = sec.id
      JOIN attendance_records ar ON s.id = ar.student_id
      WHERE p.department_id = $1
      GROUP BY s.id, s.roll_number, u.first_name, u.last_name, sec.name
      HAVING ROUND((COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::numeric / NULLIF(COUNT(ar.id), 0)) * 100, 1) < 75.0
      ORDER BY "percentage" ASC
    `, [deptId]);

    // Course attendance averages
    const courseStatsRes = await dbClient.query(`
      SELECT 
        c.code as "courseCode",
        c.name as "courseName",
        COUNT(DISTINCT sess.id)::int as "sessionsHeld",
        ROUND(
          (COUNT(CASE WHEN ar.status IN ('present', 'late') THEN 1 END)::numeric / NULLIF(COUNT(ar.id), 0)) * 100, 1
        )::numeric as "averageAttendance"
      FROM courses c
      JOIN section_courses sc ON c.id = sc.course_id
      JOIN attendance_sessions sess ON sc.id = sess.section_course_id
      JOIN attendance_records ar ON sess.id = ar.session_id
      WHERE c.department_id = $1
      GROUP BY c.id, c.code, c.name
      ORDER BY c.code ASC
    `, [deptId]);

    return {
      totalStudentsEnrolled,
      averageAttendancePercentage,
      shortageStudentsCount: shortageRes.rows.length,
      shortageStudents: shortageRes.rows,
      courseStats: courseStatsRes.rows,
    };
  }
}

export const attendanceRepository = new AttendanceRepository();
