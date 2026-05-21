import express from 'express';
import session from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb, dbAll, dbRun, dbGet } from './database.js';
import { checkAuth } from './middleware.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Dynamic extraction of upstream origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'https://hmlearningcenter.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback configuration for broad flexibility across remote dynamic Vercel deployments
    }
  },
  credentials: true
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_dev_core_key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Must remain false unless operating exclusively behind safe SSL deployments
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
}));

// --- AUTHORIZATION ENGINE ENDPOINTS ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await dbGet('SELECT * FROM admin WHERE username = ? AND password = ?', [username, password]);
    if (admin) {
      req.session.isAdmin = true;
      return res.json({ success: true });
    }
    return res.status(400).json({ error: 'Noto\'g\'ri login yoki parol kiritildi!' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Tizimdan chiqishda xatolik!' });
    return res.json({ success: true });
  });
});

app.get('/api/auth/status', (req, res) => {
  return res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// --- OPEN METRIC DATA FEEDS ---
app.get('/api/teachers', async (_req, res) => {
  try { res.json(await dbAll('SELECT * FROM teachers ORDER BY name ASC')); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.get('/api/rooms', async (_req, res) => {
  try { res.json(await dbAll('SELECT * FROM rooms ORDER BY name ASC')); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.get('/api/groups', async (_req, res) => {
  try { res.json(await dbAll('SELECT * FROM groups ORDER BY name ASC')); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.get('/api/time_slots', async (_req, res) => {
  try { res.json(await dbAll('SELECT * FROM time_slots ORDER BY start ASC')); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.get('/api/lessons', async (_req, res) => {
  try {
    const query = `
      SELECT lessons.*, teachers.name as teacher_name, rooms.name as room_name, 
             groups.name as group_name, groups.level as group_level, groups.resource_book,
             time_slots.start, time_slots.end
      FROM lessons
      JOIN teachers ON lessons.teacher_id = teachers.id
      JOIN rooms ON lessons.room_id = rooms.id
      JOIN groups ON lessons.group_id = groups.id
      JOIN time_slots ON lessons.time_slot_id = time_slots.id
    `;
    res.json(await dbAll(query));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/freetimes/:teacher_id', async (req, res) => {
  try {
    const { teacher_id } = req.params;
    const days = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const slots = await dbAll('SELECT * FROM time_slots ORDER BY start ASC');
    const busy = await dbAll('SELECT day, time_slot_id FROM lessons WHERE teacher_id = ?', [teacher_id]);

    const availabilityMatrix = days.map(day => ({
      day,
      slots: slots.filter(s => !busy.some(b => b.day === day && b.time_slot_id === s.id))
    }));
    res.json(availabilityMatrix);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROTECTED MUTATION INJECTORS ---
app.post('/api/teachers', checkAuth, async (req, res) => {
  try {
    const { name, language } = req.body;
    if(!name || !language) return res.status(400).json({error: 'Ma\'lumotlar to\'liq emas!'});
    const result = await dbRun('INSERT INTO teachers (name, language) VALUES (?, ?)', [name, language]);
    res.json(result);
  } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.delete('/api/teachers/:id', checkAuth, async (req, res) => {
  try { res.json(await dbRun('DELETE FROM teachers WHERE id = ?', [req.params.id])); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.post('/api/rooms', checkAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if(!name) return res.status(400).json({error: 'Xona nomi bo\'sh bo\'lishi mumkin emas!'});
    res.json(await dbRun('INSERT INTO rooms (name) VALUES (?)', [name]));
  } catch(e:any){ res.status(500).json({error: 'Bu xona nomi allaqachon mavjud!'}); }
});

app.delete('/api/rooms/:id', checkAuth, async (req, res) => {
  try { res.json(await dbRun('DELETE FROM rooms WHERE id = ?', [req.params.id])); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.post('/api/groups', checkAuth, async (req, res) => {
  try {
    const { name, type, level, resource_book } = req.body;
    if(!name || !type || !level || !resource_book) return res.status(400).json({error: 'Barcha maydonlarni to\'ldiring!'});
    res.json(await dbRun('INSERT INTO groups (name, type, level, resource_book) VALUES (?, ?, ?, ?)', [name, type, level, resource_book]));
  } catch(e:any){ res.status(500).json({error: 'Bu guruh nomi allaqachon mavjud!'}); }
});

app.delete('/api/groups/:id', checkAuth, async (req, res) => {
  try { res.json(await dbRun('DELETE FROM groups WHERE id = ?', [req.params.id])); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.post('/api/lessons', checkAuth, async (req, res) => {
  try {
    const { day, time_slot_id, room_id, group_id, teacher_id } = req.body;

    // Hard block real-time operational conflicts safely at server layer
    if (await dbGet('SELECT id FROM lessons WHERE day=? AND time_slot_id=? AND room_id=?', [day, time_slot_id, room_id])) {
      return res.status(400).json({ error: 'Struktura xatosi: Tanlangan xonada bu vaqtda dars bor!' });
    }
    if (await dbGet('SELECT id FROM lessons WHERE day=? AND time_slot_id=? AND teacher_id=?', [day, time_slot_id, teacher_id])) {
      return res.status(400).json({ error: 'Konflikt: O\'qituvchi ayni shu vaqt oralig\'ida boshqa guruhda band!' });
    }
    if (await dbGet('SELECT id FROM lessons WHERE day=? AND time_slot_id=? AND group_id=?', [day, time_slot_id, group_id])) {
      return res.status(400).json({ error: 'Konflikt: Guruhning ayni shu vaqtda darsi rejalashtirilgan!' });
    }

    const output = await dbRun('INSERT INTO lessons (day, time_slot_id, room_id, group_id, teacher_id) VALUES (?, ?, ?, ?, ?)', [day, time_slot_id, room_id, group_id, teacher_id]);
    res.json(output);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lessons/:id', checkAuth, async (req, res) => {
  try { res.json(await dbRun('DELETE FROM lessons WHERE id = ?', [req.params.id])); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.get('/api/attendance', async (_req, res) => {
  try { res.json(await dbAll('SELECT * FROM attendance')); } catch(e:any){ res.status(500).json({error: e.message}); }
});

app.post('/api/attendance', checkAuth, async (req, res) => {
  try {
    const { lesson_id, date, status } = req.body;
    if(!lesson_id || !date || !status) return res.status(400).json({error: 'Davomat ma\'lumotlari to\'liq emas!'});
    res.json(await dbRun('INSERT INTO attendance (lesson_id, date, status) VALUES (?, ?, ?) ON CONFLICT(lesson_id, date) DO UPDATE SET status=excluded.status', [lesson_id, date, status]));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Engine boot array
initDb().then(() => {
  app.listen(PORT, () => console.log(`[SYSTEM CONFIRMED] Server executing seamlessly on infrastructure channel port: ${PORT}`));
}).catch(err => {
  console.error("[CRITICAL BOOT FAILURE]", err);
});
