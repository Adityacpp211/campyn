import { useState } from 'react';
import { GlobalFilterState } from './types';
import { useAuth } from './hooks/useAuth';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { GlobalFilterBar } from './components/layout/GlobalFilterBar';
import { CommandPalette } from './components/command/CommandPalette';
import { LoginModal } from './components/auth/LoginModal';
import { DashboardView } from './features/dashboard/DashboardView';
import { StudentsView } from './features/students/StudentsView';
import { FacultyView } from './features/faculty/FacultyView';
import { CoursesView } from './features/academics/CoursesView';
import { TimetableView } from './features/timetable/TimetableView';
import { AttendanceView } from './features/attendance/AttendanceView';
import { AssignmentsView } from './features/assignments/AssignmentsView';
import { ExamsView } from './features/exams/ExamsView';
import { FeesView } from './features/fees/FeesView';
import { ApprovalsView } from './features/approvals/ApprovalsView';
import { AuditView } from './features/audit/AuditView';
import { Loader2, ShieldCheck, LogIn } from 'lucide-react';

export function App() {
  const { currentUser, loading: authLoading, sessionExpired, logout, refetchSession } = useAuth();

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isCommandOpen, setIsCommandOpen] = useState<boolean>(false);
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(false);
  const [selectedStudentDossierId, setSelectedStudentDossierId] = useState<string | undefined>(undefined);

  const [globalFilter, setGlobalFilter] = useState<GlobalFilterState>({
    academicYear: '2026-2027',
    semester: 5,
    departmentId: '',
    section: 'Section A',
  });

  const handleSignOut = async () => {
    await logout();
    setIsLoginOpen(true);
  };

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-near-black)',
          color: 'var(--color-white)',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            backgroundColor: 'var(--color-white)',
            color: 'var(--color-black)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '18px',
          }}
        >
          OS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-light-gray)', fontSize: '13px' }}>
          <Loader2 size={16} className="animate-spin" />
          <span>Verifying cryptographic session credentials...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-near-black)',
          padding: '20px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            backgroundColor: 'var(--color-dark-charcoal)',
            border: '1px solid var(--color-border-gray)',
            borderRadius: 'var(--radius-lg)',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: 'var(--color-charcoal)',
              border: '1px solid var(--color-border-gray)',
              borderRadius: 'var(--radius-md)',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={24} color="#81C784" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-white)', marginBottom: '8px' }}>
            CAMPYN Enterprise Access
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-light-gray)', marginBottom: '24px' }}>
            {sessionExpired
              ? 'Your authenticated session has expired. Re-authenticate to access the institution.'
              : 'Institutional login required. Establish an authenticated session to proceed.'}
          </p>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => setIsLoginOpen(true)}
          >
            <LogIn size={16} /> Sign In with Institutional Identity
          </button>
        </div>

        <LoginModal
          isOpen={isLoginOpen || !currentUser}
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={() => {
            setIsLoginOpen(false);
            refetchSession();
          }}
          isExpired={sessionExpired}
        />
      </div>
    );
  }

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView currentUser={currentUser} onNavigate={setCurrentTab} />;
      case 'students':
        return <StudentsView selectedStudentId={selectedStudentDossierId} filter={globalFilter} />;
      case 'faculty':
        return <FacultyView filter={globalFilter} />;
      case 'courses':
        return <CoursesView filter={globalFilter} />;
      case 'timetable':
        return <TimetableView filter={globalFilter} />;
      case 'attendance':
        return <AttendanceView currentUser={currentUser} filter={globalFilter} />;
      case 'assignments':
        return <AssignmentsView currentUser={currentUser} />;
      case 'exams':
        return <ExamsView currentUser={currentUser} />;
      case 'fees':
        return <FeesView currentUser={currentUser} />;
      case 'approvals':
        return <ApprovalsView currentUser={currentUser} />;
      case 'audit':
        return <AuditView />;
      default:
        return <DashboardView currentUser={currentUser} onNavigate={setCurrentTab} />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: 'var(--color-near-black)' }}>
      {/* Collapsible Left Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentUser={currentUser}
        onSignOut={handleSignOut}
      />

      {/* Main Workspace Frame */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          currentUser={currentUser}
          onOpenCommand={() => setIsCommandOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
        />

        <GlobalFilterBar
          filter={globalFilter}
          onFilterChange={(newVals) => setGlobalFilter({ ...globalFilter, ...newVals })}
        />

        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
            {renderActiveView()}
          </div>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onNavigate={setCurrentTab}
        onSelectStudent={(stuId) => {
          setSelectedStudentDossierId(stuId);
          setCurrentTab('students');
        }}
      />

      {/* Enterprise Authentication Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={() => {
          setIsLoginOpen(false);
          refetchSession();
        }}
        isExpired={sessionExpired}
      />
    </div>
  );
}

export default App;
