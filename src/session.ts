export interface Player {
  id: string;
  socketId: string;
  name: string;
  image?: string;
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
  room: string;
  joinedAt: number;
  profile?: {
    username: string;
    about: string;
    linkedin?: string;
    twitter?: string;
    portfolio?: string;
    github?: string;
  };
}

export interface Room {
  id: string;
  players: Map<string, Player>;
  createdAt: number;
}

class SessionManager {
  private rooms: Map<string, Room> = new Map();

  getOrCreateRoom(roomId: string): Room {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        players: new Map(),
        createdAt: Date.now(),
      });
      console.log(`[Session] Created room: ${roomId}`);
    }
    return this.rooms.get(roomId)!;
  }

  addPlayer(roomId: string, player: Player): void {
    const room = this.getOrCreateRoom(roomId);
    room.players.set(player.id, player);
    console.log(`[Session] ${player.name} joined room ${roomId} (${room.players.size} players)`);
  }

  removePlayer(roomId: string, playerId: string): Player | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const player = room.players.get(playerId);
    room.players.delete(playerId);

    console.log(`[Session] Player ${playerId} left room ${roomId} (${room.players.size} players)`);

    // Clean up empty rooms
    if (room.players.size === 0) {
      this.rooms.delete(roomId);
      console.log(`[Session] Deleted empty room: ${roomId}`);
    }

    return player;
  }

  getPlayer(roomId: string, playerId: string): Player | undefined {
    const room = this.rooms.get(roomId);
    return room?.players.get(playerId);
  }

  getPlayersInRoom(roomId: string): Player[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.players.values());
  }

  updatePlayer(roomId: string, playerId: string, data: Partial<Player>): Player | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const player = room.players.get(playerId);
    if (!player) return undefined;

    Object.assign(player, data);
    return player;
  }

  getPlayerBySocketId(socketId: string): { room: Room; player: Player } | undefined {
    for (const room of this.rooms.values()) {
      for (const player of room.players.values()) {
        if (player.socketId === socketId) {
          return { room, player };
        }
      }
    }
    return undefined;
  }

  getRoomCount(): number {
    return this.rooms.size;
  }

  getTotalPlayerCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.players.size;
    }
    return count;
  }
}

export const sessionManager = new SessionManager();
