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
  // ssl: { rejectUnauthorized: false },
  ssl: false,
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

const GAME_DURATION = 120;
const players = {};
const ZONE_COUNT        = 3 + Math.floor(Math.random() * 6);
const ZONE_RADIUS       = 16;
const ZONE_RESPAWN_MS   = 3000;
const MIN_ZONE_DISTANCE = 80;
const ZONE_ACTIVATE_DISTANCE = 1000;
const ZONE_DESPAWN_DISTANCE  = 1200;
const ZONE_TYPES = [
  { color: '#e74c3c', label: 'Red Square'    },
  { color: '#3498db', label: 'Blue Square'   },
  { color: '#2ecc71', label: 'Green Square'  },
  { color: '#f1c40f', label: 'Yellow Square' },
  { color: '#9b59b6', label: 'Purple Square' },
];
const ZONE_GAME_TYPES = ['color', 'math', 'blank', 'typing'];
const zones = [];
let nextZoneId = 1;
let gameStartTime = Date.now();

function getTimeLeft() {
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  return Math.max(0, GAME_DURATION - elapsed);
}

function clampZonePosition(x, y) {
  return {
    x: Math.max(ZONE_RADIUS + 10, Math.min(x, 40000 - ZONE_RADIUS - 10)),
    y: Math.max(ZONE_RADIUS + 10, Math.min(y, 40000 - ZONE_RADIUS - 10)),
  };
}

function zoneAnchorFor(playerId, fallbackZone) {
  const player = players[playerId];
  if (player) return { x: player.x, y: player.y };
  return { x: fallbackZone.x, y: fallbackZone.y };
}

function isTooClose(x, y) {
  return zones.some(zone => Math.hypot(zone.x - x, zone.y - y) < MIN_ZONE_DISTANCE);
}

function createZone(position, options = {}) {
  const type = options.type || ZONE_TYPES[Math.floor(Math.random() * ZONE_TYPES.length)];
  const gameType = options.gameType || ZONE_GAME_TYPES[Math.floor(Math.random() * ZONE_GAME_TYPES.length)];
  const zone = {
    id: nextZoneId++,
    x: position.x,
    y: position.y,
    color: type.color,
    label: type.label,
    gameType,
    active: true,
    respawning: false,
    pulseT: 0,
  };
  zones.push(zone);
  return zone;
}

function spawnZoneNear(cx, cy) {
  const range = 800;
  let position;
  let attempts = 0;

  do {
    const x = cx + (Math.random() - 0.5) * range * 2;
    const y = cy + (Math.random() - 0.5) * range * 2;
    position = clampZonePosition(x, y);
    attempts++;
  } while (isTooClose(position.x, position.y) && attempts < 50);

  return createZone(position);
}

function emitZones() {
  io.emit('zoneState', zones.filter(zone => zone.active || zone.respawning));
}

function maintainZones() {
  const activePlayers = Object.values(players);
  const trackedZones = zones.filter(zone => zone.active || zone.respawning);

  zones.splice(0, zones.length, ...trackedZones.filter(zone => {
    if (zone.respawning) return true;
    return activePlayers.some(player => Math.hypot(zone.x - player.x, zone.y - player.y) <= ZONE_DESPAWN_DISTANCE);
  }));

  if (activePlayers.length === 0) {
    emitZones();
    return;
  }

  activePlayers.forEach(player => {
    const nearby = zones.filter(zone =>
      (zone.active || zone.respawning) && Math.hypot(zone.x - player.x, zone.y - player.y) < ZONE_ACTIVATE_DISTANCE
    );
    while (nearby.length < ZONE_COUNT) {
      nearby.push(spawnZoneNear(player.x, player.y));
    }
  });

  emitZones();
}

function initializeZones() {
  if (zones.length > 0) return;
  while (zones.length < ZONE_COUNT) {
    spawnZoneNear(60, 120);
  }
  emitZones();
}

function triggerZone(socketId, zoneId, ack) {
  const zone = zones.find(entry => entry.id === zoneId && entry.active && !entry.respawning);
  if (!zone) {
    if (typeof ack === 'function') ack(false);
    return;
  }

  const player = players[socketId];
  if (!player || Math.hypot(player.x - zone.x, player.y - zone.y) > ZONE_RADIUS + 8) {
    if (typeof ack === 'function') ack(false);
    return;
  }

  zone.active = false;
  zone.respawning = true;
  const anchor = zoneAnchorFor(socketId, zone);
  emitZones();

  if (typeof ack === 'function') ack(true);

  setTimeout(() => {
    const currentZone = zones.find(entry => entry.id === zone.id);
    if (!currentZone || currentZone.respawning !== true) return;
    const position = clampZonePosition(
      anchor.x + (Math.random() - 0.5) * 1600,
      anchor.y + (Math.random() - 0.5) * 1600
    );
    const type = ZONE_TYPES[Math.floor(Math.random() * ZONE_TYPES.length)];
    const gameType = ZONE_GAME_TYPES[Math.floor(Math.random() * ZONE_GAME_TYPES.length)];
    currentZone.x = position.x;
    currentZone.y = position.y;
    currentZone.color = type.color;
    currentZone.label = type.label;
    currentZone.gameType = gameType;
    currentZone.active = true;
    currentZone.respawning = false;
    currentZone.pulseT = 0;
    maintainZones();
  }, ZONE_RESPAWN_MS);
}

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

  initializeZones();
  maintainZones();
  socket.emit('currentPlayers', players);
  socket.emit('syncTime', getTimeLeft());

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
    maintainZones();
  });

  socket.on('zoneTriggered', (data, ack) => {
    triggerZone(socket.id, data?.zoneId, ack);
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

  socket.on('restartGame', () => {
    gameStartTime = Date.now();
    io.emit('syncTime', GAME_DURATION);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
    maintainZones();
  });
});

initDB().then(() => {
  server.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });