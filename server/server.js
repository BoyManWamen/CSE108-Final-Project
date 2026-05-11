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
      'SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]
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

const TILE = 20;
const COLS = 100;
const ROWS = 60;

const MAP_W = COLS * TILE;
const MAP_H = ROWS * TILE;

const GAME_DURATION          = 120;
const ZONE_COUNT             = 6;
const ZONE_RADIUS            = 16;
const ZONE_RESPAWN_MS        = 3000;
const MIN_ZONE_DISTANCE      = 80;
const ZONE_ACTIVATE_DISTANCE = 600;
const ZONE_DESPAWN_DISTANCE  = 800;

const ZONE_TYPES = [
  { color: '#e74c3c', label: 'Red Square'    },
  { color: '#3498db', label: 'Blue Square'   },
  { color: '#2ecc71', label: 'Green Square'  },
  { color: '#f1c40f', label: 'Yellow Square' },
  { color: '#9b59b6', label: 'Purple Square' },
];

const ZONE_GAME_TYPES = ['color', 'math', 'blank', 'typing'];

const players  = {};
const zones    = [];
let nextZoneId = 1;

let gameStartTime = Date.now();
let gameOver      = false;
let gameTimerInterval = null;

function getTimeLeft() {
  const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
  return Math.max(0, GAME_DURATION - elapsed);
}

function startGameTimer() {
  clearInterval(gameTimerInterval);
  gameOver      = false;
  gameStartTime = Date.now();

  gameTimerInterval = setInterval(() => {
    const left = getTimeLeft();
    io.emit('syncTime', left);

    if (left <= 0) {
      clearInterval(gameTimerInterval);
      gameOver = true;
      io.emit('gameOver');

      setTimeout(() => {
        startGameTimer();
        resetScores();
        io.emit('gameRestarted');
      }, 10_000);
    }
  }, 1000);
}

function resetScores() {
  Object.values(players).forEach(p => { p.score = 0; });
  io.emit('scoresReset');
}

const AI = {
  x:              MAP_W / 2,
  y:              MAP_H / 2,
  team:           'red',
  angle:          0,
  speed:          2.5,
  targetX:        MAP_W / 2,
  targetY:        MAP_H / 2,
  waypointX:      null,
  waypointY:      null,
  waypointRadius: 15,
  hitZoneCooldown: 0,

  think() {
    if (this.hitZoneCooldown > 0) { this.hitZoneCooldown--; return; }

    let closestZone = null;
    let closestDist = Infinity;
    zones.forEach(zone => {
      if (!zone.active) return;
      const dist = Math.hypot(zone.x - this.x, zone.y - this.y);
      if (dist < closestDist) { closestDist = dist; closestZone = zone; }
    });

    if (closestZone) {
      this.targetX = closestZone.x;
      this.targetY = closestZone.y;
      return;
    }

    const atWaypoint = this.waypointX === null ||
      Math.hypot(this.waypointX - this.x, this.waypointY - this.y) < this.waypointRadius;
    if (atWaypoint) this.setWaypoint();
    this.targetX = this.waypointX;
    this.targetY = this.waypointY;
  },

  setWaypoint() {
    let wx, wy;
    do {
      wx = 10 + Math.random() * (MAP_W - 20);
      wy = 10 + Math.random() * (MAP_H - 20);
    } while (Math.hypot(wx - this.x, wy - this.y) < 100);
    this.waypointX = wx;
    this.waypointY = wy;
  },

  move() {
    const dx   = this.targetX - this.x;
    const dy   = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 1) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
    this.angle = Math.atan2(dy, dx);
    this.x = Math.max(10, Math.min(this.x, MAP_W - 10));
    this.y = Math.max(10, Math.min(this.y, MAP_H - 10));
  },

  step() {
    this.think();
    this.move();

    zones.forEach(zone => {
      if (!zone.active) return;
      if (Math.hypot(this.x - zone.x, this.y - zone.y) < ZONE_RADIUS + 8) {
        zone.active     = false;
        zone.respawning = true;
        emitZones();
        this.hitZoneCooldown = 90;

        const aiWon = Math.random() < 0.7;
        setTimeout(() => {
          io.emit('aiMinigameResult', { won: aiWon });
          setTimeout(() => respawnZone(zone), ZONE_RESPAWN_MS);
        }, 1500 + Math.random() * 2000);
      }
    });
  },
};

setInterval(() => {
  AI.step();
  io.emit('aiMoved', { x: AI.x, y: AI.y, angle: AI.angle, team: AI.team });
}, 1000 / 30);

function clampZonePosition(x, y) {
  return {
    x: Math.max(ZONE_RADIUS + 10, Math.min(x, MAP_W - ZONE_RADIUS - 10)),
    y: Math.max(ZONE_RADIUS + 10, Math.min(y, MAP_H - ZONE_RADIUS - 10)),
  };
}

