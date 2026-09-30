import {
  User,
  UserRole,
  Student,
  Faculty,
  Course,
  Department,
  AttendanceSession,
  AttendanceRecord,
  TimetableSlot,
  Assignment,
  Examination,
  MarksEntry,
  FeeDue,
  FeeTransaction,
  ApprovalRequest,
  AuditLog,
} from '../types';

const getApiBase = (): string => {
  if (typeof window !== 'undefined') {
    if (
      window.location.protocol === 'file:' ||
      window.location.origin === 'null' ||
      !window.location.host ||
      window.location.hostname === 'localhost' && window.location.port !== '5173'
    ) {
      return (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001/api/v1';
    }
  }
  return (import.meta.env.VITE_API_URL as string) || '/api/v1';
};

const API_BASE = getApiBase();

class ApiClient {
  private token: string | null = null;
  private unauthorizedListeners: Array<() => void> = [];

  constructor() {
    this.token = localStorage.getItem('campus_os_token');
  }

  public onUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.push(listener);
    return () => {
      this.unauthorizedListeners = this.unauthorizedListeners.filter((l) => l !== listener);
    };
  }

  private notifyUnauthorized(): void {
    this.setToken(null);
    this.unauthorizedListeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Error in onUnauthorized listener:', err);
      }
    });
  }

  public setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('campus_os_token', token);
    } else {
      localStorage.removeItem('campus_os_token');
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        this.notifyUnauthorized();
      }
      const errorMsg = json.error?.message || json.message || `Request failed with status ${res.status}`;
      const err: any = new Error(errorMsg);
      err.code = json.error?.code;
      err.status = res.status;
      throw err;
    }

    return json.data !== undefined ? json.data : json;
  }

  // Authentication
  public auth = {
    login: async (email: string, password: string): Promise<{ token: string; user: User; session: any }> => {
      const data = await this.request<{ token: string; user: User; session: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      this.setToken(data.token);
      return data;
    },
    me: async (): Promise<{ user: User }> => {
      return this.request<{ user: User }>('/auth/me');
    },
    getSession: async (): Promise<any> => {
      return this.request<any>('/auth/session');
    },
    switchRole: async (role: UserRole): Promise<{ token: string; user: User }> => {
      const data = await this.request<{ token: string; user: User }>('/auth/switch-role', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      this.setToken(data.token);
      return data;
    },
    logout: async (): Promise<void> => {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } finally {
        this.setToken(null);
      }
    },
    logoutAll: async (): Promise<{ revokedSessions: number }> => {
      try {
        return await this.request<{ revokedSessions: number }>('/auth/logout-all', { method: 'POST' });
      } finally {
        this.setToken(null);
      }
    },
    forgotPassword: async (email: string): Promise<{ message: string; resetToken?: string }> => {
      return this.request('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    resetPassword: async (token: string, newPassword: string): Promise<{ message: string }> => {
      return this.request('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
    },
    verifyEmail: async (token: string): Promise<{ message: string }> => {
      return this.request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    },
  };

  // Students
  public students = {
    list: async (params?: { search?: string; departmentId?: string; section?: string; page?: number; limit?: number }): Promise<{ data: Student[]; pagination: any }> => {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.departmentId) query.append('departmentId', params.departmentId);
      if (params?.section) query.append('section', params.section);
      if (params?.page) query.append('page', params.page.toString());
      if (params?.limit) query.append('limit', params.limit.toString());
      const res = await this.request<any>(`/students?${query.toString()}`);
      return {
        data: Array.isArray(res) ? res : res.data || [],
        pagination: res.pagination || { total: Array.isArray(res) ? res.length : 0, page: 1, limit: 50, totalPages: 1 },
      };
    },
    get: async (id: string): Promise<any> => {
      return this.request<any>(`/students/${id}`);
    },
    create: async (data: any): Promise<any> => {
      return this.request('/students', { method: 'POST', body: JSON.stringify(data) });
    },
    update: async (id: string, data: any): Promise<any> => {
      return this.request(`/students/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    profile: async (): Promise<any> => {
      return this.request('/students/profile');
    },
    transferSection: async (studentId: string, toSectionId: string, reason: string): Promise<any> => {
      return this.request(`/students/${studentId}/transfer-section`, {
        method: 'POST',
        body: JSON.stringify({ toSectionId, reason }),
      });
    },
  };

  // Faculty
  public faculty = {
    list: async (params?: { departmentId?: string; search?: string; page?: number; limit?: number }): Promise<Faculty[]> => {
      const query = new URLSearchParams();
      if (params?.departmentId) query.append('departmentId', params.departmentId);
      if (params?.search) query.append('search', params.search);
      if (params?.page) query.append('page', params.page.toString());
      if (params?.limit) query.append('limit', params.limit.toString());
      const res = await this.request<any>(`/faculty?${query.toString()}`);
      return Array.isArray(res) ? res : res.data || [];
    },
    get: async (id: string): Promise<any> => {
      return this.request<any>(`/faculty/${id}`);
    },
    create: async (data: any): Promise<any> => {
      return this.request('/faculty', { method: 'POST', body: JSON.stringify(data) });
    },
    update: async (id: string, data: any): Promise<any> => {
      return this.request(`/faculty/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    assign: async (data: { facultyId: string; courseId: string; sectionId: string }): Promise<any> => {
      return this.request('/faculty/assign', { method: 'POST', body: JSON.stringify(data) });
    },
    unassign: async (sectionCourseId: string): Promise<any> => {
      return this.request(`/faculty/unassign/${sectionCourseId}`, { method: 'DELETE' });
    },
  };

  // Academics
  public academics = {
    departments: async (): Promise<Department[]> => {
      return this.request<Department[]>('/academics/departments');
    },
    departmentStats: async (id: string): Promise<any> => {
      return this.request<any>(`/academics/departments/${id}/stats`);
    },
    createDepartment: async (data: any): Promise<any> => {
      return this.request('/academics/departments', { method: 'POST', body: JSON.stringify(data) });
    },
    updateDepartment: async (id: string, data: any): Promise<any> => {
      return this.request(`/academics/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    archiveDepartment: async (id: string): Promise<any> => {
      return this.request(`/academics/departments/${id}`, { method: 'DELETE' });
    },
    programs: async (departmentId?: string): Promise<any[]> => {
      const q = departmentId ? `?departmentId=${departmentId}` : '';
      return this.request<any[]>(`/academics/programs${q}`);
    },
    academicYears: async (): Promise<any[]> => {
      return this.request<any[]>('/academics/academic-years');
    },
    semesters: async (academicYearId?: string): Promise<any[]> => {
      const q = academicYearId ? `?academicYearId=${academicYearId}` : '';
      return this.request<any[]>(`/academics/semesters${q}`);
    },
    sections: async (programId?: string, semesterId?: string): Promise<any[]> => {
      const query = new URLSearchParams();
      if (programId) query.append('programId', programId);
      if (semesterId) query.append('semesterId', semesterId);
      return this.request<any[]>(`/academics/sections?${query.toString()}`);
    },
    courses: async (params?: { departmentId?: string; search?: string; page?: number; limit?: number }): Promise<Course[]> => {
      const query = new URLSearchParams();
      if (params?.departmentId) query.append('departmentId', params.departmentId);
      if (params?.search) query.append('search', params.search);
      if (params?.page) query.append('page', params.page.toString());
      if (params?.limit) query.append('limit', params.limit.toString());
      const res = await this.request<any>(`/academics/courses?${query.toString()}`);
      return Array.isArray(res) ? res : res.data || [];
    },
    createCourse: async (data: any): Promise<any> => {
      return this.request('/academics/courses', { method: 'POST', body: JSON.stringify(data) });
    },
    updateCourse: async (id: string, data: any): Promise<any> => {
      return this.request(`/academics/courses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    courseOfferings: async (courseId?: string, sectionId?: string): Promise<any[]> => {
      const query = new URLSearchParams();
      if (courseId) query.append('courseId', courseId);
      if (sectionId) query.append('sectionId', sectionId);
      return this.request<any[]>(`/academics/courses/offerings?${query.toString()}`);
    },
  };

  // Attendance
  public attendance = {
    sessions: async (options?: { sectionCourseId?: string; date?: string; facultyId?: string }): Promise<AttendanceSession[]> => {
      const query = new URLSearchParams();
      if (options?.sectionCourseId) query.append('sectionCourseId', options.sectionCourseId);
      if (options?.date) query.append('date', options.date);
      if (options?.facultyId) query.append('facultyId', options.facultyId);
      return this.request<AttendanceSession[]>(`/attendance/sessions?${query.toString()}`);
    },
    records: async (sessionId?: string): Promise<AttendanceRecord[]> => {
      const query = sessionId ? `?sessionId=${sessionId}` : '';
      return this.request<AttendanceRecord[]>(`/attendance/records${query}`);
    },
    recordSession: async (data: { sectionCourseId: string; sessionDate: string; slotStart: string; slotEnd: string; records: { studentId: string; status: string }[] }): Promise<any> => {
      return this.request('/attendance/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    lockSession: async (sessionId: string): Promise<any> => {
      return this.request(`/attendance/sessions/${sessionId}/lock`, { method: 'POST' });
    },
    updateRecord: async (recordId: string, status: string, reason: string): Promise<any> => {
      return this.request(`/attendance/records/${recordId}`, {
        method: 'PUT',
        body: JSON.stringify({ status, reason }),
      });
    },
    submitCorrection: async (attendanceRecordId: string, newStatus: string, reason: string): Promise<any> => {
      return this.request('/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({ attendanceRecordId, newStatus, reason }),
      });
    },
    getStudentStats: async (studentId?: string): Promise<any> => {
      const q = studentId ? `?studentId=${studentId}` : '';
      return this.request<any>(`/attendance/stats${q}`);
    },
    getDepartmentStats: async (departmentId?: string): Promise<any> => {
      const q = departmentId ? `?departmentId=${departmentId}` : '';
      return this.request<any>(`/attendance/department-stats${q}`);
    },
  };

  // Fees
  public fees = {
    dues: async (): Promise<FeeDue[]> => {
      return this.request<FeeDue[]>('/fees/dues');
    },
    transactions: async (): Promise<FeeTransaction[]> => {
      return this.request<FeeTransaction[]>('/fees/transactions');
    },
    collect: async (feeDueId: string, amount: number, paymentMode: string): Promise<any> => {
      return this.request('/fees/collect', {
        method: 'POST',
        body: JSON.stringify({ feeDueId, amount, paymentMode }),
      });
    },
    refund: async (txnId: string, reason: string): Promise<any> => {
      return this.request(`/fees/transactions/${txnId}/refund`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
  };

  // Governance Approvals
  public approvals = {
    list: async (): Promise<ApprovalRequest[]> => {
      return this.request<ApprovalRequest[]>('/approvals');
    },
    get: async (id: string): Promise<ApprovalRequest> => {
      return this.request<ApprovalRequest>(`/approvals/${id}`);
    },
    resolve: async (id: string, decision: 'approved' | 'rejected', decisionReason: string): Promise<any> => {
      return this.request(`/approvals/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision, decisionReason }),
      });
    },
  };

  // Cryptographic Audit
  public audit = {
    list: async (params?: { action?: string; entity?: string; actorEmail?: string }): Promise<AuditLog[]> => {
      const query = new URLSearchParams();
      if (params?.action) query.append('action', params.action);
      if (params?.entity) query.append('entity', params.entity);
      if (params?.actorEmail) query.append('actorEmail', params.actorEmail);
      return this.request<AuditLog[]>(`/audit?${query.toString()}`);
    },
    verify: async (): Promise<{ isValid: boolean; totalRecords: number; tamperedIndex?: number; error?: string }> => {
      return this.request('/audit/verify');
    },
  };

  // Timetable
  public timetable = {
    list: async (params?: { sectionId?: string; facultyId?: string; roomNumber?: string; dayOfWeek?: string }): Promise<TimetableSlot[]> => {
      const query = new URLSearchParams();
      if (params?.sectionId) query.append('sectionId', params.sectionId);
      if (params?.facultyId) query.append('facultyId', params.facultyId);
      if (params?.roomNumber) query.append('roomNumber', params.roomNumber);
      if (params?.dayOfWeek) query.append('dayOfWeek', params.dayOfWeek);
      const res = await this.request<any>(`/timetable?${query.toString()}`);
      return Array.isArray(res) ? res : res.data || [];
    },
    createSlot: async (data: any): Promise<any> => {
      return this.request('/timetable', { method: 'POST', body: JSON.stringify(data) });
    },
    updateSlot: async (id: string, data: any): Promise<any> => {
      return this.request(`/timetable/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteSlot: async (id: string): Promise<any> => {
      return this.request(`/timetable/${id}`, { method: 'DELETE' });
    },
  };

  // Assignments
  public assignments = {
    list: async (params?: { sectionCourseId?: string; courseId?: string }): Promise<Assignment[]> => {
      const query = new URLSearchParams();
      if (params?.sectionCourseId) query.append('sectionCourseId', params.sectionCourseId);
      if (params?.courseId) query.append('courseId', params.courseId);
      const qStr = query.toString() ? `?${query.toString()}` : '';
      return this.request<Assignment[]>(`/assignments${qStr}`);
    },
    create: async (data: { sectionCourseId: string; title: string; description?: string; maxMarks: number; dueDate: string; allowLate?: boolean }): Promise<Assignment> => {
      return this.request<Assignment>('/assignments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    submissions: async (asgId: string): Promise<any[]> => {
      return this.request<any[]>(`/assignments/${asgId}/submissions`);
    },
    submit: async (asgId: string, data: { fileUrl?: string; notes?: string }): Promise<any> => {
      return this.request(`/assignments/${asgId}/submit`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    grade: async (submissionId: string, data: { marksAwarded: number; feedback?: string; reason: string }): Promise<any> => {
      return this.request(`/assignments/submissions/${submissionId}/grade`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
  };

  // Examinations & Marks
  public exams = {
    list: async (): Promise<Examination[]> => {
      return this.request<Examination[]>('/exams');
    },
    create: async (data: { semesterId: string; title: string; examType: 'internal' | 'midterm' | 'final' | 'lab' }): Promise<Examination> => {
      return this.request<Examination>('/exams', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    marks: async (examId: string): Promise<MarksEntry[]> => {
      return this.request<MarksEntry[]>(`/exams/${examId}/marks`);
    },
    populateRoster: async (examId: string, data: { courseId: string; maxMarks?: number }): Promise<any> => {
      return this.request(`/exams/${examId}/populate-roster`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    toggleLock: async (id: string): Promise<any> => {
      return this.request(`/exams/${id}/lock`, { method: 'POST' });
    },
    updateMarks: async (id: string, marksObtained: number, grade?: string, reason?: string): Promise<any> => {
      return this.request(`/exams/marks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ marksObtained, grade, reason }),
      });
    },
  };

  // Dashboard
  public dashboard = {
    stats: async (): Promise<{
      metrics: any;
      recentAudits: AuditLog[];
      lowAttendanceAlerts: any[];
    }> => {
      return this.request('/dashboard/stats');
    },
  };
}

export const api = new ApiClient();
