import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const JSON_FILE_PATH = path.join(DATA_DIR, 'students_master_datasheet.json');
const CSV_FILE_PATH = path.join(DATA_DIR, 'students_master_datasheet.csv');

// In-memory cache - mostly deprecated in favor of MongoDB
let studentsCache = null;

export const initDatabase = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // We only load this for legacy exports if needed, or if MongoDB is totally down
  if (fs.existsSync(JSON_FILE_PATH)) {
    try {
      const content = fs.readFileSync(JSON_FILE_PATH, 'utf-8');
      studentsCache = JSON.parse(content);
    } catch (err) {
      console.error('Error reading students JSON datasheet:', err);
      studentsCache = [];
    }
  } else {
    studentsCache = [];
  }

  return studentsCache;
};

export const getStudents = () => {
  if (!studentsCache) {
    initDatabase();
  }

  if (!studentsCache.some(s => s.email === 'admin@nexus.edu')) {
    studentsCache.unshift({
      id: 'usr_admin_01',
      studentId: 'ADMIN-001',
      name: 'System Administrator',
      email: 'admin@nexus.edu',
      password: 'Admin@123',
      role: 'admin',
      accountStatus: 'Active'
    });
  }

  if (!studentsCache.some(s => s.email === 'trainer@nexus.edu')) {
    studentsCache.unshift({
      id: 'usr_trainer_01',
      studentId: 'TRAINER-001',
      name: 'Senior Lead Trainer',
      email: 'trainer@nexus.edu',
      password: 'Trainer@123',
      role: 'trainer',
      accountStatus: 'Active'
    });
  }

  return studentsCache;
};

export const saveStudents = (studentsList) => {
  // Legacy function. We no longer write to the file system for the source of truth.
  // This is handled by MongoDB now.
  studentsCache = studentsList;
};

export const getCsvPath = () => CSV_FILE_PATH;
export const getJsonPath = () => JSON_FILE_PATH;
