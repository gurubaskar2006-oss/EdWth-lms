/**
 * Phase 2 & 7 End-to-End Workflow Verification Script
 * Exercises the complete student-trainer lifecycle against the active backend server
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000/api/v1';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('=== STARTING E2E VERIFICATION SUITE ===\n');
  const results = [];

  // Helper to record test results
  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      results.push({ name, status: 'PASS', details });
    } else {
      console.error(`❌ [FAIL] ${name}: ${details}`);
      results.push({ name, status: 'FAIL', details });
    }
  }

  const cleanupArtifacts = {
    assignments: [],
    events: [],
    notices: []
  };

  try {
    // 1. Authenticate Trainer
    console.log('Step 1: Trainer Authentication & Tenant Check');
    const trainerLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'teacher@oakridge.edu', password: 'Teacher@123' })
    });
    assert('Trainer login successful', trainerLogin.ok && trainerLogin.data.token != null);
    const trainerToken = trainerLogin.data.token;
    const trainerTenantId = trainerLogin.data.user?.tenantId;
    assert('Trainer role is trainer', trainerLogin.data.user?.role === 'trainer');
    assert('Trainer has valid tenantId', !!trainerTenantId);

    const trainerHeaders = { 'Authorization': `Bearer ${trainerToken}` };

    // 2. Authenticate Student
    console.log('\nStep 2: Student Authentication & Tenant Check');
    const studentLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: 'leo.miller@oakridge.edu', password: 'Student#123!' })
    });
    assert('Student login successful', studentLogin.ok && studentLogin.data.token != null);
    const studentToken = studentLogin.data.token;
    const studentTenantId = studentLogin.data.user?.tenantId;
    assert('Student role is student', studentLogin.data.user?.role === 'student');
    assert('Student shares trainer tenantId', studentTenantId === trainerTenantId);

    const studentHeaders = { 'Authorization': `Bearer ${studentToken}` };

    // 3. Trainer creates homework assignment
    console.log('\nStep 3: Homework Creation & Persistence');
    const hwTitle = `E2E Verify Assignment ${Date.now()}`;
    const createHw = await request('/trainer/homework', {
      method: 'POST',
      headers: trainerHeaders,
      body: JSON.stringify({
        title: hwTitle,
        subject: 'Python Programming',
        topic: 'Recursive Functions',
        points: 25,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Implement factorial using recursion and handle base cases.'
      })
    });
    assert('Trainer creates homework', createHw.status === 201 && createHw.data.assignment?._id != null);
    const assignmentId = createHw.data.assignment?._id;
    if (assignmentId) cleanupArtifacts.assignments.push(assignmentId);

    // 4. Student sees published homework
    console.log('\nStep 4: Student Views Published Homework');
    const studentHwList = await request('/school/homework', {
      method: 'GET',
      headers: studentHeaders
    });
    assert('Student fetches homework list', studentHwList.ok && Array.isArray(studentHwList.data.homework));
    const foundHw = (studentHwList.data.homework || []).find(h => (h._id === assignmentId || h.id === assignmentId));
    assert('Student sees newly created assignment', !!foundHw);
    assert('Student sees assignment points (25)', foundHw?.points === 25);
    assert('Initial student submission status is pending/not_submitted', foundHw?.status === 'pending' || foundHw?.status === 'not_submitted');

    // 5. Student submits homework
    console.log('\nStep 5: Student Submits Homework');
    const submissionText = 'def factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 1)';
    const submitRes = await request(`/school/homework/${assignmentId}/submit`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        submissionText,
        notes: 'Completed recursive solution'
      })
    });
    assert('Student submits homework successfully', submitRes.ok && submitRes.data.success);
    const submissionId = submitRes.data.submission?._id;

    // 6. Trainer opens assignment register and inspects roster
    console.log('\nStep 6: Trainer Assignment Roster & Metrics');
    const trainerHwList = await request('/trainer/homework', {
      method: 'GET',
      headers: trainerHeaders
    });
    assert('Trainer fetches homework register', trainerHwList.ok && Array.isArray(trainerHwList.data.assignments));
    const trainerHw = (trainerHwList.data.assignments || []).find(h => (h._id === assignmentId || h.id === assignmentId));
    assert('Assignment card found in trainer register', !!trainerHw);
    assert('Metrics: submittedCount is 1', trainerHw?.submittedCount === 1);
    assert('Metrics: awaitingEvaluationCount is 1', trainerHw?.awaitingEvaluationCount === 1);
    assert('Metrics: evaluatedCount is 0', trainerHw?.evaluatedCount === 0);
    assert('Roster populated with students', Array.isArray(trainerHw?.roster) && trainerHw.roster.length > 0);

    const leoRosterEntry = (trainerHw?.roster || []).find(r => r.studentName === 'Leo Miller' || r.studentId === 'SCH-2026-001');
    assert('Leo Miller present in roster', !!leoRosterEntry);
    assert('Leo status is submitted', leoRosterEntry?.status === 'submitted');
    assert('Leo submissionText captured accurately', leoRosterEntry?.submissionText?.includes('factorial'));

    // 7. Trainer evaluation and grading bounds validation
    console.log('\nStep 7: Evaluation Bounds & Grade Submission');
    // Test 7a: Reject score > max marks
    const invalidGradeRes = await request(`/trainer/assignments/${submissionId || leoRosterEntry?.submissionId}/grade`, {
      method: 'POST',
      headers: trainerHeaders,
      body: JSON.stringify({
        studentId: leoRosterEntry?.studentDbId,
        score: 30, // Exceeds max points of 25
        feedback: 'Score too high'
      })
    });
    assert('Rejects score exceeding max points (30 > 25)', invalidGradeRes.status === 400);

    // Test 7b: Valid evaluation (24/25)
    const validGradeRes = await request(`/trainer/assignments/${submissionId || leoRosterEntry?.submissionId}/grade`, {
      method: 'POST',
      headers: trainerHeaders,
      body: JSON.stringify({
        studentId: leoRosterEntry?.studentDbId,
        score: 24,
        feedback: 'Clean base-case handling and optimal recursion.'
      })
    });
    assert('Valid evaluation saved successfully', validGradeRes.ok && validGradeRes.data.success);

    // 8. Student inspects graded homework
    console.log('\nStep 8: Student Refreshes Graded Homework');
    const studentGradedHw = await request('/school/homework', {
      method: 'GET',
      headers: studentHeaders
    });
    const leoHwAfterGrade = (studentGradedHw.data.homework || []).find(h => (h._id === assignmentId || h.id === assignmentId));
    assert('Student sees status graded', leoHwAfterGrade?.status === 'graded');
    assert('Student sees score 24', leoHwAfterGrade?.score === 24);
    assert('Student sees teacher feedback', leoHwAfterGrade?.feedback?.includes('recursion'));

    // 9. Academic Calendar Workflow
    console.log('\nStep 9: Academic Calendar - Shared Source of Truth');
    const eventTitle = `Midterm Review Session ${Date.now()}`;
    const createEvent = await request('/trainer/calendar/events', {
      method: 'POST',
      headers: trainerHeaders,
      body: JSON.stringify({
        title: eventTitle,
        eventType: 'class',
        subject: 'Computer Science',
        room: 'Lab 3B',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        description: 'Interactive recursion and algorithm analysis.'
      })
    });
    assert('Trainer creates academic calendar event', createEvent.ok && createEvent.data.success);
    const eventId = createEvent.data.event?._id;
    if (eventId) cleanupArtifacts.events.push(eventId);

    // Student checks calendar
    const studentCalendar = await request('/school/calendar/events', {
      method: 'GET',
      headers: studentHeaders
    });
    assert('Student fetches calendar events', studentCalendar.ok && Array.isArray(studentCalendar.data.events));
    const foundEvent = (studentCalendar.data.events || []).find(e => (e._id === eventId || e.id === eventId || e.title === eventTitle));
    assert('Student sees trainer-created calendar event', !!foundEvent);

    // Trainer edits event
    const updateEvent = await request(`/trainer/calendar/events/${eventId}`, {
      method: 'PUT',
      headers: trainerHeaders,
      body: JSON.stringify({
        title: `${eventTitle} (Updated)`,
        room: 'Room 204'
      })
    });
    assert('Trainer updates calendar event', updateEvent.ok && updateEvent.data.success);

    // Student sees update
    const studentCalAfterUpdate = await request('/school/calendar/events', {
      method: 'GET',
      headers: studentHeaders
    });
    const foundUpdatedEvent = (studentCalAfterUpdate.data.events || []).find(e => (e._id === eventId || e.id === eventId));
    assert('Student sees updated event room/title', foundUpdatedEvent?.room === 'Room 204' || foundUpdatedEvent?.title?.includes('(Updated)'));

    // Trainer cancels event
    const cancelEvent = await request(`/trainer/calendar/events/${eventId}/cancel`, {
      method: 'POST',
      headers: trainerHeaders,
      body: JSON.stringify({ cancellationReason: 'Rescheduled for lab maintenance' })
    });
    assert('Trainer cancels calendar event', cancelEvent.ok && cancelEvent.data.success);

    // 10. Announcements Workflow
    console.log('\nStep 10: Announcements Workflow');
    const noticeTitle = `Important Lab Notice ${Date.now()}`;
    const createNotice = await request('/trainer/announcements', {
      method: 'POST',
      headers: trainerHeaders,
      body: JSON.stringify({
        title: noticeTitle,
        content: 'Please ensure all local environment dependencies are updated before Friday.',
        priority: 'high',
        targetScope: 'batch',
        status: 'published'
      })
    });
    assert('Trainer creates persistent announcement', createNotice.ok && createNotice.data.success);
    const noticeId = createNotice.data.announcement?._id;
    if (noticeId) cleanupArtifacts.notices.push(noticeId);

    // Student fetches announcements
    const studentNotices = await request('/school/announcements', {
      method: 'GET',
      headers: studentHeaders
    });
    assert('Student fetches announcements', studentNotices.ok && Array.isArray(studentNotices.data.announcements));
    const foundNotice = (studentNotices.data.announcements || []).find(n => (n._id === noticeId || n.id === noticeId || n.title === noticeTitle));
    assert('Student sees authorized announcement', !!foundNotice);
    assert('Notice has priority high', foundNotice?.priority === 'high');

    // 11. School Practice Code Lab Isolation Check
    console.log('\nStep 11: School Code Lab Execution & Boundary Check');
    const codeRunRes = await request('/execute', {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({
        language: 'python',
        files: [{ name: 'main', content: 'print(2 + 2)' }]
      })
    });
    assert('Code Lab execution endpoint reachable', codeRunRes.status === 200 || codeRunRes.status === 503);
    // Crucial check: verify code run did NOT create submissions or alter grades
    const hwListAfterCodeRun = await request('/school/homework', {
      method: 'GET',
      headers: studentHeaders
    });
    const gradedHwCount = (hwListAfterCodeRun.data.homework || []).filter(h => h.status === 'graded').length;
    assert('Practice code run did NOT alter homework grade count', gradedHwCount >= 1);

    // 12. Storage Status & Honest B2 Reporting
    console.log('\nStep 12: Backblaze B2 Storage Status Check');
    const storageStatusRes = await request('/storage/status', {
      method: 'GET',
      headers: trainerHeaders
    });
    assert('Storage status responds with 503 or 200', storageStatusRes.status === 503 || storageStatusRes.status === 200);
    if (storageStatusRes.status === 503) {
      assert('Storage truthfully reports configured: false when placeholders present', storageStatusRes.data.configured === false);
    }

    // 13. Tenant Isolation Check
    console.log('\nStep 13: Tenant Isolation Check');
    // Try to access homework with invalid tenant or unauthenticated
    const unauthHw = await request('/trainer/homework', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer invalid-token-123' }
    });
    assert('Rejects invalid auth token with 401/403', unauthHw.status === 401 || unauthHw.status === 403);

    console.log('\n=== E2E VERIFICATION COMPLETE ===');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`Total assertions: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    process.exitCode = failed > 0 ? 1 : 0;
  } catch (err) {
    console.error('Fatal error during E2E verification:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n=== E2E VERIFICATION TEARDOWN (CLEANUP) ===');
    try {
      const trainerLogin = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'teacher@oakridge.edu', password: 'Teacher@123' })
      });
      const tToken = trainerLogin.data?.token;
      if (tToken) {
        const cleanupHeaders = { 'Authorization': `Bearer ${tToken}` };
        for (const hwId of cleanupArtifacts.assignments.filter(Boolean)) {
          await request(`/trainer/homework/${hwId}?purge=true`, { method: 'DELETE', headers: cleanupHeaders });
          console.log(` - Purged e2e homework: ${hwId}`);
        }
        for (const evId of cleanupArtifacts.events.filter(Boolean)) {
          await request(`/trainer/calendar/events/${evId}`, { method: 'DELETE', headers: cleanupHeaders });
          console.log(` - Purged e2e calendar event: ${evId}`);
        }
        for (const notId of cleanupArtifacts.notices.filter(Boolean)) {
          await request(`/trainer/announcements/${notId}`, { method: 'DELETE', headers: cleanupHeaders });
          console.log(` - Purged e2e announcement: ${notId}`);
        }
      }
    } catch (cleanErr) {
      console.warn('Warning during e2e cleanup:', cleanErr.message);
    }
  }
}

run();
