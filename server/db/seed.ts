import bcrypt from 'bcryptjs';
import { dbClient, withTransaction } from './index';
import { runMigrations } from './migrate';
import { createAuditLog } from '../services/auditService';
import { config } from '../config';

export async function seedDatabase(): Promise<void> {
  console.log('[Seed] Initializing database schema...');
  await runMigrations();

  if (config.isProduction) {
    const customPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!customPassword || customPassword === 'Password@123') {
      throw new Error(
        '[FATAL SEED] Production seed cannot use predictable development password. Set INITIAL_ADMIN_PASSWORD with a secure string before running seed in production.'
      );
    }
  }

  console.log('[Seed] Seeding relational records...');
  // [DEVELOPMENT ONLY] 'Password@123' is strictly restricted to development environments.
  const rawPassword = config.isProduction ? process.env.INITIAL_ADMIN_PASSWORD! : 'Password@123';
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  await withTransaction(async (tx) => {
    // 1. Clean existing records if any
    await tx.query('DELETE FROM audit_logs');
    await tx.query('DELETE FROM approval_requests');
    await tx.query('DELETE FROM timetable_slots');
    await tx.query('DELETE FROM section_transfers');
    await tx.query('DELETE FROM fee_transactions');
    await tx.query('DELETE FROM student_fee_dues');
    await tx.query('DELETE FROM fee_structures');
    await tx.query('DELETE FROM marks_entries');
    await tx.query('DELETE FROM examinations');
    await tx.query('DELETE FROM assignment_submissions');
    await tx.query('DELETE FROM assignments');
    await tx.query('DELETE FROM attendance_corrections');
    await tx.query('DELETE FROM attendance_records');
    await tx.query('DELETE FROM attendance_sessions');
    await tx.query('DELETE FROM enrollments');
    await tx.query('DELETE FROM section_courses');
    await tx.query('DELETE FROM courses');
    await tx.query('DELETE FROM students');
    await tx.query('DELETE FROM faculty');
    await tx.query('DELETE FROM sections');
    await tx.query('DELETE FROM semesters');
    await tx.query('DELETE FROM academic_years');
    await tx.query('DELETE FROM programs');
    await tx.query('DELETE FROM departments');
    await tx.query('DELETE FROM user_roles');
    await tx.query('DELETE FROM role_permissions');
    await tx.query('DELETE FROM permissions');
    await tx.query('DELETE FROM roles');
    await tx.query('DELETE FROM users');
    await tx.query('DELETE FROM campuses');
    await tx.query('DELETE FROM institutions');

    // 2. Institution & Campus
    const instRes = await tx.query(`
      INSERT INTO institutions (code, name, domain)
      VALUES ('INST-001', 'Apex Institute of Technology', 'campus.edu')
      RETURNING id
    `);
    const instId = instRes.rows[0].id;

    const campRes = await tx.query(`
      INSERT INTO campuses (institution_id, code, name, address)
      VALUES ($1, 'CAMP-01', 'North Academic Campus', '100 University Parkway, Tech City')
      RETURNING id
    `, [instId]);
    const _campId = campRes.rows[0].id;

    // 3. Departments
    const deptCseRes = await tx.query(`
      INSERT INTO departments (institution_id, code, name)
      VALUES ($1, 'CSE', 'Computer Science & Engineering')
      RETURNING id
    `, [instId]);
    const deptCseId = deptCseRes.rows[0].id;

    const deptEceRes = await tx.query(`
      INSERT INTO departments (institution_id, code, name)
      VALUES ($1, 'ECE', 'Electronics & Communication')
      RETURNING id
    `, [instId]);
    const deptEceId = deptEceRes.rows[0].id;

    const deptMeRes = await tx.query(`
      INSERT INTO departments (institution_id, code, name)
      VALUES ($1, 'ME', 'Mechanical Engineering')
      RETURNING id
    `, [instId]);
    const _deptMeId = deptMeRes.rows[0].id;

    const deptItRes = await tx.query(`
      INSERT INTO departments (institution_id, code, name)
      VALUES ($1, 'IT', 'Information Technology')
      RETURNING id
    `, [instId]);
    const _deptItId = deptItRes.rows[0].id;

    // 4. Programs, Academic Years, Semesters, Sections
    const progRes = await tx.query(`
      INSERT INTO programs (department_id, code, name, degree_type, duration_semesters, total_credits)
      VALUES ($1, 'BTECH-CSE', 'B.Tech Computer Science', 'Bachelor of Technology', 8, 160)
      RETURNING id
    `, [deptCseId]);
    const progId = progRes.rows[0].id;

    const ayRes = await tx.query(`
      INSERT INTO academic_years (institution_id, name, start_date, end_date, is_current)
      VALUES ($1, '2026-2027', '2026-08-01', '2027-05-31', true)
      RETURNING id
    `, [instId]);
    const ayId = ayRes.rows[0].id;

    const semRes = await tx.query(`
      INSERT INTO semesters (academic_year_id, term, semester_number, start_date, end_date, is_current)
      VALUES ($1, 'Fall 2026', 5, '2026-08-15', '2026-12-20', true)
      RETURNING id
    `, [ayId]);
    const semId = semRes.rows[0].id;

    const secRes = await tx.query(`
      INSERT INTO sections (program_id, semester_id, name, capacity)
      VALUES ($1, $2, 'Section A', 60)
      RETURNING id
    `, [progId, semId]);
    const secId = secRes.rows[0].id;

    // 5. Roles & Permissions
    const PERMISSIONS_LIST = [
      { code: 'students.read', module: 'students', desc: 'Read student profiles' },
      { code: 'students.create', module: 'students', desc: 'Create students' },
      { code: 'students.update', module: 'students', desc: 'Update student profiles' },
      { code: 'students.delete', module: 'students', desc: 'Delete students' },
      { code: 'faculty.read', module: 'faculty', desc: 'Read faculty roster' },
      { code: 'faculty.manage', module: 'faculty', desc: 'Manage faculty' },
      { code: 'departments.manage', module: 'academics', desc: 'Manage departments' },
      { code: 'courses.manage', module: 'academics', desc: 'Manage courses' },
      { code: 'attendance.read', module: 'attendance', desc: 'Read attendance' },
      { code: 'attendance.record', module: 'attendance', desc: 'Record attendance' },
      { code: 'attendance.correct', module: 'attendance', desc: 'Request attendance correction' },
      { code: 'attendance.approve', module: 'attendance', desc: 'Approve attendance changes' },
      { code: 'timetable.read', module: 'timetable', desc: 'Read timetable' },
      { code: 'timetable.edit', module: 'timetable', desc: 'Edit timetable' },
      { code: 'assignments.read', module: 'assignments', desc: 'Read assignments' },
      { code: 'assignments.create', module: 'assignments', desc: 'Create assignments' },
      { code: 'assignments.grade', module: 'assignments', desc: 'Grade submissions' },
      { code: 'assignments.submit', module: 'assignments', desc: 'Submit assignments' },
      { code: 'marks.read', module: 'marks', desc: 'Read exam marks' },
      { code: 'marks.enter', module: 'marks', desc: 'Enter exam marks' },
      { code: 'marks.verify', module: 'marks', desc: 'Verify marks' },
      { code: 'marks.lock_publish', module: 'marks', desc: 'Lock & publish marks' },
      { code: 'fees.read', module: 'fees', desc: 'Read fee ledgers' },
      { code: 'fees.collect', module: 'fees', desc: 'Collect fee payments' },
      { code: 'fees.refund', module: 'fees', desc: 'Refund fee transactions' },
      { code: 'approvals.manage', module: 'approvals', desc: 'Manage governance approvals' },
      { code: 'audit.read', module: 'audit', desc: 'Inspect audit trail' },
    ];

    const permMap: Record<string, string> = {};
    for (const p of PERMISSIONS_LIST) {
      const pRes = await tx.query(`
        INSERT INTO permissions (code, module, description)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [p.code, p.module, p.desc]);
      permMap[p.code] = pRes.rows[0].id;
    }

    const ROLES = [
      'SUPER_ADMIN', 'COLLEGE_ADMIN', 'PRINCIPAL', 'HOD', 'FACULTY',
      'STUDENT', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'EXAM_CELL',
      'PLACEMENT_OFFICER', 'HOSTEL_ADMIN', 'TRANSPORT_ADMIN', 'AUDITOR'
    ];

    const roleMap: Record<string, string> = {};
    for (const r of ROLES) {
      const rRes = await tx.query(`
        INSERT INTO roles (institution_id, name, code, is_system)
        VALUES ($1, $2, $3, true)
        RETURNING id
      `, [instId, r.replace('_', ' '), r]);
      roleMap[r] = rRes.rows[0].id;
    }

    // Role permissions mapping
    const ROLE_PERMS: Record<string, string[]> = {
      SUPER_ADMIN: Object.keys(permMap),
      COLLEGE_ADMIN: [
        'students.read', 'students.create', 'students.update', 'faculty.read', 'faculty.manage',
        'departments.manage', 'courses.manage', 'attendance.read', 'attendance.approve',
        'timetable.read', 'timetable.edit', 'assignments.read', 'assignments.create', 'assignments.grade',
        'marks.read', 'marks.enter', 'marks.verify', 'marks.lock_publish',
        'fees.read', 'fees.collect', 'fees.refund', 'approvals.manage', 'audit.read'
      ],
      PRINCIPAL: [
        'students.read', 'faculty.read', 'attendance.read', 'attendance.approve',
        'timetable.read', 'assignments.read', 'marks.read', 'marks.verify',
        'fees.read', 'approvals.manage', 'audit.read'
      ],
      HOD: [
        'students.read', 'faculty.read', 'courses.manage', 'attendance.read', 'attendance.approve',
        'timetable.read', 'timetable.edit', 'assignments.read', 'marks.read', 'marks.verify', 'approvals.manage'
      ],
      FACULTY: [
        'students.read', 'attendance.read', 'attendance.record', 'attendance.correct',
        'timetable.read', 'assignments.read', 'assignments.create', 'assignments.grade',
        'marks.read', 'marks.enter'
      ],
      STUDENT: [
        'attendance.read', 'timetable.read', 'assignments.read', 'assignments.submit',
        'marks.read', 'fees.read'
      ],
      PARENT: ['attendance.read', 'marks.read', 'fees.read'],
      ACCOUNTANT: ['students.read', 'fees.read', 'fees.collect', 'fees.refund', 'approvals.manage'],
      EXAM_CELL: ['students.read', 'marks.read', 'marks.verify', 'marks.lock_publish'],
      AUDITOR: ['students.read', 'faculty.read', 'attendance.read', 'marks.read', 'fees.read', 'audit.read']
    };

    for (const [roleCode, perms] of Object.entries(ROLE_PERMS)) {
      const rId = roleMap[roleCode];
      for (const pCode of perms) {
        if (permMap[pCode]) {
          await tx.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
          `, [rId, permMap[pCode]]);
        }
      }
    }

    // 6. Users
    async function createUser(
      email: string,
      username: string,
      first: string,
      last: string,
      role: string
    ): Promise<string> {
      const uRes = await tx.query(`
        INSERT INTO users (institution_id, email, username, password_hash, first_name, last_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id
      `, [instId, email, username, passwordHash, first, last]);
      const userId = uRes.rows[0].id;
      await tx.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
      `, [userId, roleMap[role]]);
      return userId;
    }

    const _adminUserId = await createUser('admin.vance@campus.edu', 'avance', 'Adrian', 'Vance', 'COLLEGE_ADMIN');
    const facultyJenkinsId = await createUser('s.jenkins@campus.edu', 'sjenkins', 'Sarah', 'Jenkins', 'FACULTY');
    const facultyMillerId = await createUser('d.miller@campus.edu', 'dmiller', 'David', 'Miller', 'FACULTY');
    const facultyRoyId = await createUser('a.roy@campus.edu', 'aroy', 'Anita', 'Roy', 'FACULTY');
    const accountantId = await createUser('bursar.cole@campus.edu', 'jcole', 'Julian', 'Cole', 'ACCOUNTANT');
    const studentMayaId = await createUser('m.chen@campus.edu', 'mchen', 'Maya', 'Chen', 'STUDENT');
    const studentLiamId = await createUser('l.patel@campus.edu', 'lpatel', 'Liam', 'Patel', 'STUDENT');
    const studentSophiaId = await createUser('s.rodriguez@campus.edu', 'srodriguez', 'Sophia', 'Rodriguez', 'STUDENT');
    const studentMarcusId = await createUser('m.vance@campus.edu', 'mvance', 'Marcus', 'Vance Jr.', 'STUDENT');
    const studentAidenId = await createUser('a.kim@campus.edu', 'akim', 'Aiden', 'Kim', 'STUDENT');
    const studentEmmaId = await createUser('e.watson@campus.edu', 'ewatson', 'Emma', 'Watson', 'STUDENT');
    const _auditorId = await createUser('auditor.stone@campus.edu', 'astone', 'Rachel', 'Stone', 'AUDITOR');
    const _principalId = await createUser('principal.sharma@campus.edu', 'rsharma', 'Dr. Ramesh', 'Sharma', 'PRINCIPAL');

    // 7. Faculty Details
    const fac1Res = await tx.query(`
      INSERT INTO faculty (user_id, employee_id, department_id, designation, qualification, specialization, joining_date)
      VALUES ($1, 'EMP-CSE-001', $2, 'Professor & HOD', 'Ph.D. in Computer Science (MIT)', 'Distributed Systems & Database Theory', '2016-08-15')
      RETURNING id
    `, [facultyJenkinsId, deptCseId]);
    const fac1Id = fac1Res.rows[0].id;

    const fac2Res = await tx.query(`
      INSERT INTO faculty (user_id, employee_id, department_id, designation, qualification, specialization, joining_date)
      VALUES ($1, 'EMP-CSE-014', $2, 'Associate Professor', 'Ph.D. in Systems Engineering (Stanford)', 'Kernel Architecture & Virtualization', '2019-01-10')
      RETURNING id
    `, [facultyMillerId, deptCseId]);
    const fac2Id = fac2Res.rows[0].id;

    const fac3Res = await tx.query(`
      INSERT INTO faculty (user_id, employee_id, department_id, designation, qualification, specialization, joining_date)
      VALUES ($1, 'EMP-ECE-008', $2, 'Professor & HOD', 'Ph.D. in Signal Processing (Oxford)', 'Network Protocols & Cryptography', '2015-07-01')
      RETURNING id
    `, [facultyRoyId, deptEceId]);
    const fac3Id = fac3Res.rows[0].id;

    // 8. Students Details
    const studentsData = [
      { uId: studentMayaId, sid: 'SID-2024-0412', roll: 'CSE-24-001', reg: 'REG2024CS09881', bgroup: 'A+', guardian: 'Robert Chen', gphone: '+1 (555) 890-1123' },
      { uId: studentLiamId, sid: 'SID-2024-0415', roll: 'CSE-24-002', reg: 'REG2024CS09882', bgroup: 'B+', guardian: 'Rajesh Patel', gphone: '+1 (555) 890-2234' },
      { uId: studentSophiaId, sid: 'SID-2024-0418', roll: 'CSE-24-003', reg: 'REG2024CS09883', bgroup: 'O-', guardian: 'Elena Rodriguez', gphone: '+1 (555) 890-3345' },
      { uId: studentMarcusId, sid: 'SID-2024-0422', roll: 'CSE-24-004', reg: 'REG2024CS09884', bgroup: 'AB+', guardian: 'Adrian Vance', gphone: '+1 (555) 890-4456' },
      { uId: studentAidenId, sid: 'SID-2024-0425', roll: 'CSE-24-005', reg: 'REG2024CS09885', bgroup: 'O+', guardian: 'Jin-Woo Kim', gphone: '+1 (555) 890-5567' },
      { uId: studentEmmaId, sid: 'SID-2024-0430', roll: 'CSE-24-006', reg: 'REG2024CS09886', bgroup: 'A-', guardian: 'Christopher Watson', gphone: '+1 (555) 890-6678' },
    ];

    const studentMap: Record<string, string> = {};
    for (const s of studentsData) {
      const sRes = await tx.query(`
        INSERT INTO students (
          user_id, student_id_number, roll_number, registration_number,
          program_id, current_semester_id, current_section_id,
          admission_date, date_of_birth, blood_group, guardian_name, guardian_phone
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, '2024-08-01', '2004-05-15', $8, $9, $10
        ) RETURNING id
      `, [s.uId, s.sid, s.roll, s.reg, progId, semId, secId, s.bgroup, s.guardian, s.gphone]);
      studentMap[s.roll] = sRes.rows[0].id;
    }

    // 9. Courses & Section Courses
    const coursesData = [
      { code: 'CS301', name: 'Data Structures & Algorithms', credits: 4, type: 'core', facId: fac1Id },
      { code: 'CS302', name: 'Operating Systems & Architecture', credits: 4, type: 'core', facId: fac2Id },
      { code: 'CS303', name: 'Database Management Systems', credits: 3, type: 'core', facId: fac1Id },
      { code: 'CS304', name: 'Computer Networks & Security', credits: 4, type: 'core', facId: fac3Id },
      { code: 'CS305', name: 'Advanced Algorithms Lab', credits: 2, type: 'lab', facId: fac2Id },
    ];

    const secCourseMap: Record<string, string> = {};
    const courseMap: Record<string, string> = {};
    for (const c of coursesData) {
      const cRes = await tx.query(`
        INSERT INTO courses (department_id, code, name, credits, course_type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [deptCseId, c.code, c.name, c.credits, c.type]);
      const cId = cRes.rows[0].id;
      courseMap[c.code] = cId;

      const scRes = await tx.query(`
        INSERT INTO section_courses (section_id, course_id, faculty_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [secId, cId, c.facId]);
      secCourseMap[c.code] = scRes.rows[0].id;
    }

    // 10. Enrollments
    for (const sId of Object.values(studentMap)) {
      for (const scId of Object.values(secCourseMap)) {
        await tx.query(`
          INSERT INTO enrollments (student_id, section_course_id, status)
          VALUES ($1, $2, 'enrolled')
        `, [sId, scId]);
      }
    }

    // 11. Attendance Sessions & Records
    const attSessionRes = await tx.query(`
      INSERT INTO attendance_sessions (section_course_id, session_date, slot_start, slot_end, recorded_by, is_locked)
      VALUES ($1, '2026-09-22', '09:00:00', '10:00:00', $2, false)
      RETURNING id
    `, [secCourseMap['CS301'], facultyJenkinsId]);
    const attSessionId = attSessionRes.rows[0].id;

    const attStatuses: Record<string, string> = {
      'CSE-24-001': 'present',
      'CSE-24-002': 'present',
      'CSE-24-003': 'absent',
      'CSE-24-004': 'present',
      'CSE-24-005': 'late',
      'CSE-24-006': 'excused',
    };

    let firstAttRecordId = '';
    for (const [roll, status] of Object.entries(attStatuses)) {
      const recRes = await tx.query(`
        INSERT INTO attendance_records (session_id, student_id, status)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [attSessionId, studentMap[roll], status]);
      if (!firstAttRecordId) firstAttRecordId = recRes.rows[0].id;
    }

    // Attendance correction
    await tx.query(`
      INSERT INTO attendance_corrections (attendance_record_id, requested_by, previous_status, new_status, reason, status)
      VALUES ($1, $2, 'absent', 'present', 'Student was present at medical station with verified infirmary slip', 'pending')
    `, [firstAttRecordId, facultyJenkinsId]);

    // 12. Fee Structures, Dues & Transactions
    const feeStructRes = await tx.query(`
      INSERT INTO fee_structures (program_id, semester_id, name, tuition_fee, exam_fee, lab_fee, library_fee, due_date)
      VALUES ($1, $2, 'Semester 5 Standard Academic Dues', 4500.00, 250.00, 300.00, 150.00, '2026-10-15')
      RETURNING id
    `, [progId, semId]);
    const feeStructId = feeStructRes.rows[0].id;

    // Fee dues for students
    const duesData = [
      { roll: 'CSE-24-001', total: 5200.00, paid: 5200.00, outstanding: 0.00, status: 'paid' },
      { roll: 'CSE-24-002', total: 5200.00, paid: 2600.00, outstanding: 2600.00, status: 'partial' },
      { roll: 'CSE-24-003', total: 5200.00, paid: 0.00, outstanding: 5200.00, status: 'unpaid' },
      { roll: 'CSE-24-004', total: 5200.00, paid: 2600.00, outstanding: 2600.00, status: 'partial' },
      { roll: 'CSE-24-005', total: 5200.00, paid: 5200.00, outstanding: 0.00, status: 'paid' },
      { roll: 'CSE-24-006', total: 5200.00, paid: 0.00, outstanding: 5200.00, status: 'unpaid' },
    ];

    for (const d of duesData) {
      const dueRes = await tx.query(`
        INSERT INTO student_fee_dues (student_id, fee_structure_id, total_amount, paid_amount, outstanding_amount, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [studentMap[d.roll], feeStructId, d.total, d.paid, d.outstanding, d.status]);
      const dueId = dueRes.rows[0].id;

      if (d.paid > 0) {
        await tx.query(`
          INSERT INTO fee_transactions (student_fee_due_id, transaction_reference, amount, payment_mode, status, processed_by, receipt_number, notes)
          VALUES ($1, $2, $3, 'online', 'success', $4, $5, 'Payment verified via gateway')
        `, [dueId, `TXN-2026-${d.roll}`, d.paid, accountantId, `REC-2026-${d.roll}`]);
      }
    }

    // 13. Examinations & Marks Entries
    const examRes = await tx.query(`
      INSERT INTO examinations (semester_id, title, exam_type, is_locked, is_published)
      VALUES ($1, 'Fall 2026 Midterm Examination', 'midterm', false, false)
      RETURNING id
    `, [semId]);
    const examId = examRes.rows[0].id;

    const sampleMarks = [
      { roll: 'CSE-24-001', marks: 44, grade: 'A+' },
      { roll: 'CSE-24-002', marks: 38, grade: 'A' },
      { roll: 'CSE-24-003', marks: 32, grade: 'B+' },
      { roll: 'CSE-24-004', marks: 28, grade: 'B' },
      { roll: 'CSE-24-005', marks: 41, grade: 'A+' },
      { roll: 'CSE-24-006', marks: 36, grade: 'A' },
    ];

    for (const m of sampleMarks) {
      await tx.query(`
        INSERT INTO marks_entries (examination_id, course_id, student_id, marks_obtained, max_marks, grade, entered_by)
        VALUES ($1, $2, $3, $4, 50, $5, $6)
      `, [examId, courseMap['CS301'], studentMap[m.roll], m.marks, m.grade, facultyJenkinsId]);
    }

    // 13.5. Assignments & Submissions
    if (secCourseMap['CS301']) {
      const asg1Res = await tx.query(`
        INSERT INTO assignments (section_course_id, title, description, max_marks, due_date, allow_late)
        VALUES ($1, 'Problem Set 3: Red-Black Trees & B-Trees', 'Implement self-balancing search trees with logarithmic invariant proofs and benchmark performance.', 50, '2026-10-05 23:59:59+00', false)
        RETURNING id
      `, [secCourseMap['CS301']]);
      const asg1Id = asg1Res.rows[0].id;

      // Submissions for assignment 1
      const sub1Data = [
        { roll: 'CSE-24-001', late: false, marks: 46, feedback: 'Exemplary tree rotation verification' },
        { roll: 'CSE-24-002', late: false, marks: 42, feedback: 'Accurate proofs, minor edge case omission' },
        { roll: 'CSE-24-003', late: true, marks: 38, feedback: 'Late submission verified via infirmary slip' },
        { roll: 'CSE-24-004', late: false, marks: 44, feedback: 'Clean modular implementation' },
        { roll: 'CSE-24-005', late: false, marks: null, feedback: null },
      ];

      for (const s of sub1Data) {
        await tx.query(`
          INSERT INTO assignment_submissions (assignment_id, student_id, file_url, is_late, marks_awarded, feedback, graded_by, graded_at)
          VALUES ($1, $2, 'https://git.campus.edu/submissions/ps3.tar.gz', $3, $4, $5, $6, $7)
        `, [asg1Id, studentMap[s.roll], s.late, s.marks, s.feedback, s.marks !== null ? facultyJenkinsId : null, s.marks !== null ? '2026-09-24 14:00:00+00' : null]);
      }
    }

    if (secCourseMap['CS302']) {
      await tx.query(`
        INSERT INTO assignments (section_course_id, title, description, max_marks, due_date, allow_late)
        VALUES ($1, 'Kernel Memory Allocator Lab', 'Design a buddy allocator in C with page-level coalescing and fragmentation telemetry.', 100, '2026-10-12 23:59:59+00', true)
      `, [secCourseMap['CS302']]);
    }

    // 14. Timetable Slots
    const timetableData = [
      { code: 'CS301', day: 'Monday', start: '09:00:00', end: '10:00:00', room: 'LH-101', type: 'lecture' },
      { code: 'CS302', day: 'Monday', start: '10:15:00', end: '11:15:00', room: 'LH-102', type: 'lecture' },
      { code: 'CS303', day: 'Monday', start: '11:30:00', end: '12:30:00', room: 'LH-101', type: 'lecture' },
      { code: 'CS304', day: 'Tuesday', start: '09:00:00', end: '10:00:00', room: 'LH-103', type: 'lecture' },
      { code: 'CS305', day: 'Wednesday', start: '14:00:00', end: '16:00:00', room: 'LAB-3', type: 'lab' },
    ];

    for (const tt of timetableData) {
      if (secCourseMap[tt.code]) {
        await tx.query(`
          INSERT INTO timetable_slots (institution_id, section_course_id, day_of_week, start_time, end_time, room_number, slot_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [instId, secCourseMap[tt.code], tt.day, tt.start, tt.end, tt.room, tt.type]);
      }
    }

    // 15. Governance Approvals
    await tx.query(`
      INSERT INTO approval_requests (institution_id, requester_id, entity, entity_id, request_type, reason, status)
      VALUES ($1, $2, 'attendance', $3, 'Attendance Regularization', 'Infirmary slip validated for absence on 2026-09-22', 'pending')
    `, [instId, facultyJenkinsId, firstAttRecordId]);

    console.log('[Seed] Seeding completed successfully.');
  });

  // 15. Create initial cryptographic audit log
  const adminRes = await dbClient.query('SELECT id, email FROM users WHERE username = $1', ['avance']);
  if (adminRes.rows[0]) {
    await createAuditLog({
      actorId: adminRes.rows[0].id,
      actorEmail: adminRes.rows[0].email,
      role: 'COLLEGE_ADMIN',
      action: 'SYSTEM_INIT',
      entity: 'database',
      entityId: 'genesis',
      newValues: { status: 'INITIALIZED', schema: 'PostgreSQL 16 Relational' },
      reason: 'Initial system bootstrap and baseline institutional record population',
      ipAddress: '127.0.0.1',
    });
    console.log('[Seed] Initial cryptographic audit entry verified.');
  }
}

// Allow CLI execution
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  seedDatabase()
    .then(() => {
      console.log('[Seed] Database populated successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Database seeding failed:', err);
      process.exit(1);
    });
}
