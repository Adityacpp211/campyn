import { dbClient, withTransaction } from '../db';
import { AuthUser } from '../middleware/auth';
import { assertFacultyCourseAssignment } from '../middleware/resourceAuth';
import { CreateAssignmentInput, SubmitAssignmentInput, GradeSubmissionInput } from '../validators/assignment.validator';
import { createAuditLog } from './auditService';

export class AssignmentService {
  async getAssignments(
    actor: AuthUser,
    filter?: { sectionCourseId?: string; courseId?: string }
  ) {
    let query = `
      SELECT 
        a.id,
        a.section_course_id as "sectionCourseId",
        c.code as "courseCode",
        c.name as "courseName",
        sec.name as "sectionName",
        a.title,
        a.description,
        a.max_marks::float as "maxMarks",
        a.due_date as "dueDate",
        a.allow_late as "allowLate",
        COALESCE((SELECT COUNT(*) FROM assignment_submissions sub WHERE sub.assignment_id = a.id), 0)::int as "submissionCount",
        COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.section_course_id = a.section_course_id AND e.status = 'enrolled'), 0)::int as "totalStudents"
      FROM assignments a
      JOIN section_courses sc ON a.section_course_id = sc.id
      JOIN courses c ON sc.course_id = c.id
      JOIN departments d ON c.department_id = d.id
      JOIN sections sec ON sc.section_id = sec.id
      WHERE d.institution_id = $1
    `;
    const params: any[] = [actor.institutionId];

    if (filter?.sectionCourseId) {
      params.push(filter.sectionCourseId);
      query += ` AND a.section_course_id = $${params.length}`;
    }

    if (filter?.courseId) {
      params.push(filter.courseId);
      query += ` AND sc.course_id = $${params.length}`;
    }

    // Role-based scoping
    if (actor.role === 'STUDENT') {
      params.push(actor.id);
      query += `
        AND a.section_course_id IN (
          SELECT e.section_course_id 
          FROM enrollments e
          JOIN students s ON e.student_id = s.id
          WHERE s.user_id = $${params.length} AND e.status = 'enrolled'
        )
      `;
    } else if (actor.role === 'FACULTY') {
      params.push(actor.id);
      query += `
        AND sc.faculty_id IN (
          SELECT f.id FROM faculty f WHERE f.user_id = $${params.length}
        )
      `;
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await dbClient.query(query, params);
    return result.rows;
  }

  async createAssignment(actor: AuthUser, input: CreateAssignmentInput, clientIp = '127.0.0.1') {
    // 1. Resolve course and section
    const scRes = await dbClient.query(
      `SELECT sc.id, sc.faculty_id, sc.section_id, c.code, c.name as course_name
       FROM section_courses sc
       JOIN courses c ON sc.course_id = c.id
       WHERE sc.id = $1`,
      [input.sectionCourseId]
    );

    if (scRes.rows.length === 0) {
      const err: any = new Error('Section course allocation not found');
      err.statusCode = 404;
      err.code = 'RESOURCE_NOT_FOUND';
      throw err;
    }

    const { code, section_id } = scRes.rows[0];

    // If faculty, verify they teach this section course
    if (actor.role === 'FACULTY') {
      await assertFacultyCourseAssignment(actor, code, section_id);
    }

    // 2. Insert assignment
    const insertRes = await dbClient.query(
      `INSERT INTO assignments (section_course_id, title, description, max_marks, due_date, allow_late)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, section_course_id as "sectionCourseId", title, description, max_marks::float as "maxMarks", due_date as "dueDate", allow_late as "allowLate", created_at as "createdAt"`,
      [input.sectionCourseId, input.title, input.description || null, input.maxMarks, input.dueDate, input.allowLate]
    );

    const assignment = insertRes.rows[0];

    // 3. Cryptographic Audit Trail
    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      role: actor.role,
      action: 'CREATE',
      entity: 'assignments',
      entityId: assignment.id,
      institutionId: actor.institutionId,
      newValues: {
        title: input.title,
        courseCode: code,
        maxMarks: input.maxMarks,
        dueDate: input.dueDate,
        allowLate: input.allowLate,
      },
      reason: `Created assignment '${input.title}' for course ${code}`,
      ipAddress: clientIp,
    });

