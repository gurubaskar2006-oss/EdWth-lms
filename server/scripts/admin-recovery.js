import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/lumina_lms';

async function resetAdminPassword() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to Database');

    // Default admin details from seed
    const identifier = 'elena.admin@nexus.edu';
    
    const adminUser = await User.findOne({ 
      $or: [
        { email: identifier },
        { studentId: identifier }
      ]
    });

    if (!adminUser) {
      console.log('Admin user not found. Run seedData.js first.');
      process.exit(1);
    }

    const newPassword = 'AdminPassword123!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    adminUser.password = hashedPassword;
    // Optionally reset 2FA if they are totally locked out
    adminUser.twoFactorSecret = undefined;
    adminUser.isTwoFactorEnabled = false;

    await adminUser.save();

    console.log('==========================================');
    console.log('ADMIN PASSWORD RECOVERY SUCCESSFUL');
    console.log('==========================================');
    console.log(`User: ${adminUser.name} (${adminUser.email})`);
    console.log(`New Password: ${newPassword}`);
    console.log('2FA has been disabled. Please re-enable it after login.');
    console.log('==========================================');

    process.exit(0);
  } catch (error) {
    console.error('Error recovering admin password:', error);
    process.exit(1);
  }
}

resetAdminPassword();
