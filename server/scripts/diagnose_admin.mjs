import { connectDB } from '../database/mongoose.js';
import User from '../models/User.js';

async function diagnose() {
  await connectDB();
  const users = await User.find({}).lean();
  console.log('Total users in DB:', users.length);
  const adminUsers = users.filter(u => u.role === 'admin' || u.role === 'superadmin');
  console.log('Admin users count:', adminUsers.length);
  for (const a of adminUsers) {
    console.log(JSON.stringify({
      email: a.email,
      studentId: a.studentId,
      name: a.name,
      role: a.role,
      status: a.status,
      tenantId: a.tenantId,
      requires2FA: a.requires2FA,
      mustChangePassword: a.mustChangePassword,
      hasPassword: !!a.password
    }));
  }
  process.exit(0);
}

diagnose().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
