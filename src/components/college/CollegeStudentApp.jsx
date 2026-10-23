import React, { useState } from 'react';
import { useLMS } from '../../context/LMSContext';
import { Sidebar } from '../Sidebar';
import { Header } from '../Header';
import { QuickSearchModal } from '../QuickSearchModal';
import { PomodoroModal } from '../PomodoroModal';
import { ToastNotifications } from '../ToastNotifications';
import { AssignmentSubmitModal } from '../AssignmentSubmitModal';
import { AssessmentEditorModal } from '../AssessmentEditorModal';
import { AddEventModal } from '../AddEventModal';
import { LoginModal } from '../LoginModal';
import { GlobalNotesDrawer } from '../GlobalNotesDrawer';
import { CodingPanelDrawer } from '../CodingPanelDrawer';
import { LiveAttendanceModal } from '../LiveAttendanceModal';
import { ForcedPasswordChangeModal } from '../ForcedPasswordChangeModal';
import { UnauthenticatedView } from '../UnauthenticatedView';

// College Student Views
import { WelcomePortalView } from '../../views/WelcomePortalView';
import { DashboardView } from '../../views/DashboardView';
import { CoursesCatalogView } from '../../views/CoursesCatalogView';
import { CourseViewerView } from '../../views/CourseViewerView';
import { AssignmentsView } from '../../views/AssignmentsView';
import { ScheduleView } from '../../views/ScheduleView';
import { GradesView } from '../../views/GradesView';
import { PythonSandboxView } from '../../views/PythonSandboxView';
import { NotesView } from '../../views/NotesView';
import { FlashcardsView } from '../../views/FlashcardsView';
import { SettingsView } from '../../views/SettingsView';
import { NotFoundView } from '../../views/NotFoundView';
import { LeaderboardView } from '../../views/LeaderboardView';

export const CollegeStudentApp = () => {
  const {
    activeTab,
    loginModalOpen,
    setLoginModalOpen,
    setCodingPanelOpen,
    isAuthenticated,
    user,
    activeAttendancePrompt,
    setActiveAttendancePrompt,
    mustChangePasswordPromptOpen
  } = useLMS();

  const [activeSubmitAssignment, setActiveSubmitAssignment] = useState(null);
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [addEventOpen, setAddEventOpen] = useState(false);

  const currentRole = (user?.role || '').toLowerCase();
  if (!isAuthenticated || (currentRole !== 'student' && currentRole !== 'admin' && currentRole !== 'trainer')) {
    return <UnauthenticatedView portalName="College Student Portal" role="student" />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'welcome':
        return <WelcomePortalView />;
      case 'dashboard':
        return <DashboardView onOpenSubmitModal={(asg) => setActiveSubmitAssignment(asg)} />;
      case 'courses':
        return <CoursesCatalogView />;
      case 'viewer':
        return <CourseViewerView />;
      case 'assignments':
        return (
          <AssignmentsView
            onOpenSubmitModal={(asg) => setActiveSubmitAssignment(asg)}
            onOpenAssessmentModal={(challenge) => setActiveAssessment(challenge)}
          />
        );
      case 'schedule':
        return <ScheduleView onOpenAddEvent={() => setAddEventOpen(true)} />;
      case 'grades':
        return <GradesView />;
      case 'sandbox':
        return <PythonSandboxView />;
      case 'notes':
        return <NotesView />;
      case 'flashcards':
        return <FlashcardsView />;
      case 'leaderboard':
        return <LeaderboardView />;
      case 'profile':
      case 'settings':
        return <SettingsView onCancel={() => setActiveTab('dashboard')} />;
      default:
        return <NotFoundView />;
    }
  };

  return (
    <div className="app-container college-portal-container">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Global Header */}
        <Header onOpenAddEvent={() => setAddEventOpen(true)} />

        {/* Page Content Body */}
        <main className="page-body">
          {renderActiveView()}
        </main>
      </div>

      {/* Global Slide-Out Sticky Notes Drawer */}
      <GlobalNotesDrawer />

      {/* Polyglot Coding Panel Drawer */}
      <CodingPanelDrawer />

      {/* Global Modals & Notifications */}
      <QuickSearchModal />
      <PomodoroModal />
      <ToastNotifications />
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
      <ForcedPasswordChangeModal isOpen={mustChangePasswordPromptOpen} />

      {/* Assignment Submit Modal */}
      {activeSubmitAssignment && (
        <AssignmentSubmitModal
          assignment={activeSubmitAssignment}
          onClose={() => setActiveSubmitAssignment(null)}
        />
      )}

      {/* Assessment/Challenge Modal */}
      {activeAssessment && (
        <AssessmentEditorModal
          challenge={activeAssessment}
          onClose={() => setActiveAssessment(null)}
        />
      )}

      {/* Add Calendar Event Modal */}
      <AddEventModal
        isOpen={addEventOpen}
        onClose={() => setAddEventOpen(false)}
      />

      {/* Real-Time Live Attendance Modal for Students */}
      {activeAttendancePrompt && (
        <LiveAttendanceModal
          session={activeAttendancePrompt}
          onClose={() => setActiveAttendancePrompt(null)}
          onConfirmed={() => setActiveAttendancePrompt(null)}
        />
      )}

      {/* Floating Action Button to open Coding Panel globally */}
      <button
        onClick={() => setCodingPanelOpen((prev) => !prev)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          padding: '12px',
          borderRadius: '50%',
          backgroundColor: 'var(--accent-primary)',
          color: '#000',
          border: 'none',
          boxShadow: '0 4px 16px rgba(5, 150, 105, 0.28)',
          cursor: 'pointer',
          zIndex: 900
        }}
        title="Open Code Lab"
      >
        <span style={{ fontSize: '1.2rem' }}>💻</span>
      </button>
    </div>
  );
};
