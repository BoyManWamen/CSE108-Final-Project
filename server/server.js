const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the project root (one directory up from server/)
app.use(express.static(path.join(__dirname, '../')));

// ─── Server-Side Game State ──────────────────────────────────────────────────

const players = {};
const flags = {
  red:  { x: 580, y: 170, homeX: 580, homeY: 170, carriedBy: null },
  blue: { x:  40, y: 170, homeX:  40, homeY: 170, carriedBy: null },
};
let zones = []; // You will eventually move the zone generation logic here

const PORT = process.env.PORT || 3000;

// ─── Socket.IO Communication ─────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);

  // 1. Initialize new player
  // For now, alternate teams based on the number of connected players
  const team = Object.keys(players).length % 2 === 0 ? 'blue' : 'red';
  players[socket.id] = {
    id: socket.id,
    x: team === 'blue' ? 60 : 39940, // Base spawn points (assuming map width is 2000 * 20 = 40000)
    y: 120,
    radius: 8,
    team: team,
    score: 0
  };

  // 2. Send the current game state to the new player
  socket.emit('currentPlayers', players);
  socket.emit('flagUpdate', flags);
  
  // 3. Broadcast to all OTHER players that a new player joined
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // 4. Listen for player movement updates from this client
  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      // Update server's source of truth
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].lastDx = movementData.lastDx;
      players[socket.id].lastDy = movementData.lastDy;
      
      // Broadcast the updated position to all OTHER players
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  // 5. Handle flag pickup events
  socket.on('pickupFlag', (flagColor) => {
    if (flags[flagColor] && !flags[flagColor].carriedBy) {
      flags[flagColor].carriedBy = socket.id;
      io.emit('flagUpdate', flags); // Update everyone
    }
  });

  // 6. Handle player disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // If they were carrying a flag, drop it at their current location or reset it
    if (flags.red.carriedBy === socket.id) flags.red.carriedBy = null;
    if (flags.blue.carriedBy === socket.id) flags.blue.carriedBy = null;

    // Remove player from state
    delete players[socket.id];
    
    // Tell everyone else to remove this player from their screen
    io.emit('playerDisconnected', socket.id);
    io.emit('flagUpdate', flags); 
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});