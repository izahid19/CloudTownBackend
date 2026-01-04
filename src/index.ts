import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupSockets } from './sockets';
import connectDB from './db';
import authRoutes from './routes/auth.routes';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const httpServer = createServer(app);

// Configure CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://cloud-town-henna.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Auth routes
app.use('/api/auth', authRoutes);

// Setup socket handlers
setupSockets(io);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: io.engine.clientsCount });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`🚀 CloudTown Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
});
