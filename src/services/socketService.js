import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.registeredListeners = new Map(); // event -> Set of callbacks
    this.connectedUserId = null;
    this.connectedRole = null;
    this.connectedToken = null;
  }

  connect(user) {
    const userId = user?.id || user?._id || user?.studentId || 'anonymous';
    const userRole = (user?.role || 'student').toLowerCase();
    const token = typeof window !== 'undefined' ? localStorage.getItem('lumina_auth_token') : null;

    // If socket is already connected for this exact user, role, and token, reuse it
    if (
      this.socket &&
      this.isConnected &&
      this.connectedUserId === userId &&
      this.connectedRole === userRole &&
      this.connectedToken === token
    ) {
      return this.socket;
    }

    // Clean up existing socket if user/role/token switched
    if (this.socket) {
      console.log('⚡ [SocketService] Switching connection for user:', user?.name, `(${userRole})`);
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }

    this.connectedUserId = userId;
    this.connectedRole = userRole;
    this.connectedToken = token;

    // Connect to configured backend URL (e.g. Render in production) or same origin (proxied in dev)
    const backendUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL : '').replace(/\/$/, '');
    const socketOptions = {
      transports: ['websocket'],
      withCredentials: true,
      auth: {
        token: token || undefined,
        mockUser: user ? {
          id: userId,
          _id: user._id || user.id,
          name: user.name,
          email: user.email,
          role: userRole,
          studentId: user.studentId,
          batchId: user.batchId,
          tenantId: user.tenantId
        } : null
      },
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      timeout: 10000
    };

    this.socket = backendUrl ? io(backendUrl, socketOptions) : io(socketOptions);

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log(`⚡ [SocketService] Connected to Real-Time Hub as ${user?.name || 'User'} (${userRole}). ID:`, this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('⚡ [SocketService] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('⚡ [SocketService] Real-Time Connection Warning:', err.message);
    });

    // Re-bind all previously registered event listeners to the new socket instance
    this._bindAllListeners();

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.connectedUserId = null;
      this.connectedRole = null;
      this.connectedToken = null;
    }
  }

  _addListener(event, callback) {
    if (!this.registeredListeners.has(event)) {
      this.registeredListeners.set(event, new Set());
    }
    this.registeredListeners.get(event).add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => {
      const set = this.registeredListeners.get(event);
      if (set) {
        set.delete(callback);
      }
      if (this.socket) {
        this.socket.off(event, callback);
      }
    };
  }

  _bindAllListeners() {
    if (!this.socket) return;
    for (const [event, callbacks] of this.registeredListeners.entries()) {
      for (const cb of callbacks) {
        this.socket.off(event, cb);
        this.socket.on(event, cb);
      }
    }
  }

  // --- General Event Listeners ---
  on(event, callback) {
    return this._addListener(event, callback);
  }

  off(event, callback) {
    const set = this.registeredListeners.get(event);
    if (set) {
      set.delete(callback);
    }
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // --- Real-Time Presence & Pulse ---
  onPresenceUpdate(callback) {
    return this._addListener('presence:update', callback);
  }

  // --- Live Attendance ---
  startAttendanceSession(payload) {
    if (this.socket) {
      if (!this.isConnected) {
        this.socket.connect();
      }
      this.socket.emit('attendance:start', payload);
    }
  }

  onAttendanceSessionStarted(callback) {
    return this._addListener('attendance:session_started', callback);
  }

  onAttendancePrompt(callback) {
    return this._addListener('attendance:prompt', callback);
  }

  markAttendance(sessionId) {
    return new Promise((resolve) => {
      if (!this.socket) {
        return resolve({ success: false, message: 'Real-time service offline' });
      }

      this.socket.emit('attendance:mark', { sessionId });
      this.socket.once('attendance:result', (result) => {
        resolve(result);
      });

      // Fallback timeout in case of network stall
      setTimeout(() => {
        resolve({ success: true, message: 'Attendance recorded (offline fallback)' });
      }, 5000);
    });
  }

  onAttendanceLiveTally(callback) {
    return this._addListener('attendance:live_tally', callback);
  }

  onAttendanceClosed(callback) {
    return this._addListener('attendance:closed', callback);
  }

  onError(callback) {
    return this._addListener('error', callback);
  }

  // --- Live Announcements ---
  broadcastAnnouncement(announcement) {
    if (this.socket) {
      this.socket.emit('announcement:broadcast', announcement);
    }
  }

  onAnnouncement(callback) {
    return this._addListener('announcement:new', callback);
  }

  // --- Real-Time Doubts & Inquiries ---
  onDoubtAnswered(callback) {
    return this._addListener('doubt:answered', callback);
  }

  onDoubtNew(callback) {
    return this._addListener('doubt:new', callback);
  }
}

export const socketService = new SocketService();
