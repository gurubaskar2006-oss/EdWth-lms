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
  studentsCache = [];
  return studentsCache;
};

export const getStudents = () => {
  return [];
};

export const saveStudents = (studentsList) => {
  // Legacy function. We no longer write to the file system for the source of truth.
  // This is handled by MongoDB now.
  studentsCache = studentsList;
};

export const getCsvPath = () => CSV_FILE_PATH;
export const getJsonPath = () => JSON_FILE_PATH;
