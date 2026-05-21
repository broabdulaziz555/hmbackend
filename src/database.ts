import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../database.sqlite');

// Database connection instance with automated foreign key constraints enabled on connection
export const db = new sqlite3.Database(dbPath, (err) => {
  if (!err) {
    db.run('PRAGMA foreign_keys = ON;');
  }
});

export const initDb = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Admin Authorization Engine
      db.run(`CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )`);

      // 2. Teachers Core Storage
      db.run(`CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        language TEXT NOT NULL
      )`);

      // 3. Location Infrastructure Core
      db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )`);

      // 4. Academic Clusters Engine
      db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        level TEXT NOT NULL,
        resource_book TEXT NOT NULL
      )`);

      // 5. Temporal Matrix Units
      db.run(`CREATE TABLE IF NOT EXISTS time_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start TEXT NOT NULL,
        end TEXT NOT NULL,
        UNIQUE(start, end)
      )`);

      // 6. Relational Operational Schedules
      db.run(`CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day TEXT NOT NULL,
        time_slot_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        group_id INTEGER NOT NULL,
        teacher_id INTEGER NOT NULL,
        FOREIGN KEY(time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
        FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
        UNIQUE(day, time_slot_id, room_id),
        UNIQUE(day, time_slot_id, teacher_id),
        UNIQUE(day, time_slot_id, group_id)
      )`);

      // 7. Academic Verification Registers
      db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
        UNIQUE(lesson_id, date)
      )`);

      // 🚀 FAIL-SAFE ZERO CONFIGURATION SEED ENGINE
      db.run(`INSERT OR IGNORE INTO admin (id, username, password) VALUES (1, 'admin', 'admin123')`);

      db.get(`SELECT COUNT(*) as count FROM time_slots`, [], (err, row: any) => {
        if (!err && row && row.count === 0) {
          db.run(`INSERT INTO time_slots (id, start, end) VALUES 
            (1, '09:00', '10:30'),
            (2, '11:00', '12:30'),
            (3, '14:00', '15:30'),
            (4, '16:00', '17:30'),
            (5, '19:00', '20:30')
          `);
        }
      });

      db.get(`SELECT 1`, [], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};

// Generic Functional Database Adapters to handle async/await operations safely
export const dbRun = (sql: string, params: any[] = []): Promise<{ id: number; changes: number }> => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const dbAll = (sql: string, params: any[] = []): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const dbGet = (sql: string, params: any[] = []): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};