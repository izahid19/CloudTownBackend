# CloudTown Server

The backend server for CloudTown, providing real-time multiplayer functionality via Socket.io and persistence via MongoDB.

## Features

- **Real-time Multiplayer**: Powered by Socket.io for low-latency player movement and interaction.
- **Persistence**: MongoDB integration to save player profiles and state.
- **REST API**: Basic health check and potential future API endpoints.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express
- **WebSocket**: Socket.io
- **Database**: MongoDB (via Mongoose)
- **Language**: TypeScript

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```env
   PORT=5000
   FRONTEND_URL=http://localhost:3000
   DB_URL=mongodb+srv://...
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

## Development

The server runs on port `5000` by default. It listens for WebSocket connections and handles player join/leave/move events.
