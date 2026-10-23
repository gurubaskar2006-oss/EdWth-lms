import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Announcement from '../models/Announcement.js';
import Doubt from '../models/Doubt.js';
import { createSocketIORedisAdapter } from '../services/redisService.js';
import { getJwtSecret } from '../config/environment.js';
import {
  startSession,
  getSession,
  markAttendance,
  stopSession,
  getActiveSessionsForTenant,
  AttendanceServiceUnavailableError
} from '../services/attendanceSessionService.js';

// In-memory state for socket presence tracking
const connectedUsers = new Map(); // socketId -> user info

export const setupSocketIO = async (io) => {
  // Attach Redis adapter for horizontal cross-instance scaling if available
  try {
    const adapter = await createSocketIORedisAdapter();
    if (adapter) {
      io.adapter(adapter);
    }
  } catch (err) {
    console.warn('⚠️ [Socket.io] Operating with local in-memory adapter:', err.message);
  }

  // Middleware: Authenticate incoming socket connections
  io.use(async (socket, next) => {
    try {
      let token = socket.handshake.auth?.token;

      if (!token && socket.handshake.headers.cookie) {
        const parsedCookies = cookie.parse(socket.handshake.headers.cookie);
        token = parsedCookies.jwt || parsedCookies.token;
      }

      if (!token) {
        // Fallback for mock users in development or local dev mode ONLY
        if (process.env.NODE_ENV !== 'production' && socket.handshake.auth?.mockUser) {
          const m = socket.handshake.auth.mockUser;
          socket.user = {
            id: m.id || m._id || m.studentId || `user-${socket.id}`,
            _id: m._id || m.id,
            name: m.name || 'User',
            email: m.email || '',
            role: (m.role || 'student').toLowerCase(),
            studentId: m.studentId || m.id,
            batchId: m.batchId || null,
            tenantId: m.tenantId || null
          };
          return next();
        }
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, getJwtSecret());
      
      let dbUser = null;
      if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(decoded.id)) {
        try {
          dbUser = await User.findById(decoded.id).select('-password').lean();
        } catch (err) {}
      }

      if (!dbUser && mongoose.connection.readyState === 1 && decoded.id) {
        try {
          dbUser = await User.findOne({
            $or: [
              { studentId: { $regex: new RegExp(`^${decoded.id}$`, 'i') } },
              { email: { $regex: new RegExp(`^${decoded.id}$`, 'i') } }
            ]
          }).select('-password').lean();
        } catch (err) {}
      }

      if (!dbUser && decoded.id && process.env.NODE_ENV !== 'production' && process.env.ENABLE_LEGACY_DATASHEET_FALLBACK === 'true') {
        const { getStudents } = await import('../database/db.js');
        const localStudents = getStudents();
        const matched = localStudents.find(s => 
          s.id === decoded.id || 
          s.studentId?.toLowerCase() === decoded.id?.toString().toLowerCase() || 
          s.email?.toLowerCase() === decoded.id?.toString().toLowerCase()
        );
        if (matched) {
          dbUser = {
            _id: matched.id || matched.studentId,
            name: matched.name,
            email: matched.email,
            role: (matched.role || 'student').toLowerCase(),
            studentId: matched.studentId,
            batchId: null,
            tenantId: null
          };
        }
      }

      const mockFallback = socket.handshake.auth?.mockUser || {};

      if (dbUser) {
        socket.user = {
          id: dbUser._id.toString(),
          _id: dbUser._id.toString(),
          name: dbUser.name,
          email: dbUser.email,
          role: (dbUser.role || 'student').toLowerCase(),
          studentId: dbUser.studentId,
          batchId: dbUser.batchId ? dbUser.batchId.toString() : null,
          tenantId: dbUser.tenantId ? dbUser.tenantId.toString() : null
        };
      } else {
        if (process.env.NODE_ENV === 'production') {
          return next(new Error('Authentication error: User record not found in database'));
        }
        socket.user = {
          id: decoded.id || mockFallback.id || `user-${socket.id}`,
          _id: decoded.id || mockFallback._id,
          name: mockFallback.name || 'Student',
          email: mockFallback.email || 'student@nexus.edu',
          role: (mockFallback.role || 'student').toLowerCase(),
          studentId: mockFallback.studentId || decoded.id,
          batchId: mockFallback.batchId || null,
          tenantId: mockFallback.tenantId || null
        };
      }

      next();
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        return next(new Error(`Authentication error: ${err.message}`));
      }
      // Allow connection with guest role in development only
      const mockFallback = socket.handshake.auth?.mockUser || {};
      socket.user = { 
        id: mockFallback.id || `anon-${socket.id}`, 
        name: mockFallback.name || 'Guest Student', 
        role: (mockFallback.role || 'student').toLowerCase() 
      };
      next();
    }
  });

  const broadcastPresence = () => {
    const stats = {
      total: connectedUsers.size,
      students: 0,
      trainers: 0,
      admins: 0
    };

    for (const u of connectedUsers.values()) {
      if (u.role === 'trainer') stats.trainers++;
      else if (u.role === 'admin' || u.role === 'superadmin') stats.admins++;
      else stats.students++;
    }

    io.emit('presence:update', stats);
  };

  io.on('connection', (socket) => {
    const user = socket.user || { id: socket.id, name: 'Anonymous', role: 'student' };
    connectedUsers.set(socket.id, user);

    // Join common and tenant-isolated rooms
    socket.join('global');
    if (user.tenantId) {
      socket.join(`tenant:${user.tenantId}`);
      if (user.role) {
        socket.join(`tenant:${user.tenantId}:role:${user.role}`);
        if (user.role === 'teacher') socket.join(`tenant:${user.tenantId}:role:trainer`);
        if (user.role === 'trainer') socket.join(`tenant:${user.tenantId}:role:teacher`);
      }
      if (user.id || user._id) {
        socket.join(`tenant:${user.tenantId}:user:${user.id || user._id}`);
      }
      if (user.batchId) {
        socket.join(`tenant:${user.tenantId}:batch:${user.batchId}`);
      }
    }
    if (user.role) {
      socket.join(`role:${user.role}`);
    }
    if (user.id || user._id) {
      socket.join(`user:${user.id || user._id}`);
    }
    if (user.batchId) {
      socket.join(`batch:${user.batchId}`);
    }

    console.log(`🔌 [Socket.io] Connected: ${user.name} (${user.role}) - Socket: ${socket.id}`);
    broadcastPresence();

    // Send active attendance session if one is running for user's tenant & batch
    const effectiveTenantId = user.tenantId || (process.env.NODE_ENV !== 'production' ? 'dev-tenant' : null);
    if (effectiveTenantId) {
      getActiveSessionsForTenant(effectiveTenantId, user.batchId)
        .then((sessions) => {
          for (const session of sessions) {
            socket.emit('attendance:prompt', {
              sessionId: session.sessionId || session.id,
              topic: session.topic,
              trainerName: session.trainerName,
              expiresAt: session.expiresAt,
              durationSeconds: Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)),
              batchId: session.batchId,
              tenantId: session.tenantId
            });
          }
        })
        .catch((err) => {
          console.warn('⚠️ [Attendance Prompt] Error checking active sessions:', err.message);
        });
    }

    // ----------------------------------------------------
    // LIVE ATTENDANCE (TRAINER STARTS, STUDENTS CONFIRM)
    // ----------------------------------------------------
    socket.on('attendance:start', async (payload) => {
      // Allow trainers and admins (case-insensitive)
      const currentRole = (user.role || '').toLowerCase();
      if (currentRole !== 'trainer' && currentRole !== 'admin' && currentRole !== 'superadmin') {
        console.warn(`⚠️ [Attendance] Unauthorized attempt by ${user.name} (${user.role})`);
        return socket.emit('error', { message: 'Unauthorized to start attendance' });
      }

      const effectiveTenantId = user.tenantId || (process.env.NODE_ENV !== 'production' ? 'dev-tenant' : null);
      if (!effectiveTenantId) {
        return socket.emit('error', { message: 'Tenant context required to start attendance session' });
      }

      const { batchId, durationSeconds = 60, topic = 'Daily Lecture Session' } = payload || {};

      let session;
      try {
        session = await startSession({
          tenantId: effectiveTenantId,
          batchId: batchId || user.batchId || null,
          trainerId: user.id || user._id,
          trainerName: user.name || 'Trainer',
          topic,
          durationSeconds
        });
      } catch (err) {
        console.error('❌ [Attendance] Failed to start session:', err.message);
        return socket.emit('error', {
          code: err.code || 'ATTENDANCE_ERROR',
          message: err.message || 'Could not start attendance session'
        });
      }

      const promptPayload = {
        sessionId: session.sessionId,
        topic: session.topic,
        trainerName: session.trainerName,
        expiresAt: session.expiresAt,
        durationSeconds: session.durationSeconds,
        batchId: session.batchId,
        tenantId: session.tenantId
      };

      // Broadcast prompt to target audience (strictly tenant-scoped in production)
      if (user.tenantId) {
        if (session.batchId) {
          io.to(`tenant:${user.tenantId}:batch:${session.batchId}`).emit('attendance:prompt', promptPayload);
        }
        io.to(`tenant:${user.tenantId}`).emit('attendance:prompt', promptPayload);
      }
      if (session.batchId) {
        io.to(`batch:${session.batchId}`).emit('attendance:prompt', promptPayload);
      }
      io.to('global').emit('attendance:prompt', promptPayload);
      io.emit('attendance:prompt', promptPayload);

      // Confirm to trainer
      socket.emit('attendance:session_started', {
        sessionId: session.sessionId,
        topic: session.topic,
        expiresAt: session.expiresAt,
        durationSeconds: session.durationSeconds,
        tenantId: session.tenantId,
        batchId: session.batchId
      });

      console.log(`📢 [Attendance] Session started: ${session.sessionId} ("${topic}") by ${user.name} for ${durationSeconds}s`);

      // Automatically expire session in Redis and notify clients
      setTimeout(async () => {
        try {
          const stopResult = await stopSession({
            tenantId: session.tenantId,
            sessionId: session.sessionId,
            requesterId: user.id || user._id,
            requesterRole: user.role || 'trainer'
          });

          if (stopResult.success) {
            const closedPayload = {
              sessionId: session.sessionId,
              totalConfirmed: stopResult.totalConfirmed
            };
            if (user.tenantId) {
              io.to(`tenant:${user.tenantId}`).emit('attendance:closed', closedPayload);
            }
            io.to('global').emit('attendance:closed', closedPayload);
            io.emit('attendance:closed', closedPayload);
          }
        } catch (err) {
          console.warn('⚠️ [Attendance Expiry] Error during automated session close:', err.message);
        }
      }, durationSeconds * 1000);
    });

    // Trainer stops attendance session early
    socket.on('attendance:stop', async ({ sessionId }) => {
      const currentRole = (user.role || '').toLowerCase();
      if (currentRole !== 'trainer' && currentRole !== 'admin' && currentRole !== 'superadmin') {
        return socket.emit('error', { message: 'Unauthorized to stop attendance session' });
      }

      const effectiveTenantId = user.tenantId || (process.env.NODE_ENV !== 'production' ? 'dev-tenant' : null);
      if (!effectiveTenantId || !sessionId) {
        return socket.emit('error', { message: 'Missing sessionId or tenant context' });
      }

      try {
        const stopResult = await stopSession({
          tenantId: effectiveTenantId,
          sessionId,
          requesterId: user.id || user._id,
          requesterRole: user.role
        });

        if (!stopResult.success) {
          return socket.emit('error', { message: stopResult.message });
        }

        const closedPayload = {
          sessionId,
          totalConfirmed: stopResult.totalConfirmed
        };

        if (user.tenantId) {
          io.to(`tenant:${user.tenantId}`).emit('attendance:closed', closedPayload);
        }
        io.to('global').emit('attendance:closed', closedPayload);
        io.emit('attendance:closed', closedPayload);
      } catch (err) {
        console.error('❌ [Attendance Stop] Error stopping session:', err.message);
        socket.emit('error', {
          code: err.code || 'ATTENDANCE_ERROR',
          message: err.message || 'Could not stop attendance session'
        });
      }
    });

    // Student marks attendance
    socket.on('attendance:mark', async ({ sessionId }) => {
      const effectiveTenantId = user.tenantId || (process.env.NODE_ENV !== 'production' ? 'dev-tenant' : null);
      if (!effectiveTenantId || !sessionId) {
        return socket.emit('attendance:result', {
          success: false,
          code: 'INVALID_PARAMETERS',
          message: 'Attendance session expired or invalid'
        });
      }

      let markResult;
      try {
        markResult = await markAttendance({
          tenantId: effectiveTenantId,
          sessionId,
          studentId: user.id || user._id || user.studentId || socket.id,
          studentName: user.name,
          studentEmail: user.email,
          studentBatchId: user.batchId,
          studentMongoId: user._id
        });
      } catch (err) {
        console.error('❌ [Attendance Mark] Error:', err.message);
        return socket.emit('attendance:result', {
          success: false,
          code: err.code || 'SERVICE_UNAVAILABLE',
          message: err.message || 'Attendance service temporarily unavailable.'
        });
      }

      if (!markResult.success) {
        return socket.emit('attendance:result', {
          success: false,
          code: markResult.code,
          message: markResult.message
        });
      }

      // Idempotent acknowledgement to student
      socket.emit('attendance:result', {
        success: true,
        alreadyRecorded: markResult.alreadyRecorded,
        message: markResult.message,
        sessionId
      });

      // If already recorded, do not broadcast duplicate tally
      if (markResult.alreadyRecorded) {
        return;
      }

      // Broadcast live update across all nodes via Socket.IO Redis adapter
      const liveTallyData = {
        sessionId,
        count: markResult.count,
        latestStudent: markResult.latestStudent
      };

      if (markResult.session?.trainerId) {
        io.to(`user:${markResult.session.trainerId}`).emit('attendance:live_tally', liveTallyData);
      }

      if (user.tenantId) {
        io.to(`tenant:${user.tenantId}:role:trainer`).emit('attendance:live_tally', liveTallyData);
        io.to(`tenant:${user.tenantId}:role:admin`).emit('attendance:live_tally', liveTallyData);
      }

      // Dev fallback role rooms
      io.to('role:trainer').emit('attendance:live_tally', liveTallyData);
      io.to('role:admin').emit('attendance:live_tally', liveTallyData);
    });

    // ----------------------------------------------------
    // LIVE ANNOUNCEMENT BROADCAST (PERSISTENT SOURCE OF TRUTH)
    // ----------------------------------------------------
    socket.on('announcement:broadcast', async ({ title, message, urgency = 'info', targetBatchId, isPlatformWide: reqPlatformWide }) => {
      const allowedRoles = ['trainer', 'teacher', 'admin', 'superadmin'];
      if (!allowedRoles.includes(user.role)) {
        return socket.emit('announcement:error', { message: 'Unauthorized to broadcast announcements' });
      }
      if (!title || !title.trim() || !message || !message.trim()) {
        return socket.emit('announcement:error', { message: 'Announcement title and message content are required' });
      }

      const isSuperAdmin = user.role === 'superadmin';
      let annTenantId = user.tenantId && mongoose.Types.ObjectId.isValid(user.tenantId) ? user.tenantId : null;
      let isPlatformWide = false;

      if (!annTenantId) {
        if (isSuperAdmin) {
          isPlatformWide = true;
          annTenantId = null;
        } else {
          return socket.emit('announcement:error', { message: 'Tenant context required for announcement broadcast' });
        }
      }

      // If batchId is specified, ensure it belongs to the publisher's tenant
      let resolvedBatchId = null;
      if (targetBatchId) {
        if (!mongoose.Types.ObjectId.isValid(targetBatchId)) {
          return socket.emit('announcement:error', { message: 'Invalid cohort identifier' });
        }
        if (annTenantId) {
          const b = await Batch.findOne({ _id: targetBatchId, tenantId: annTenantId }).lean();
          if (!b) {
            return socket.emit('announcement:error', { message: 'Target cohort does not belong to your authorized institution' });
          }
          resolvedBatchId = b._id;
        }
      }

      let createdAnn = null;
      try {
        createdAnn = await Announcement.create({
          tenantId: annTenantId,
          isPlatformWide,
          batchId: resolvedBatchId,
          batchName: 'All Classes',
          authorId: user.id || user._id,
          authorName: user.name || 'Educator',
          title: title.trim(),
          content: message.trim(),
          priority: urgency === 'critical' ? 'urgent' : urgency === 'warning' ? 'important' : 'normal',
          status: 'published',
          publishedAt: new Date()
        });
      } catch (dbErr) {
        console.error('[Socket.io] Error persisting announcement to MongoDB:', dbErr.message);
        return socket.emit('announcement:error', { message: 'Failed to persist announcement to database. Broadcast cancelled.' });
      }

      if (!createdAnn) {
        return socket.emit('announcement:error', { message: 'Failed to persist announcement to database. Broadcast cancelled.' });
      }

      const announcement = {
        id: createdAnn._id.toString(),
        _id: createdAnn._id,
        batchId: createdAnn.batchId,
        title: createdAnn.title,
        message: createdAnn.content,
        content: createdAnn.content,
        urgency,
        priority: createdAnn.priority,
        senderName: user.name,
        authorName: user.name,
        senderRole: user.role,
        isPlatformWide,
        timestamp: createdAnn.publishedAt.toISOString()
      };

      if (isPlatformWide) {
        io.emit('announcement:new', announcement);
      } else if (targetBatchId) {
        io.to(`tenant:${annTenantId}:batch:${targetBatchId}`).emit('announcement:new', announcement);
        io.to(`tenant:${annTenantId}:role:trainer`).emit('announcement:new', announcement);
        io.to(`tenant:${annTenantId}:role:teacher`).emit('announcement:new', announcement);
        io.to(`tenant:${annTenantId}:role:admin`).emit('announcement:new', announcement);
      } else {
        io.to(`tenant:${annTenantId}`).emit('announcement:new', announcement);
      }

      socket.emit('announcement:broadcast_success', {
        id: createdAnn._id.toString(),
        title: createdAnn.title,
        timestamp: announcement.timestamp
      });
    });

    // ----------------------------------------------------
    // LIVE STUDENT DOUBT / ASSISTANCE QUEUE (MONGODB-BACKED)
    // ----------------------------------------------------
    socket.on('doubt:raise', async ({ subject, topic, question, codeSnippet, teacherId, teacherName }) => {
      if (!question || !question.trim()) {
        return socket.emit('doubt:error', { message: 'Question content is required' });
      }
      if (!user.tenantId || !mongoose.Types.ObjectId.isValid(user.tenantId)) {
        return socket.emit('doubt:error', { message: 'Tenant context required to submit questions' });
      }

      let savedDoubt = null;
      try {
        let resolvedTeacherId = teacherId && mongoose.Types.ObjectId.isValid(teacherId) ? teacherId : null;
        let resolvedTeacherName = teacherName ? teacherName.split('(')[0].trim() : 'Subject Teacher';

        if (resolvedTeacherId) {
          const verifiedTeacher = await User.findOne({
            _id: resolvedTeacherId,
            tenantId: user.tenantId,
            role: { $in: ['trainer', 'teacher', 'admin', 'superadmin'] }
          }).lean();
          if (!verifiedTeacher) {
            return socket.emit('doubt:error', { message: 'Selected teacher is not an authorized educator in your institution' });
          }
          resolvedTeacherName = verifiedTeacher.name;
        } else {
          const anyTrainer = await User.findOne({ tenantId: user.tenantId, role: { $in: ['trainer', 'teacher'] } }).lean();
          if (anyTrainer) {
            resolvedTeacherId = anyTrainer._id;
            resolvedTeacherName = anyTrainer.name;
          }
        }

        savedDoubt = await Doubt.create({
          tenantId: user.tenantId,
          studentId: user.id || user._id,
          studentName: user.name || 'Student',
          studentIdNumber: user.studentId || '',
          teacherId: resolvedTeacherId || null,
          teacherName: resolvedTeacherName,
          subject: subject || 'General Academic Doubt',
          topic: topic || 'General Doubt',
          question: question.trim(),
          codeSnippet: codeSnippet || '',
          status: 'submitted'
        });
      } catch (dbErr) {
        console.error('[Socket.io] Error persisting doubt:', dbErr.message);
        return socket.emit('doubt:error', { message: 'Failed to record question' });
      }

      if (!savedDoubt) {
        return socket.emit('doubt:error', { message: 'Failed to record question' });
      }

      const doubtItem = {
        id: savedDoubt._id.toString(),
        _id: savedDoubt._id,
        studentId: user.studentId || user.id,
        studentName: user.name,
        subject: savedDoubt.subject,
        topic: savedDoubt.topic,
        question: savedDoubt.question,
        codeSnippet: savedDoubt.codeSnippet,
        createdAt: savedDoubt.createdAt.toISOString(),
        status: 'Submitted',
        tenantId: user.tenantId
      };

      io.to(`tenant:${user.tenantId}:role:trainer`).emit('doubt:new', doubtItem);
      io.to(`tenant:${user.tenantId}:role:teacher`).emit('doubt:new', doubtItem);
      io.to(`tenant:${user.tenantId}:role:admin`).emit('doubt:new', doubtItem);
      socket.emit('doubt:ack', { success: true, doubtId: doubtItem.id });
    });

    socket.on('doubt:resolve', async ({ doubtId, reply }) => {
      const allowedRoles = ['trainer', 'teacher', 'admin', 'superadmin'];
      if (!allowedRoles.includes(user.role)) return;
      if (!doubtId) return;

      let resolvedDoubt = null;
      if (mongoose.Types.ObjectId.isValid(doubtId) && user.tenantId) {
        try {
          resolvedDoubt = await Doubt.findOneAndUpdate(
            { _id: doubtId, tenantId: user.tenantId },
            {
              status: 'answered',
              response: (reply || 'Resolved by instructor').trim(),
              repliedAt: new Date(),
              teacherId: user.id || user._id,
              teacherName: user.name || 'Educator',
              $push: {
                replies: {
                  authorId: user.id || user._id,
                  authorName: user.name || 'Educator',
                  authorRole: user.role === 'teacher' ? 'teacher' : 'trainer',
                  text: (reply || 'Resolved by instructor').trim(),
                  createdAt: new Date()
                }
              }
            },
            { new: true }
          );
        } catch (dbErr) {
          console.error('[Socket.io] Error resolving doubt in DB:', dbErr.message);
        }
      }

      const item = {
        id: doubtId,
        status: 'Answered',
        reply: reply || 'Resolved by instructor',
        resolvedBy: user.name
      };

      if (user.tenantId) {
        io.to(`tenant:${user.tenantId}:role:trainer`).emit('doubt:updated', item);
        if (resolvedDoubt?.studentId) {
          io.to(`user:${resolvedDoubt.studentId}`).emit('doubt:resolved', item);
        }
      } else {
        io.to('role:trainer').emit('doubt:updated', item);
      }
    });

    // Handle Disconnect
    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
      console.log(`🔌 [Socket.io] Disconnected: ${user.name} - Socket: ${socket.id}`);
      broadcastPresence();
    });
  });
};
