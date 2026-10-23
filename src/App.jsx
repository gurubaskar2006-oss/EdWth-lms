import React from 'react';
import { useLMS } from './context/LMSContext';
import { SchoolStudentApp } from './components/school/SchoolStudentApp';
import { CollegeStudentApp } from './components/college/CollegeStudentApp';
import { UnauthenticatedView } from './components/UnauthenticatedView';

export const App = () => {
  const { 
    isAuthenticated, 
    user,
    institutionType
  } = useLMS();

  const currentRole = (user?.role || '').toLowerCase();
  if (!isAuthenticated) {
    return <UnauthenticatedView portalName="EdWth LMS" role="student" />;
  }

  // Server-authoritative role redirection
  if (currentRole === 'admin' || currentRole === 'superadmin') {
    window.location.replace('/admin.html');
    return null;
  }
  if (currentRole === 'trainer' || currentRole === 'teacher') {
    window.location.replace('/trainer.html');
    return null;
  }

  // Institution-Specific Student Experience Separation
  const effectiveInstitution = user?.institutionType || institutionType || 'college';
  if (effectiveInstitution === 'school') {
    return <SchoolStudentApp />;
  }

  return <CollegeStudentApp />;
};

export default App;

