import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Faculty } from '../../types';
import { Loader2, BookCheck } from 'lucide-react';

interface AssignCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  facultyList: Faculty[];
  onAssigned: () => void;
}

export const AssignCourseModal: React.FC<AssignCourseModalProps> = ({
  isOpen,
  onClose,
  facultyList,
  onAssigned,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [courses, setCourses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [selectedFacultyId, setSelectedFacultyId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([api.academics.courses(), api.academics.sections()])
        .then(([courseList, sectionList]) => {
          setCourses(courseList || []);
          setSections(sectionList || []);
          if (facultyList && facultyList.length > 0) {
            setSelectedFacultyId(facultyList[0].id);
          }
          if (courseList && courseList.length > 0) {
            setSelectedCourseId(courseList[0].id);
          }
          if (sectionList && sectionList.length > 0) {
            setSelectedSectionId(sectionList[0].id);
          }
        })
        .catch((err) => {
          toast.error(err.message || 'Failed to load course and section catalog');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, facultyList, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFacultyId || !selectedCourseId || !selectedSectionId) {
      toast.warning('Please select a faculty member, course, and section.');
      return;
    }

    try {
      setSubmitting(true);
      await api.faculty.assign({
        facultyId: selectedFacultyId,
        courseId: selectedCourseId,
        sectionId: selectedSectionId,
      });

      const selectedFaculty = facultyList.find((f) => f.id === selectedFacultyId);
      const selectedCourse = courses.find((c) => c.id === selectedCourseId);
      const selectedSection = sections.find((s) => s.id === selectedSectionId);

      toast.success(
        `Assigned ${selectedCourse?.code || 'Course'} (${selectedSection?.name || 'Section'}) to ${selectedFaculty?.firstName || ''} ${selectedFaculty?.lastName || 'Faculty'}`,
        'Course Assigned'
      );
      onAssigned();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to allocate course to faculty');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Course & Section to Faculty">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px' }}>
          <Loader2 size={22} className="animate-spin" color="var(--color-white)" />
          <span style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>Loading academic catalogs...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
              Select Instructional Faculty *
            </label>
            <select
              className="input-base"
              required
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
            >
              {facultyList.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.firstName} {f.lastName} ({f.employeeId}) — {f.designation}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
              Academic Course *
            </label>
            <select
              className="input-base"
              required
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}: {c.title} ({c.credits} Credits)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
              Target Section *
            </label>
            <select
              className="input-base"
              required
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              paddingTop: '12px',
              borderTop: '1px solid var(--color-border-gray)',
            }}
          >
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <BookCheck size={15} />}
              Confirm Course Allocation
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
