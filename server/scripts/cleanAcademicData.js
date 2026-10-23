import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
dotenv.config();

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000/api/v1';

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const auditOnly = process.argv.includes('--audit-only');

  console.log('================================================================');
  console.log('       LUMINA LMS — ACADEMIC DEMO & AUDIT DATA CLEANUP');
  console.log('================================================================\n');

  try {
    // 1. Authenticate with admin account on the active server
    console.log(`Connecting to running server at ${BASE_URL}...`);
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'admin@oakridge.edu', password: 'Admin@123' })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      console.error('❌ Failed to authenticate as admin on active server:', loginData.message || loginRes.statusText);
      process.exit(1);
    }

    const adminHeaders = {
      'Authorization': `Bearer ${loginData.token}`,
      'Content-Type': 'application/json'
    };

    // 2. Fetch Deletion Plan
    const planRes = await fetch(`${BASE_URL}/admin/maintenance/plan`, {
      headers: adminHeaders
    });
    const { plan } = await planRes.json();

    console.log('\n--- 1. ACTIVE RECORDS BEFORE CLEANUP ---');
    console.log(`Total Assignments in DB: ${plan.totals.assignments} (Audit: ${plan.auditCandidates.assignments.length}, Demo: ${plan.demoCandidates.assignments.length})`);
    console.log(`Total Submissions in DB: ${plan.totals.submissions} (Audit: ${plan.auditCandidates.submissions.length}, Demo: ${plan.demoCandidates.submissions.length})`);
    console.log(`Total Assessments in DB: ${plan.totals.assessments} (Audit: ${plan.auditCandidates.assessments.length}, Demo: ${plan.demoCandidates.assessments.length})`);
    console.log(`Total Assessment Attempts in DB: ${plan.totals.assessmentAttempts} (Audit: ${plan.auditCandidates.assessmentAttempts.length}, Demo: ${plan.demoCandidates.assessmentAttempts.length})`);
    console.log(`Total Calendar Events in DB: ${plan.totals.calendarEvents} (Audit: ${plan.auditCandidates.calendarEvents.length}, Demo: ${plan.demoCandidates.calendarEvents.length})`);
    console.log(`Total Announcements in DB: ${plan.totals.announcements} (Audit: ${plan.auditCandidates.announcements.length})`);
    console.log(`Total Attendance in DB: ${plan.totals.attendance} (Audit: ${plan.auditCandidates.attendance.length}, Demo: ${plan.demoCandidates.attendance.length})`);

    console.log('\n--- 2. CANDIDATE AUDIT RECORDS TO PURGE ---');
    plan.auditCandidates.assignments.forEach(a => console.log(` - Assignment: "${a.title}" (ID: ${a.id})`));
    plan.auditCandidates.assessments.forEach(t => console.log(` - Assessment: "${t.title}" (ID: ${t.id})`));
    plan.auditCandidates.calendarEvents.forEach(e => console.log(` - Calendar Event: "${e.title}" (ID: ${e.id})`));
    plan.auditCandidates.announcements.forEach(an => console.log(` - Announcement: "${an.title}" (ID: ${an.id})`));

    console.log('\n--- 3. CANDIDATE DEMO RECORDS TO PURGE ---');
    plan.demoCandidates.assignments.forEach(a => console.log(` - Demo Assignment: "${a.title}" (${a.code || a.id})`));
    plan.demoCandidates.assessments.forEach(t => console.log(` - Demo Assessment: "${t.title}" (${t.customId || t.id})`));
    plan.demoCandidates.calendarEvents.forEach(e => console.log(` - Demo Calendar: "${e.title}" (ID: ${e.id})`));

    console.log('\n--- 4. PRESERVED UNCERTAIN RECORDS (MANUAL REVIEW) ---');
    console.log(`Assignments: ${plan.preservedUncertain.assignments.length}`);
    console.log(`Submissions: ${plan.preservedUncertain.submissions.length}`);
    console.log(`Assessments: ${plan.preservedUncertain.assessments.length}`);
    console.log(`Calendar Events: ${plan.preservedUncertain.calendarEvents.length}`);
    console.log(`Announcements: ${plan.preservedUncertain.announcements.length}`);

    if (isDryRun) {
      console.log('\n================================================================');
      console.log('DRY-RUN COMPLETE: Verification plan established. No records deleted.');
      console.log('================================================================');
      process.exit(0);
    }

    // 3. Execute Cleanup
    console.log('\n--- 5. EXECUTING TARGETED DELETION ---');
    const cleanupRes = await fetch(`${BASE_URL}/admin/maintenance/clean-demo-academic`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        removeAudit: true,
        removeDemo: !auditOnly
      })
    });

    const result = await cleanupRes.json();
    console.log('✅ Cleanup Response Status:', cleanupRes.status);
    console.log('Removed by collection:', result.deletedCounts);
    console.log('Remaining in DB:', result.remainingCounts);
    console.log('\n================================================================');
    console.log('All audit-generated Physics and demo records have been eliminated.');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Fatal cleanup error:', err);
    process.exit(1);
  }
}

run();
