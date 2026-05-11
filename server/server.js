const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');
const crypto     = require('crypto');
const { Pool }   = require('pg');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt          TEXT NOT NULL,
      total_wins    INTEGER NOT NULL DEFAULT 0,
      created_at    BIGINT NOT NULL DEFAULT extract(epoch from now())
    )
  `);
  console.log('Database ready.');
}

function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(plaintext, salt, 200_000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(plaintext, storedHash, salt) {
  const hash = crypto.pbkdf2Sync(plaintext, salt, 200_000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'All fields are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address.' });
  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Username or email already taken.' });
    const { salt, hash } = hashPassword(password);
    await pool.query(
      'INSERT INTO users (username, email, password_hash, salt) VALUES ($1, $2, $3, $4)',
      [username, email, hash, salt]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'All fields are required.' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Username not found.' });
    const user = result.rows[0];
    if (!verifyPassword(password, user.password_hash, user.salt))
      return res.status(401).json({ error: 'Incorrect password.' });
    res.json({ ok: true, username: user.username, totalWins: user.total_wins });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT username, total_wins FROM users ORDER BY total_wins DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

const players = {};

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);
  const team = Object.keys(players).length % 2 === 0 ? 'blue' : 'red';
  players[socket.id] = {
    id: socket.id,
    x: team === 'blue' ? 60 : 39940,
    y: 120,
    radius: 8,
    team,
    score: 0,
    name: 'Player',
  };

  socket.emit('currentPlayers', players);

  socket.on('setUsername', (name) => {
    if (players[socket.id]) {
      players[socket.id].name = name;
      socket.broadcast.emit('newPlayer', players[socket.id]);
      socket.broadcast.emit('playerUpdated', { id: socket.id, name });
    }
  });

  socket.on('playerMovement', (data) => {
    if (!players[socket.id]) return;
    Object.assign(players[socket.id], {
      x: data.x, y: data.y, lastDx: data.lastDx, lastDy: data.lastDy
    });
    socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  socket.on('minigameWin', async (data) => {
    try {
      await pool.query(
        'UPDATE users SET total_wins = total_wins + 1 WHERE username = $1',
        [data.name]
      );
    } catch (err) {
      console.error('Win persist error:', err);
    }
    io.emit('scoreUpdate', { id: data.id, name: data.name, wins: data.wins });
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

initDB().then(() => {
  server.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });