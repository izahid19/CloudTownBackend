import { Server, Socket } from 'socket.io';
import { sessionManager, Player } from './session';
import { User } from './models/User';

interface JoinRoomData {
  roomId: string;
  userId: string;
  userName: string;
  userImage?: string;
  userProfile?: Player['profile'];
}

interface MovePlayerData {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
}

export function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    let currentRoom: string | null = null;
    let currentUserId: string | null = null;

    // Join a room
    socket.on('joinRoom', async (data: JoinRoomData) => {
      let { roomId, userId, userName, userImage, userProfile } = data;

      if (!roomId || !userId || !userName) {
        socket.emit('error', { message: 'Invalid join data' });
        return;
      }

      // Backend Persistence Logic: Fetch/Upsert User
      try {
        let user = await User.findOne({ userId });
        
        if (user) {
          // If user exists in DB, use their stored profile as source of truth
          userName = user.username;
          userProfile = {
            username: user.username,
            about: user.about || '',
            linkedin: user.linkedin || undefined,
            twitter: user.twitter || undefined,
            portfolio: user.portfolio || undefined,
            github: user.github || undefined,
          };
        } else {
          // New user, save them to DB
          await User.create({
            userId,
            username: userName,
            about: userProfile?.about || '',
            linkedin: userProfile?.linkedin,
            twitter: userProfile?.twitter,
            portfolio: userProfile?.portfolio,
            github: userProfile?.github,
          });
        }
      } catch (err) {
        console.error('Error fetching/saving user:', err);
      }

      // Check if already in a room
      if (currentRoom) {
        socket.leave(currentRoom);
        sessionManager.removePlayer(currentRoom, currentUserId!);
        socket.to(currentRoom).emit('playerLeft', { id: currentUserId });
      }

      // Create player with random spawn offset
      const spawnOffsetX = Math.floor(Math.random() * 200) - 100;
      const spawnOffsetY = Math.floor(Math.random() * 200) - 100;

      const player: Player = {
        id: userId,
        socketId: socket.id,
        name: userName,
        image: userImage,
        x: 800 + spawnOffsetX,
        y: 600 + spawnOffsetY,
        direction: 'down',
        isMoving: false,
        room: roomId,
        joinedAt: Date.now(),
        profile: userProfile,
      };

      // Add to room
      sessionManager.addPlayer(roomId, player);
      socket.join(roomId);
      currentRoom = roomId;
      currentUserId = userId;

      // Get existing players
      const existingPlayers = sessionManager.getPlayersInRoom(roomId)
        .filter(p => p.id !== userId);

      // Send success to joining player with existing players
      socket.emit('joinedRoom', {
        players: existingPlayers.map(p => ({
          id: p.id,
          name: p.name,
          image: p.image,
          x: p.x,
          y: p.y,
          direction: p.direction,
          isMoving: p.isMoving,
          profile: p.profile,
        })),
        // Send back the authoritative profile so client can update if needed (will require client update)
        myProfile: userProfile 
      });

      // Notify others about new player
      socket.to(roomId).emit('playerJoined', {
        id: player.id,
        name: player.name,
        image: player.image,
        x: player.x,
        y: player.y,
        direction: player.direction,
        isMoving: player.isMoving,
        profile: player.profile,
      });

      console.log(`[Socket] ${userName} joined room ${roomId}`);
    });

    // ... (move handler unchanged)

    // Update Profile
    socket.on('updateProfile', async (profile: Player['profile']) => {
      if (!currentRoom || !currentUserId) return;

      const player = sessionManager.updatePlayer(currentRoom, currentUserId, {
        profile,
        name: profile?.username || 'Unknown',
      });

      if (player) {
         // Persist to DB
         try {
           await User.findOneAndUpdate(
             { userId: currentUserId },
             { 
               username: profile?.username,
               about: profile?.about,
               linkedin: profile?.linkedin,
               twitter: profile?.twitter,
               portfolio: profile?.portfolio,
               github: profile?.github,
               lastSeen: Date.now()
             },
             { upsert: true }
           );
         } catch(err) {
           console.error('Error updating profile in DB:', err);
         }

        // Broadcast profile update to everyone in room
        socket.to(currentRoom).emit('playerProfileUpdated', {
          id: currentUserId,
          profile,
          name: player.name,
        });
        
        // Also confirm back to sender
        socket.emit('profileUpdated', {
          profile,
          name: player.name,
        });
      }
    });

    // Object interaction
    socket.on('interact', (data: { objectId: string; action: string }) => {
      if (!currentRoom || !currentUserId) return;

      socket.to(currentRoom).emit('playerInteracted', {
        playerId: currentUserId,
        objectId: data.objectId,
        action: data.action,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (currentRoom && currentUserId) {
        sessionManager.removePlayer(currentRoom, currentUserId);
        socket.to(currentRoom).emit('playerLeft', { id: currentUserId });
        console.log(`[Socket] ${currentUserId} disconnected from ${currentRoom}`);
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}
