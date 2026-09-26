import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Department, Course } from '../types';

export function useAcademics(options?: { departmentId?: string; search?: string }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const deptId = options?.departmentId;
  const searchTerm = options?.search;

  const fetchAcademics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptList, courseList, progList] = await Promise.all([
        api.academics.departments(),
        api.academics.courses({
          departmentId: deptId,
          search: searchTerm,
        }),
        api.academics.programs(deptId),
      ]);
      setDepartments(deptList);
      setCourses(courseList);
      setPrograms(progList);
    } catch (err: any) {
      setError(err.message || 'Failed to load academic data');
    } finally {
      setLoading(false);
    }
  }, [deptId, searchTerm]);

  useEffect(() => {
    fetchAcademics();
  }, [fetchAcademics]);

  const createCourse = async (data: any) => {
    const res = await api.academics.createCourse(data);
    await fetchAcademics();
    return res;
  };

  const createDepartment = async (data: any) => {
    const res = await api.academics.createDepartment(data);
    await fetchAcademics();
    return res;
  };

  return {
    departments,
    courses,
    programs,
    loading,
    error,
    refetch: fetchAcademics,
    createCourse,
    createDepartment,
  };
}
