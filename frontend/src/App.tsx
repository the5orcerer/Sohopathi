import React, { useState } from 'react';
import { SessionProvider, useSession } from './context/SessionContext';
import AppLayout from './components/layout/AppLayout';
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
import { ReportsPage } from './pages/ReportsPage';
import { InstitutionSettingsPage } from './pages/InstitutionSettingsPage';
import { LoginPage } from './pages/LoginPage';
import { AnalyticsDashboard } from './components/dashboard/AnalyticsDashboard';
import { TemplatesPage } from './pages/TemplatesPage';
import { DocumentTemplateBuilder } from './pages/DocumentTemplateBuilder';
import { RequestsPage } from './pages/RequestsPage';
import { BillingPage } from './pages/BillingPage';

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
      case '/': return <AnalyticsDashboard onNavigate={handleNavigate} />;
      case '/templates': return <TemplatesPage onNavigate={handleNavigate} />;
      case '/templates/builder': return <DocumentTemplateBuilder onNavigate={handleNavigate} />;
      case '/attendance': return <AttendancePage />;
      case '/employee-attendance':
      case '/attendance/employee': return <AttendancePage initialTab="employees" />;
      case '/admissions': return <AdmissionsPage />;
      case '/examinations': return <ExaminationsPage onNavigateHome={() => handleNavigate('/')} />;
      case '/assignments': return <AssignmentsPage onNavigateHome={() => handleNavigate('/')} />;
      case '/notices': return <NoticesPage />;
      case '/students': {
        const role = (activeMembership?.roleName || '').toLowerCase();
        if (role.includes('guardian') || role.includes('student')) {
          return <AnalyticsDashboard onNavigate={handleNavigate} />;
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
      default: return <AnalyticsDashboard onNavigate={handleNavigate} />;
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