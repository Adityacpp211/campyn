import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Loader2, UserPlus } from 'lucide-react';

interface EnrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentCreated: () => void;
}

export const EnrollStudentModal: React.FC<EnrollStudentModalProps> = ({
  isOpen,
  onClose,
  onStudentCreated,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [departments, setDepartments] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    rollNumber: '',
    departmentId: '',
    programId: '',
    sectionId: '',
    dateOfBirth: '2004-05-15',
    admissionDate: new Date().toISOString().split('T')[0],
    gender: 'Other',
    guardianName: '',
    guardianPhone: '',
  });

  // Load programs & departments on open
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([
        api.academics.departments(),
        api.academics.programs(),
        api.academics.sections(),
      ])
        .then(([depts, progs, secs]) => {
          setDepartments(depts || []);
          setPrograms(progs || []);
          setSections(secs || []);
          if (depts && depts.length > 0) {
            setFormData((prev) => ({
              ...prev,
              departmentId: prev.departmentId || depts[0].id,
              programId: prev.programId || (progs && progs[0]?.id) || '',
              sectionId: prev.sectionId || (secs && secs[0]?.id) || '',
            }));
          }
        })
        .catch((err) => {
          toast.error(err.message || 'Failed to load academic catalogs');
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.rollNumber) {
      toast.warning('Please fill in all mandatory student personal and enrollment fields.');
      return;
    }

    if (!formData.programId) {
      toast.warning('Please select an authorized academic program.');
      return;
    }

    try {
      setSubmitting(true);
      await api.students.create({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        rollNumber: formData.rollNumber.trim().toUpperCase(),
        departmentId: formData.departmentId || undefined,
        programId: formData.programId,
        sectionId: formData.sectionId || undefined,
        admissionDate: formData.admissionDate,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        guardianName: formData.guardianName.trim() || undefined,
        guardianPhone: formData.guardianPhone.trim() || undefined,
      });

      toast.success(
        `Student ${formData.firstName} ${formData.lastName} enrolled with Roll No: ${formData.rollNumber.toUpperCase()}`,
        'Student Enrolled'
      );
      onStudentCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register student record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Enroll New Student">
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '10px' }}>
          <Loader2 size={22} className="animate-spin" color="var(--color-white)" />
          <span style={{ fontSize: '13px', color: 'var(--color-light-gray)' }}>Loading academic catalogs...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Identity Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                First Name *
              </label>
              <input
                type="text"
                required
                className="input-base"
                placeholder="e.g. Maya"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Last Name *
              </label>
              <input
                type="text"
                required
                className="input-base"
                placeholder="e.g. Chen"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Institutional Email *
              </label>
              <input
                type="email"
                required
                className="input-base"
                placeholder="student@campus.edu"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Roll Number *
              </label>
              <input
                type="text"
                required
                className="input-base"
                placeholder="e.g. 21CS042"
                value={formData.rollNumber}
                onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
              />
            </div>
          </div>

          {/* Academic Allocation */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Department
              </label>
              <select
                className="input-base"
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Degree Program *
              </label>
              <select
                className="input-base"
                required
                value={formData.programId}
                onChange={(e) => setFormData({ ...formData, programId: e.target.value })}
              >
                <option value="">Select Program</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Initial Section
              </label>
              <select
                className="input-base"
                value={formData.sectionId}
                onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
              >
                <option value="">Unassigned Section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-light-gray)', marginBottom: '4px' }}>
                Admission Date
              </label>
              <input
                type="date"
                className="input-base"
                value={formData.admissionDate}
                onChange={(e) => setFormData({ ...formData, admissionDate: e.target.value })}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border-gray)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              Confirm Enrollment
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
