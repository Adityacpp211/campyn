import { dbClient, withTransaction } from '../db';
import { FacultyCreateInput, FacultyUpdateInput, FacultyQueryInput, FacultyAssignInput } from '../validators/faculty.validator';
import bcrypt from 'bcryptjs';

export class FacultyRepository {
  async findFaculty(
    institutionId: string,
    query: FacultyQueryInput
  ): Promise<{ data: any[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    let baseSql = `
      FROM faculty f
      JOIN users u ON f.user_id = u.id
      JOIN departments d ON f.department_id = d.id
      WHERE u.institution_id = $1 AND f.deleted_at IS NULL
    `;
    const params: any[] = [institutionId];

    if (query.departmentId && query.departmentId !== 'all') {
      params.push(query.departmentId);
      baseSql += ` AND (f.department_id::text = $${params.length} OR d.code = $${params.length})`;
    }

    if (query.search && query.search.trim()) {
      params.push(`%${query.search.trim()}%`);
      baseSql += ` AND (u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR f.employee_id ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    const countRes = await dbClient.query(`SELECT COUNT(f.id)::int as total ${baseSql}`, params);
    const total = countRes.rows[0]?.total || 0;

    const selectSql = `
      SELECT 
        f.id,
        f.user_id as "userId",
        f.department_id as "departmentId",
        f.employee_id as "employeeId",
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email,
        u.phone,
        f.designation,
        f.qualification,
        f.specialization,
        f.joining_date as "joiningDate",
        f.status,
        d.name as "departmentName",
        d.code as "departmentCode",
        COALESCE((
          SELECT COUNT(DISTINCT sc.course_id)
          FROM section_courses sc
          WHERE sc.faculty_id = f.id
        ), 0)::int as "coursesCount",
        COALESCE((
          SELECT COUNT(sc.id)
          FROM section_courses sc
          WHERE sc.faculty_id = f.id
        ), 0)::int as "sectionsCount",
        COALESCE((
          SELECT SUM(c.credits)
          FROM section_courses sc
          JOIN courses c ON sc.course_id = c.id
          WHERE sc.faculty_id = f.id
        ), 0)::int as "workloadCredits"
      ${baseSql}
      ORDER BY f.employee_id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const fetchParams = [...params, limit, offset];
    const dataRes = await dbClient.query(selectSql, fetchParams);

    return {
      data: dataRes.rows,
      total,
    };
  }

  async findFacultyById(id: string, institutionId: string): Promise<any | null> {
    const res = await dbClient.query(`
      SELECT 
        f.id,
        f.user_id as "userId",
        f.department_id as "departmentId",
        f.employee_id as "employeeId",
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.first_name as "firstName",
        u.last_name as "lastName",
        u.email,
        u.phone,
        f.designation,
        f.qualification,
        f.specialization,
        f.joining_date as "joiningDate",
        f.status,
        d.name as "departmentName",
        d.code as "departmentCode"
      FROM faculty f
      JOIN users u ON f.user_id = u.id
      JOIN departments d ON f.department_id = d.id
      WHERE (f.id = $1 OR f.employee_id = $1) AND u.institution_id = $2 AND f.deleted_at IS NULL
      LIMIT 1
    `, [id, institutionId]);

    if (res.rows.length === 0) return null;
    const faculty = res.rows[0];

    // Assigned courses & sections
    const assignmentsRes = await dbClient.query(`
      SELECT 
        sc.id as "sectionCourseId",
        sc.section_id as "sectionId",
        sec.name as "sectionName",
        c.id as "courseId",
        c.code as "courseCode",
        c.name as "courseName",
        c.credits,
        c.course_type as "courseType",
        COALESCE((
          SELECT json_agg(json_build_object(
            'day', tt.day_of_week,
            'start', tt.start_time,
            'end', tt.end_time,
            'room', tt.room_number
          ))
          FROM timetable_slots tt
          WHERE tt.section_course_id = sc.id
        ), '[]'::json) as schedule
      FROM section_courses sc
      JOIN sections sec ON sc.section_id = sec.id
      JOIN courses c ON sc.course_id = c.id
      WHERE sc.faculty_id = $1
      ORDER BY c.code ASC
    `, [faculty.id]);

    faculty.assignedCourses = assignmentsRes.rows;
    faculty.totalWorkloadCredits = assignmentsRes.rows.reduce((sum: number, a: any) => sum + (a.credits || 0), 0);

    return faculty;
  }

  async createFaculty(institutionId: string, input: FacultyCreateInput): Promise<any> {
    return withTransaction(async (tx) => {
      const defaultPassword = await bcrypt.hash('Password@123', 10);
      
      const userRes = await tx.query(`
        INSERT INTO users (institution_id, email, username, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [institutionId, input.email.toLowerCase().trim(), input.username.trim(), defaultPassword, input.firstName.trim(), input.lastName.trim()]);
      const userId = userRes.rows[0].id;

      // Assign FACULTY role
      const roleRes = await tx.query(`
        SELECT id FROM roles WHERE institution_id = $1 AND code = 'FACULTY' LIMIT 1
      `, [institutionId]);
      if (roleRes.rows.length > 0) {
        await tx.query(`
          INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
        `, [userId, roleRes.rows[0].id]);
      }

      // Insert faculty record
      const facRes = await tx.query(`
        INSERT INTO faculty (
          user_id, institution_id, employee_id, department_id, designation, qualification, specialization, joining_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8
        ) RETURNING *
      `, [
        userId,
        institutionId,
        input.employeeId.trim().toUpperCase(),
        input.departmentId,
        input.designation.trim(),
        input.qualification.trim(),
        input.specialization || null,
        input.joiningDate,
      ]);

      return facRes.rows[0];
    });
  }

  async updateFaculty(id: string, institutionId: string, input: FacultyUpdateInput): Promise<any> {
    return withTransaction(async (tx) => {
      const facRes = await tx.query(`
        SELECT f.id, f.user_id FROM faculty f
        WHERE (f.id = $1 OR f.employee_id = $1) AND f.institution_id = $2
      `, [id, institutionId]);

      if (facRes.rows.length === 0) return null;
      const fac = facRes.rows[0];

      if (input.firstName || input.lastName) {
        const uFields: string[] = [];
        const uVals: any[] = [];
        let uIdx = 1;
        if (input.firstName) {
          uFields.push(`first_name = $${uIdx++}`);
          uVals.push(input.firstName.trim());
        }
        if (input.lastName) {
          uFields.push(`last_name = $${uIdx++}`);
          uVals.push(input.lastName.trim());
        }
        uVals.push(fac.user_id);
        await tx.query(`UPDATE users SET ${uFields.join(', ')} WHERE id = $${uIdx}`, uVals);
      }

      const fFields: string[] = [];
      const fVals: any[] = [];
      let fIdx = 1;

      if (input.departmentId) {
        fFields.push(`department_id = $${fIdx++}`);
        fVals.push(input.departmentId);
      }
      if (input.designation) {
        fFields.push(`designation = $${fIdx++}`);
        fVals.push(input.designation.trim());
      }
      if (input.qualification) {
        fFields.push(`qualification = $${fIdx++}`);
        fVals.push(input.qualification.trim());
      }
      if (input.specialization !== undefined) {
        fFields.push(`specialization = $${fIdx++}`);
        fVals.push(input.specialization);
      }
      if (input.status) {
        fFields.push(`status = $${fIdx++}`);
        fVals.push(input.status);
      }

      if (fFields.length > 0) {
        fVals.push(fac.id);
        await tx.query(`UPDATE faculty SET ${fFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${fIdx}`, fVals);
      }

      return this.findFacultyById(fac.id, institutionId);
    });
  }

  async assignFaculty(input: FacultyAssignInput): Promise<any> {
    const res = await dbClient.query(`
      INSERT INTO section_courses (section_id, course_id, faculty_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (section_id, course_id)
      DO UPDATE SET faculty_id = EXCLUDED.faculty_id
      RETURNING *
    `, [input.sectionId, input.courseId, input.facultyId]);

    return res.rows[0];
  }

  async unassignFaculty(sectionCourseId: string): Promise<boolean> {
    const res = await dbClient.query(`
      DELETE FROM section_courses
      WHERE id = $1
      RETURNING id
    `, [sectionCourseId]);

    return res.rows.length > 0;
  }
}

export const facultyRepository = new FacultyRepository();