    return assignment;
  }

  async getSubmissions(actor: AuthUser, assignmentId: string) {
    // Check if student
    let studentIdFilter = '';
    const params: any[] = [assignmentId];

    if (actor.role === 'STUDENT') {
      const sRes = await dbClient.query('SELECT id FROM students WHERE user_id = $1', [actor.id]);
      if (sRes.rows.length === 0) return [];
      params.push(sRes.rows[0].id);
      studentIdFilter = ` AND sub.student_id = $${params.length}`;
    }

    const query = `
      SELECT 
        sub.id,
        sub.assignment_id as "assignmentId",
        sub.student_id as "studentId",
        s.roll_number as "studentRoll",
        CONCAT(u.first_name, ' ', u.last_name) as "studentName",
        sub.submitted_at as "submittedAt",
        sub.file_url as "fileUrl",
        sub.is_late as "isLate",
        sub.marks_awarded::float as "marksAwarded",
        sub.feedback,
        CASE WHEN sub.marks_awarded IS NOT NULL THEN 'graded' ELSE 'submitted' END as status
      FROM assignment_submissions sub
      JOIN students s ON sub.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE sub.assignment_id = $1 ${studentIdFilter}
      ORDER BY s.roll_number ASC
    `;

    const result = await dbClient.query(query, params);
    return result.rows;
  }

  async submitAssignment(actor: AuthUser, assignmentId: string, input: SubmitAssignmentInput, clientIp = '127.0.0.1') {
    // 1. Resolve student ID
    const studentRes = await dbClient.query(
      `SELECT id, roll_number FROM students WHERE user_id = $1`,
      [actor.id]
    );

    if (studentRes.rows.length === 0) {
      const err: any = new Error('Student profile not associated with this account');
      err.statusCode = 403;
      err.code = 'NOT_A_STUDENT';
      throw err;
    }

    const student = studentRes.rows[0];

    // 2. Fetch assignment
    const asgRes = await dbClient.query(
      `SELECT id, section_course_id, due_date, allow_late, title FROM assignments WHERE id = $1`,
      [assignmentId]
    );

    if (asgRes.rows.length === 0) {
      const err: any = new Error('Assignment not found');
      err.statusCode = 404;
      err.code = 'RESOURCE_NOT_FOUND';
      throw err;
    }

    const asg = asgRes.rows[0];

    // 3. Verify student enrollment in this section course
    const enrollRes = await dbClient.query(
      `SELECT id FROM enrollments WHERE student_id = $1 AND section_course_id = $2 AND status = 'enrolled'`,
      [student.id, asg.section_course_id]
    );

    if (enrollRes.rows.length === 0) {
      const err: any = new Error('Student is not enrolled in the course section for this assignment');
      err.statusCode = 403;
      err.code = 'NOT_ENROLLED';
      throw err;
    }

    // 4. Check due date and calculate is_late
    const now = new Date();
    const dueDate = new Date(asg.due_date);
    const isLate = now > dueDate;

    if (isLate && !asg.allow_late) {
      const err: any = new Error('Assignment deadline has passed and late submissions are strictly disallowable');
      err.statusCode = 400;
      err.code = 'LATE_SUBMISSION_REJECTED';
      throw err;
    }

    // 5. Upsert submission
    const subRes = await dbClient.query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, file_url, is_late, submitted_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (assignment_id, student_id)
       DO UPDATE SET file_url = EXCLUDED.file_url, is_late = EXCLUDED.is_late, submitted_at = CURRENT_TIMESTAMP
       RETURNING id, assignment_id as "assignmentId", student_id as "studentId", file_url as "fileUrl", is_late as "isLate", submitted_at as "submittedAt"`,
      [assignmentId, student.id, input.fileUrl || input.notes || null, isLate]
    );

    const submission = subRes.rows[0];

    // 6. Cryptographic Audit
    await createAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      role: actor.role,
      action: 'CREATE',
      entity: 'assignment_submissions',
      entityId: submission.id,
      institutionId: actor.institutionId,
      newValues: {
        assignmentId,
        studentRoll: student.roll_number,
        isLate,
        submittedAt: submission.submittedAt,
      },
      reason: `Student ${student.roll_number} submitted deliverable for assignment '${asg.title}'${isLate ? ' [LATE]' : ''}`,
      ipAddress: clientIp,
    });

    return submission;
  }

  async gradeSubmission(actor: AuthUser, submissionId: string, input: GradeSubmissionInput, clientIp = '127.0.0.1') {
    return await withTransaction(async (tx) => {
      // 1. Fetch submission with assignment max marks
      const subRes = await tx.query(
        `SELECT 
          sub.*, 
          a.max_marks,
          a.title as assignment_title,
          s.roll_number,
          CONCAT(u.first_name, ' ', u.last_name) as student_name
        FROM assignment_submissions sub
        JOIN assignments a ON sub.assignment_id = a.id
        JOIN students s ON sub.student_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE sub.id = $1`,
        [submissionId]
      );

      if (subRes.rows.length === 0) {
        const err: any = new Error('Submission record not found');
        err.statusCode = 404;
        err.code = 'RESOURCE_NOT_FOUND';
        throw err;
      }

      const sub = subRes.rows[0];
      const maxMarks = parseFloat(sub.max_marks);

      if (input.marksAwarded > maxMarks) {
        const err: any = new Error(`Marks awarded (${input.marksAwarded}) cannot exceed maximum marks (${maxMarks})`);
        err.statusCode = 400;
        err.code = 'MAX_MARKS_EXCEEDED';
        throw err;
      }

      const oldMarks = sub.marks_awarded;

      // 2. Update record
      const updateRes = await tx.query(
        `UPDATE assignment_submissions
         SET marks_awarded = $1, feedback = $2, graded_by = $3, graded_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, marks_awarded::float as "marksAwarded", feedback, graded_at as "gradedAt"`,
        [input.marksAwarded, input.feedback || null, actor.id, submissionId]
      );

      // 3. Cryptographic Audit Trail
      await createAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        role: actor.role,
        action: 'UPDATE',
        entity: 'assignment_submissions',
        entityId: submissionId,
        institutionId: actor.institutionId,
        oldValues: { marksAwarded: oldMarks, feedback: sub.feedback },
        newValues: { marksAwarded: input.marksAwarded, feedback: input.feedback },
        reason: `Graded submission for ${sub.student_name} (${sub.roll_number}) on '${sub.assignment_title}': ${input.reason}`,
        ipAddress: clientIp,
      }, tx);

      return updateRes.rows[0];
    });
  }
}

export const assignmentService = new AssignmentService();
