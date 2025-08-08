import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

// sqlite database setup
const db = new Database(path.join(__dirname, 'data.db'));

db.prepare(`CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  task_status TEXT,
  transport_type TEXT,
  eta TEXT,
  payment_status TEXT
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT,
  url TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`).run();

// seed sample people on first run
const { c: peopleCount } = db.prepare('SELECT COUNT(*) as c FROM people').get();
if (peopleCount === 0) {
  const seed = db.prepare('INSERT INTO people (name, task_status, transport_type, eta, payment_status) VALUES (?, ?, ?, ?, ?)');
  seed.run('Alice', 'pending', 'car', '', 'unpaid');
  seed.run('Bob', 'pending', 'plane', '', 'unpaid');
}

// file upload config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true); else cb(new Error('Invalid file type'));
  }
});

// routes
app.get('/people', (req, res) => {
  const rows = db.prepare('SELECT * FROM people').all();
  res.json(rows);
});

app.patch('/people/:id', (req, res) => {
  const { id } = req.params;
  const fields = ['task_status', 'transport_type', 'eta', 'payment_status'];
  const updates = [];
  const params = [];
  for (const field of fields) {
    if (field in req.body) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }
  if (updates.length === 0) {
    return res.status(400).json({ message: 'No valid fields provided' });
  }
  params.push(id);
  const stmt = db.prepare(`UPDATE people SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...params);
  const person = db.prepare('SELECT * FROM people WHERE id = ?').get(id);
  res.json(person);
});

app.get('/gallery', (req, res) => {
  const rows = db.prepare('SELECT * FROM gallery ORDER BY uploaded_at DESC').all();
  res.json(rows);
});

app.post('/gallery/upload', upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const stmt = db.prepare('INSERT INTO gallery (filename, url) VALUES (?, ?)');
  const result = stmt.run(req.file.originalname, url);
  res.json({ id: result.lastInsertRowid, url });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

