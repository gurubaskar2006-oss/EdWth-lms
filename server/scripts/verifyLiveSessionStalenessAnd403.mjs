import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: 'server/.env' });

const BACKEND_URL = 'http://localhost:5000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_12345';

async function main() {
  console.log('--- Step 1: Testing No Token ---');
  const res1 = await fetch(`${BACKEND_URL}/admin/schools`);
  const body1 = await res1.json();
  console.log('No Token Status:', res1.status, body1);
  if (res1.status !== 401) throw new Error('Expected 401 for no token');

  console.log('\n--- Step 2: Testing Genuine Trainer Token (RBAC 403 Check) ---');
  // Real DB trainer: mani123@alpha.edu (ID: 6ae5b597a34d0b03eb90e2da)
  const trainerToken = jwt.sign(
    { id: '6ae5b597a34d0b03eb90e2da', role: 'trainer', email: 'mani123@alpha.edu' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const res2 = await fetch(`${BACKEND_URL}/admin/schools`, {
    headers: { Authorization: `Bearer ${trainerToken}` }
  });
  const body2 = await res2.json();
  console.log('Trainer Token Status:', res2.status, body2);
  if (res2.status !== 403) throw new Error(`Expected 403 for trainer, got ${res2.status}`);
  if (body2.code !== 'INSUFFICIENT_PRIVILEGES') throw new Error(`Expected code INSUFFICIENT_PRIVILEGES, got ${body2.code}`);

  console.log('\n--- Step 3: Testing Genuine Student Token (RBAC 403 Check) ---');
  // Real DB student: abitha.scholar@student.edwth.org (ID: 6ae5b264a34d0b03eb90e29c)
  const studentToken = jwt.sign(
    { id: '6ae5b264a34d0b03eb90e29c', role: 'student', tenantId: '6ae5b195a34d0b03eb90e290' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const res3 = await fetch(`${BACKEND_URL}/admin/schools`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  const body3 = await res3.json();
  console.log('Student Token Status:', res3.status, body3);
  if (res3.status !== 403) throw new Error(`Expected 403 for student, got ${res3.status}`);
  if (body3.code !== 'INSUFFICIENT_PRIVILEGES') throw new Error(`Expected code INSUFFICIENT_PRIVILEGES, got ${body3.code}`);

  console.log('\n--- Step 4: Testing Genuine SuperAdmin Token (RBAC 200 Check) ---');
  // Mint genuine SuperAdmin token for existing DB SuperAdmin
  const superAdminToken = jwt.sign(
    { id: '6adc599773e896cb28f2faec', role: 'superadmin', isSuperAdmin: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const res4 = await fetch(`${BACKEND_URL}/admin/schools`, {
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });
  const body4 = await res4.json();
  console.log('SuperAdmin Schools Status:', res4.status, 'Success:', body4.success, 'Schools count:', body4.schools?.length);
  if (res4.status !== 200 || !body4.success) throw new Error(`Expected 200 and success: true for SuperAdmin, got ${res4.status}`);

  console.log('\n✅ All API & RBAC Response Structure Checks Passed Successfully!');
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
