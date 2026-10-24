import React, { useState } from 'react';
import { SessionProvider, useSession } from './context/SessionContext';
import { LanguageProvider } from './context/LanguageContext';
import AppLayout from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardGrid } from './components/dashboard/DashboardGrid';
import { ScopeChip } from './components/common/ScopeChip';
import { SchoolPulseBanner } from './components/dashboard/SchoolPulseBanner';

// Route-based code splitting for 2k daily user performance & compact initial bundle
const AttendancePage = React.lazy(() => import('./pages/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const NoticesPage = React.lazy(() => import('./pages/NoticesPage').then((m) => ({ default: m.NoticesPage })));
const AcademicPage = React.lazy(() => import('./pages/AcademicPage').then((m) => ({ default: m.AcademicPage })));
const StudentsPage = React.lazy(() => import('./pages/StudentsPage').then((m) => ({ default: m.StudentsPage })));
const MembersPage = React.lazy(() => import('./pages/MembersPage').then((m) => ({ default: m.MembersPage })));
const PermissionMatrixPage = React.lazy(() => import('./pages/PermissionMatrixPage').then((m) => ({ default: m.PermissionMatrixPage })));
const ActivityLogPage = React.lazy(() => import('./pages/ActivityLogPage').then((m) => ({ default: m.ActivityLogPage })));
const ExaminationsPage = React.lazy(() => import('./pages/ExaminationsPage').then((m) => ({ default: m.ExaminationsPage })));
const AssignmentsPage = React.lazy(() => import('./pages/AssignmentsPage').then((m) => ({ default: m.AssignmentsPage })));
const TasksPage = React.lazy(() => import('./pages/TasksPage').then((m) => ({ default: m.TasksPage })));
const AdmissionsPage = React.lazy(() => import('./pages/AdmissionsPage').then((m) => ({ default: m.AdmissionsPage })));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const InstitutionSettingsPage = React.lazy(() => import('./pages/InstitutionSettingsPage').then((m) => ({ default: m.InstitutionSettingsPage })));
const TemplatesPage = React.lazy(() => import('./pages/TemplatesPage').then((m) => ({ default: m.TemplatesPage })));
const DocumentTemplateBuilder = React.lazy(() => import('./pages/DocumentTemplateBuilder').then((m) => ({ default: m.DocumentTemplateBuilder })));
const RequestsPage = React.lazy(() => import('./pages/RequestsPage').then((m) => ({ default: m.RequestsPage })));
const BillingPage = React.lazy(() => import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })));

// Universal Dashboard
const DashboardView: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
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

      {/* School Pulse KPI Cards & Operational Shortcuts */}
      <SchoolPulseBanner onNavigate={onNavigate} />

      {/* Universal Dashboard Grid - Permission-based filtering */}
      <DashboardGrid widgets={dashboardWidgets} />
    </div>
  );
};

const MainAppContent: React.FC = () => {
  const { isAuthenticated, loading, activeMembership } = useSession();
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
      case '/': return <DashboardView onNavigate={handleNavigate} />;
      case '/templates': return <TemplatesPage onNavigate={handleNavigate} />;
      case '/templates/builder': return <DocumentTemplateBuilder onNavigate={handleNavigate} />;
      case '/attendance': return <AttendancePage />;
      case '/employee-attendance':
      case '/attendance/employee':
      case '/employees/attendance':
      case '/employee/attendance': return <AttendancePage initialTab="employees" />;
      case '/admissions': return <AdmissionsPage />;
      case '/examinations': return <ExaminationsPage onNavigateHome={() => handleNavigate('/')} />;
      case '/assignments': return <AssignmentsPage onNavigateHome={() => handleNavigate('/')} />;
      case '/notices': return <NoticesPage />;
      case '/students': {
        const role = (activeMembership?.roleName || '').toLowerCase();
        if (role.includes('guardian') || role.includes('student')) {
          return <DashboardView onNavigate={handleNavigate} />;
        }
        return <StudentsPage />;
      }
      case '/requests': return <RequestsPage />;
      case '/academic': return <AcademicPage />;
      case '/reports': return <ReportsPage onNavigate={handleNavigate} />;
      case '/tasks': return <TasksPage />;
      case '/members': return <MembersPage />;
      case '/permission-matrix': return <PermissionMatrixPage />;
      case '/billing':
      case '/invoices':
      case '/finance': return <BillingPage onNavigateHome={() => handleNavigate('/')} />;
      case '/activity-log':
      case '/activity-logs': return <ActivityLogPage onNavigateHome={() => handleNavigate('/')} />;
      case '/settings': return <InstitutionSettingsPage />;
      default: return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout currentPath={currentPath} onNavigate={handleNavigate}>
      <React.Suspense
        fallback={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '40vh',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
            }}
          >
            <div
              className="animate-spin"
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid var(--border)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                marginRight: '0.75rem',
              }}
            />
            <span>Loading module...</span>
          </div>
        }
      >
        {renderPage()}
      </React.Suspense>
    </AppLayout>
  );
};

export function App() {
  return (
    <LanguageProvider>
      <SessionProvider>
        <MainAppContent />
      </SessionProvider>
    </LanguageProvider>
  );
}

export default App;