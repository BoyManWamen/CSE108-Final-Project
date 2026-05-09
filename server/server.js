const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../')));

const players = {};
const flags = {
  red:  { x: 580, y: 170, homeX: 580, homeY: 170, carriedBy: null },
  blue: { x:  40, y: 170, homeX:  40, homeY: 170, carriedBy: null },
};
let zones = [];
const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('A player connected:', socket.id);

  const team = Object.keys(players).length % 2 === 0 ? 'blue' : 'red';
  players[socket.id] = {
    id: socket.id,
    x: team === 'blue' ? 60 : 39940,
    y: 120,
    radius: 8,
    team: team,
    score: 0
  };

  socket.emit('currentPlayers', players);
  socket.emit('flagUpdate', flags);
  
  socket.broadcast.emit('newPlayer', players[socket.id]);

  socket.on('playerMovement', (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].lastDx = movementData.lastDx;
      players[socket.id].lastDy = movementData.lastDy;
      
      socket.broadcast.emit('playerMoved', players[socket.id]);
    }
  });

  socket.on('pickupFlag', (flagColor) => {
    if (flags[flagColor] && !flags[flagColor].carriedBy) {
      flags[flagColor].carriedBy = socket.id;
      io.emit('flagUpdate', flags);
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    if (flags.red.carriedBy === socket.id) flags.red.carriedBy = null;
    if (flags.blue.carriedBy === socket.id) flags.blue.carriedBy = null;

    delete players[socket.id];
    
    io.emit('playerDisconnected', socket.id);
    io.emit('flagUpdate', flags); 
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});