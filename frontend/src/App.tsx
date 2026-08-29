import React, { useState } from 'react';
import { SessionProvider, useSession } from './context/SessionContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardGrid } from './components/dashboard/DashboardGrid';
import { AttendancePage } from './pages/AttendancePage';
import { NoticesPage } from './pages/NoticesPage';
import { AcademicPage } from './pages/AcademicPage';
import { StudentsPage } from './pages/StudentsPage';
import { MembersPage } from './pages/MembersPage';
import { PermissionMatrixPage } from './pages/PermissionMatrixPage';
import { ActivityLogPage } from './pages/ActivityLogPage';
import { ExaminationsPage } from './pages/ExaminationsPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { TasksPage } from './pages/TasksPage';
import { AdmissionsPage } from './pages/AdmissionsPage';
import { InstitutionSettingsPage } from './pages/InstitutionSettingsPage';
import { LoginPage } from './pages/LoginPage';
import { ScopeChip } from './components/common/ScopeChip';

const DashboardView: React.FC<{ onNavigate: (path: string) => void }> = () => {
  const { user, activeMembership, institutionName, dashboardWidgets } = useSession();

  const getScope = () => {
    const role = activeMembership?.roleName?.toLowerCase() || '';
    if (role.includes('admin')) return 'institution';
    if (role.includes('coordinator')) return 'institution';
    if (role.includes('teacher')) return 'assigned_sections';
    return 'self';
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Dashboard Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: '0 0 0.2rem 0' }}>
            Welcome, {user?.name || 'User'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
            {institutionName} &bull; {activeMembership?.roleName || 'Member'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ScopeChip scope={getScope()} label={activeMembership?.roleName} />
        </div>
      </div>

      {/* Dynamic Dashboard Grid */}
      <DashboardGrid widgets={dashboardWidgets} />
    </div>
  );
};

const MainAppContent: React.FC = () => {
  const { isAuthenticated, loading } = useSession();
  const [currentPath, setCurrentPath] = useState<string>('/');

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="animate-spin" style={{ width: '18px', height: '18px', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%' }} />
          <span>Loading workspace...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <DashboardView onNavigate={handleNavigate} />;
      case '/attendance':
        return <AttendancePage />;
      case '/admissions':
        return <AdmissionsPage />;
      case '/examinations':
        return <ExaminationsPage onNavigateHome={() => handleNavigate('/')} />;
      case '/assignments':
        return <AssignmentsPage onNavigateHome={() => handleNavigate('/')} />;
      case '/notices':
        return <NoticesPage />;
      case '/students':
        return <StudentsPage />;
      case '/academic':
        return <AcademicPage />;
      case '/tasks':
        return <TasksPage />;
      case '/members':
        return <MembersPage />;
      case '/permission-matrix':
        return <PermissionMatrixPage />;
      case '/activity-log':
      case '/activity-logs':
        return <ActivityLogPage onNavigateHome={() => handleNavigate('/')} />;
      case '/settings':
        return <InstitutionSettingsPage />;
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout currentPath={currentPath} onNavigate={handleNavigate}>
      {renderPage()}
    </AppLayout>
  );
};

export function App() {
  return (
    <SessionProvider>
      <MainAppContent />
    </SessionProvider>
  );
}

export default App;