function isTooClose(x, y) {
  return zones.some(zone => Math.hypot(zone.x - x, zone.y - y) < MIN_ZONE_DISTANCE);
}

function createZone(position) {
  const type     = ZONE_TYPES[Math.floor(Math.random() * ZONE_TYPES.length)];
  const gameType = ZONE_GAME_TYPES[Math.floor(Math.random() * ZONE_GAME_TYPES.length)];
  const zone = {
    id: nextZoneId++,
    x: position.x,
    y: position.y,
    color:      type.color,
    label:      type.label,
    gameType,
    active:     true,
    respawning: false,
  };
  zones.push(zone);
  return zone;
}

function spawnZoneNear(cx, cy) {
  const range = Math.min(400, MAP_W / 4);
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

function respawnZone(zone) {
  const current = zones.find(z => z.id === zone.id);
  if (!current) return;
  const type     = ZONE_TYPES[Math.floor(Math.random() * ZONE_TYPES.length)];
  const gameType = ZONE_GAME_TYPES[Math.floor(Math.random() * ZONE_GAME_TYPES.length)];
  const pos      = clampZonePosition(
    MAP_W / 2 + (Math.random() - 0.5) * MAP_W * 0.8,
    MAP_H / 2 + (Math.random() - 0.5) * MAP_H * 0.8,
  );
  current.x = pos.x; current.y = pos.y;
  current.color = type.color; current.label = type.label;
  current.gameType   = gameType;
  current.active     = true;
  current.respawning = false;
  emitZones();
}

function emitZones() {
  io.emit('zoneState', zones.filter(z => z.active || z.respawning));
}

function initializeZones() {
  if (zones.length > 0) return;
  while (zones.length < ZONE_COUNT) {
    spawnZoneNear(MAP_W / 2 + (Math.random() - 0.5) * MAP_W * 0.7,
                  MAP_H / 2 + (Math.random() - 0.5) * MAP_H * 0.7);
  }
  emitZones();
}

function triggerZone(socketId, zoneId, ack) {
  const zone = zones.find(z => z.id === zoneId && z.active && !z.respawning);
  if (!zone) { if (typeof ack === 'function') ack(false); return; }

  const player = players[socketId];
  if (!player || Math.hypot(player.x - zone.x, player.y - zone.y) > ZONE_RADIUS + 8) {
    if (typeof ack === 'function') ack(false); return;
  }

  zone.active     = false;
  zone.respawning = true;
  emitZones();
  if (typeof ack === 'function') ack(true);

  setTimeout(() => respawnZone(zone), ZONE_RESPAWN_MS);
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  const team = Object.keys(players).length % 2 === 0 ? 'blue' : 'red';
  players[socket.id] = {
    id:     socket.id,
    x:      team === 'blue' ? 60 : MAP_W - 60,
    y:      MAP_H / 2,
    radius: 8,
    team,
    score:  0,
    name:   'Player',
  };

  initializeZones();
  socket.emit('currentPlayers', players);
  socket.emit('aiState', { x: AI.x, y: AI.y, angle: AI.angle, team: AI.team });
  socket.emit('syncTime', getTimeLeft());
  socket.emit('mapConfig', { TILE, COLS, ROWS });

  socket.on('setUsername', (name) => {
    if (!players[socket.id]) return;
    players[socket.id].name = name;
    socket.broadcast.emit('newPlayer', players[socket.id]);
    socket.broadcast.emit('playerUpdated', { id: socket.id, name });
  });

  socket.on('playerMovement', (data) => {
    if (!players[socket.id]) return;
    const p = players[socket.id];
    p.x      = Math.max(8, Math.min(data.x, MAP_W - 8));
    p.y      = Math.max(8, Math.min(data.y, MAP_H - 8));
    p.lastDx = data.lastDx;
    p.lastDy = data.lastDy;
    socket.broadcast.emit('playerMoved', p);
  });

  socket.on('zoneTriggered', (data, ack) => {
    triggerZone(socket.id, data?.zoneId, ack);
  });

  socket.on('minigameWin', async (data) => {
    if (gameOver) return;
    try {
      await pool.query(
        'UPDATE users SET total_wins = total_wins + 1 WHERE username = $1',
        [data.name]
      );
    } catch (err) {
      console.error('Win persist error:', err);
    }
    if (players[socket.id]) players[socket.id].score = data.wins;
    io.emit('scoreUpdate', { id: data.id, name: data.name, wins: data.wins });
  });

  socket.on('requestRestart', () => {
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

initDB()
  .then(() => {
    startGameTimer();
    server.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
  })
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });