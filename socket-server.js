const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins during development
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Expose an endpoint that Next.js API routes can hit to trigger a broadcast
app.post('/emit', (req, res) => {
  const { event, data } = req.body;
  if (!event) {
    return res.status(400).json({ error: 'Event name is required' });
  }

  // Broadcast to all connected clients
  io.emit(event, data);
  console.log(`Broadcasted event: ${event}`);
  
  res.json({ success: true, message: `Broadcasted ${event}` });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});
