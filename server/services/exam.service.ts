import { dbClient, withTransaction } from '../db';
import { AuthUser } from '../middleware/auth';
import { CreateExamInput, UpdateMarksInput, PopulateRosterInput } from '../validators/exam.validator';
import { createAuditLog } from './auditService';

export class ExamService {
  async getExams(actor: AuthUser) {
    const query = `
      SELECT 
        e.id,
        e.title,
        e.exam_type as "examType",
        sem.id as "semesterId",
        sem.semester_number as semester,
        e.is_locked as "isLocked",
        e.is_published as "isPublished",
        e.created_at as "createdAt"
      FROM examinations e
      JOIN semesters sem ON e.semester_id = sem.id
      JOIN academic_years ay ON sem.academic_year_id = ay.id
      WHERE ay.institution_id = $1
      ORDER BY e.created_at DESC
    `;

    const result = await dbClient.query(query, [actor.institutionId]);
    return result.rows;
  }

  async createExam(actor: AuthUser, input: CreateExamInput, clientIp = '127.0.0.1') {
    // 1. Verify semester belongs to institution
    const semRes = await dbClient.query(
      `SELECT sem.id, sem.semester_number 
       FROM semesters sem
       JOIN academic_years ay ON sem.academic_year_id = ay.id
       WHERE sem.id = $1 AND ay.institution_id = $2`,
      [input.semesterId, actor.institutionId]
    );

    if (semRes.rows.length === 0) {
      const err: any = new Error('Target semester not found in this institution');
      err.statusCode = 404;
      err.code = 'RESOURCE_NOT_FOUND';
      throw err;
    }

    // 2. Insert examination
    const examRes = await dbClient.query(
      `INSERT INTO examinations (semester_id, title, exam_type, is_locked, is_published)
       VALUES ($1, $2, $3, false, false)
       RETURNING id, semester_id as "semesterId", title, exam_type as "examType", is_locked as "isLocked", is_published as "isPublished", created_at as "createdAt"`,
      [input.semesterId, input.title, input.examType]
    );

    const exam = examRes.rows[0];

    // 3. Cryptographic Audit
    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      role: actor.role,
      action: 'CREATE',
      entity: 'examinations',
      entityId: exam.id,
      institutionId: actor.institutionId,
      newValues: {
        title: input.title,
        examType: input.examType,
        semesterId: input.semesterId,
      },
      reason: `Created examination register '${input.title}' (${input.examType})`,
      ipAddress: clientIp,
    });

    return exam;
  }

  async getMarks(actor: AuthUser, examId: string) {
    let studentFilter = '';
    const params: any[] = [examId];

    if (actor.role === 'STUDENT') {
      const sRes = await dbClient.query('SELECT id FROM students WHERE user_id = $1', [actor.id]);
      if (sRes.rows.length === 0) return [];
      params.push(sRes.rows[0].id);
      studentFilter = ` AND me.student_id = $${params.length}`;
    }

    const query = `
      SELECT 
        me.id,
        me.examination_id as "examId",
        me.course_id as "courseId",
        c.code as "courseCode",
        c.name as "courseName",
        s.id as "studentId",
        s.roll_number as "studentRoll",
        CONCAT(u.first_name, ' ', u.last_name) as "studentName",
        me.marks_obtained::float as "marksObtained",
        me.max_marks::float as "maxMarks",
        me.grade,
        (me.verified_by IS NOT NULL) as verified,
        me.entered_at as "enteredAt"
      FROM marks_entries me
      JOIN courses c ON me.course_id = c.id
      JOIN students s ON me.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE me.examination_id = $1 ${studentFilter}
      ORDER BY s.roll_number ASC
    `;

    const result = await dbClient.query(query, params);
    return result.rows;
  }

  async populateRoster(actor: AuthUser, examId: string, input: PopulateRosterInput, clientIp = '127.0.0.1') {
    return await withTransaction(async (tx) => {
      // 1. Verify exam exists and is not locked
      const examRes = await tx.query(`SELECT id, title, is_locked FROM examinations WHERE id = $1`, [examId]);
      if (examRes.rows.length === 0) {
        const err: any = new Error('Examination record not found');
        err.statusCode = 404;
        throw err;
      }
      if (examRes.rows[0].is_locked) {
        const err: any = new Error('Cannot populate roster on a locked examination');
        err.statusCode = 400;
        throw err;
      }

      // 2. Find all students enrolled in this course
      const enrollRes = await tx.query(
        `SELECT DISTINCT e.student_id
         FROM enrollments e
         JOIN section_courses sc ON e.section_course_id = sc.id
         WHERE sc.course_id = $1 AND e.status = 'enrolled'`,
        [input.courseId]
      );

      let createdCount = 0;
      for (const row of enrollRes.rows) {
        const ins = await tx.query(
          `INSERT INTO marks_entries (examination_id, course_id, student_id, marks_obtained, max_marks, grade, entered_by)
           VALUES ($1, $2, $3, 0, $4, 'P', $5)
           ON CONFLICT (examination_id, course_id, student_id) DO NOTHING
           RETURNING id`,
          [examId, input.courseId, row.student_id, input.maxMarks, actor.id]
        );
        if (ins.rows.length > 0) createdCount++;
      }

      // 3. Cryptographic Audit
      await createAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        role: actor.role,
        action: 'CREATE',
        entity: 'marks_entries',
        entityId: examId,
        institutionId: actor.institutionId,
        newValues: { examId, courseId: input.courseId, rosterCount: createdCount },
        reason: `Auto-populated examination roster for ${createdCount} enrolled students`,
        ipAddress: clientIp,
      }, tx);

      return { examId, courseId: input.courseId, populatedCount: createdCount };
    });
  }

  async updateMarks(actor: AuthUser, marksId: string, input: UpdateMarksInput, clientIp = '127.0.0.1') {
    return await withTransaction(async (tx) => {
      // 1. Fetch current entry
      const curRes = await tx.query(
        `SELECT me.*, e.is_locked, s.roll_number, CONCAT(u.first_name, ' ', u.last_name) as student_name
         FROM marks_entries me
         JOIN examinations e ON me.examination_id = e.id
         JOIN students s ON me.student_id = s.id
         JOIN users u ON s.user_id = u.id
         WHERE me.id = $1`,
        [marksId]
      );

      if (curRes.rows.length === 0) {
        const err: any = new Error('Marks record not found');
        err.statusCode = 404;
        throw err;
      }

      const cur = curRes.rows[0];

      if (cur.is_locked) {
        const err: any = new Error('Examination results are locked. Changes require an administrative waiver.');
        err.statusCode = 403;
        throw err;
      }

      const maxMarks = parseFloat(cur.max_marks);
      if (input.marksObtained > maxMarks) {
        const err: any = new Error(`Marks obtained (${input.marksObtained}) cannot exceed maximum marks (${maxMarks})`);
        err.statusCode = 400;
        throw err;
      }

      const oldMarks = parseFloat(cur.marks_obtained);
      const grade = input.grade || this.computeGrade(input.marksObtained, maxMarks);

      // 2. Update record
      await tx.query(
        `UPDATE marks_entries
         SET marks_obtained = $1, grade = $2, verified_by = $3, entered_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [input.marksObtained, grade, actor.id, marksId]
      );

      // 3. Cryptographic Audit Trail
      await createAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        role: actor.role,
        action: 'MARKS_CHANGE',
        entity: 'marks_entries',
        entityId: marksId,
        institutionId: actor.institutionId,
        oldValues: { marksObtained: oldMarks, grade: cur.grade },
        newValues: { marksObtained: input.marksObtained, grade },
        reason: `Marks revised for ${cur.student_name} (${cur.roll_number}): ${input.reason}`,
        ipAddress: clientIp,
      }, tx);

      return { id: marksId, marksObtained: input.marksObtained, grade };
    });
  }

  async toggleLock(actor: AuthUser, examId: string, clientIp = '127.0.0.1') {
    return await withTransaction(async (tx) => {
      const examRes = await tx.query(`SELECT * FROM examinations WHERE id = $1`, [examId]);
      if (examRes.rows.length === 0) {
        const err: any = new Error('Examination record not found');
        err.statusCode = 404;
        throw err;
      }

      const exam = examRes.rows[0];
      const newLocked = !exam.is_locked;
      const newPublished = newLocked;

      await tx.query(
        `UPDATE examinations
         SET is_locked = $1, is_published = $2
         WHERE id = $3`,
        [newLocked, newPublished, examId]
      );

      await createAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        role: actor.role,
        action: newLocked ? 'APPROVE' : 'UPDATE',
        entity: 'examinations',
        entityId: examId,
        institutionId: actor.institutionId,
        oldValues: { isLocked: exam.is_locked, isPublished: exam.is_published },
        newValues: { isLocked: newLocked, isPublished: newPublished },
        reason: `Examination results ${newLocked ? 'LOCKED & PUBLISHED' : 'UNLOCKED'} by ${actor.email}`,
        ipAddress: clientIp,
      }, tx);

      return { id: examId, isLocked: newLocked, isPublished: newPublished };
    });
  }

  private computeGrade(obtained: number, max: number): string {
    const pct = (obtained / max) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }
}

export const examService = new ExamService();
