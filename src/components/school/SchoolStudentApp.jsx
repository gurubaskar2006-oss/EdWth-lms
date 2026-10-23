import React, { useState } from 'react';
import { Code2 } from 'lucide-react';
import { useLMS } from '../../context/LMSContext';
import { SchoolSidebar } from './SchoolSidebar';
import { Header } from '../Header';
import { ToastNotifications } from '../ToastNotifications';
import { LoginModal } from '../LoginModal';
import { ForcedPasswordChangeModal } from '../ForcedPasswordChangeModal';
import { LiveAttendanceModal } from '../LiveAttendanceModal';
import { SchoolHomeworkSubmitModal } from './SchoolHomeworkSubmitModal';
import { AssessmentEditorModal } from '../AssessmentEditorModal';
import { CodingPanelDrawer } from '../CodingPanelDrawer';
import { PomodoroModal } from '../PomodoroModal';
import { GlobalNotesDrawer } from '../GlobalNotesDrawer';
import { QuickSearchModal } from '../QuickSearchModal';
// School Specific Views
import { SchoolDashboardView } from '../../views/school/SchoolDashboardView';
import { SchoolSubjectsView } from '../../views/school/SchoolSubjectsView';
import { SchoolHomeworkView } from '../../views/school/SchoolHomeworkView';
import { SchoolTestsView } from '../../views/school/SchoolTestsView';
import { SchoolScheduleView } from '../../views/school/SchoolScheduleView';
import { SchoolAnnouncementsView } from '../../views/school/SchoolAnnouncementsView';
import { SchoolHelpView } from '../../views/school/SchoolHelpView';
import { SchoolCodeLabView } from '../../views/school/SchoolCodeLabView';
import { SchoolStudyMaterialsView } from '../../views/school/SchoolStudyMaterialsView';
import { SettingsView } from '../../views/SettingsView';
import { UnauthenticatedView } from '../UnauthenticatedView';

export const SchoolStudentApp = () => {
  const {
    activeTab,
    setActiveTab,
    loginModalOpen,
    setLoginModalOpen,
    setCodingPanelOpen,
    isAuthenticated,
    user,
    activeAttendancePrompt,
    setActiveAttendancePrompt,
    mustChangePasswordPromptOpen
  } = useLMS();

  const [activeHomeworkSubmit, setActiveHomeworkSubmit] = useState(null);
  const [activeAssessment, setActiveAssessment] = useState(null);

  const currentRole = (user?.role || '').toLowerCase();
  if (!isAuthenticated || (currentRole !== 'student' && currentRole !== 'admin' && currentRole !== 'trainer')) {
    return <UnauthenticatedView portalName="School Student Portal" role="student" />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'welcome':
        return <SchoolDashboardView onOpenHomeworkModal={(hw) => setActiveHomeworkSubmit(hw)} />;
      case 'profile':
      case 'settings':
        return <SettingsView onCancel={() => setActiveTab('dashboard')} />;
      case 'subjects':
        return (
          <SchoolSubjectsView
            onOpenHomeworkModal={(hw) => setActiveHomeworkSubmit(hw)}
            onOpenAssessmentModal={(c) => setActiveAssessment(c)}
          />
        );
      case 'materials':
      case 'notes':
        return <SchoolStudyMaterialsView />;
      case 'codelab':
      case 'sandbox':
        return <SchoolCodeLabView />;
      case 'homework':
      case 'assignments':
        return <SchoolHomeworkView onOpenHomeworkModal={(hw) => setActiveHomeworkSubmit(hw)} />;
      case 'tests':
      case 'viewer':
      case 'results':
      case 'grades':
        return <SchoolTestsView onOpenAssessmentModal={(challenge) => setActiveAssessment(challenge)} />;
      case 'schedule':
        return <SchoolScheduleView />;
      case 'announcements':
        return <SchoolAnnouncementsView />;
      case 'help':
        return <SchoolHelpView />;
      default:
        return <SchoolDashboardView onOpenHomeworkModal={(hw) => setActiveHomeworkSubmit(hw)} />;
    }
  };

  return (
    <div className="app-container school-portal-container">
      {/* School Sidebar Navigation */}
      <SchoolSidebar />

      {/* Main Content Area */}
      <div className="main-content">
        <Header />

        <main className="page-body" style={{ padding: '1.75rem 2rem' }}>
          {renderActiveView()}
        </main>
      </div>

      {/* Global Slide-Out Sticky Notes Drawer */}
      <GlobalNotesDrawer />

      {/* Global Modals & Notifications */}
      <QuickSearchModal />
      <PomodoroModal />
      <ToastNotifications />
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
      <ForcedPasswordChangeModal isOpen={mustChangePasswordPromptOpen} />

      {/* Proctored Assessment Editor Modal */}
      {activeAssessment && (
        <AssessmentEditorModal
          challenge={activeAssessment}
          onClose={() => setActiveAssessment(null)}
        />
      )}

      {/* Homework Turn In Modal */}
      {activeHomeworkSubmit && (
        <SchoolHomeworkSubmitModal
          homework={activeHomeworkSubmit}
          isOpen={Boolean(activeHomeworkSubmit)}
          onClose={() => setActiveHomeworkSubmit(null)}
        />
      )}

      {/* Live Attendance Prompt Modal */}
      {activeAttendancePrompt && (
        <LiveAttendanceModal
          session={activeAttendancePrompt}
          onClose={() => setActiveAttendancePrompt(null)}
          onConfirmed={() => setActiveAttendancePrompt(null)}
        />
      )}
    </div>
  );
};
