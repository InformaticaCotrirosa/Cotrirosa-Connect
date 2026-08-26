import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';
import initializeDatabase from './config/database.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import calendarRoutes from './routes/calendar.js';
import eventInvitationRoutes from './routes/eventInvitations.js';
import meetingRoomRoutes from './routes/meetingRooms.js';
import departmentRoutes from './routes/departments.js';
import notificationRoutes from './routes/notifications.js';

const app = express();
const httpServer = createServer(app);

// FRONTEND_URL pode ser uma origem ou várias separadas por vírgula (LAN + localhost)
const frontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:5174')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const corsOrigin = frontendOrigins.length === 1 ? frontendOrigins[0] : frontendOrigins;

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Armazenar io na app para usar em outras rotas
app.set('io', io);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/calendar-events', calendarRoutes);
app.use('/api/event-invitations', eventInvitationRoutes);
app.use('/api/meeting-rooms', meetingRoomRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);

// WebSocket
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`);

  socket.on('subscribe:calendar', (userId) => {
    socket.join(`calendar:${userId}`);
  });

  socket.on('subscribe:invitations', (userId) => {
    socket.join(`invitations:${userId}`);
  });

  socket.on('subscribe:notifications', (userId) => {
    socket.join(`notifications:${userId}`);
  });

  // Monitores de sala: recebem calendar:changed (broadcast global)
  socket.on('subscribe:monitor', () => {
    socket.join('calendar:monitor');
  });

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`);
  });
});

// Erro 404
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Tratador de erros global
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor'
  });
});

// Inicializar aplicação
const PORT = process.env.PORT || 3010;

initializeDatabase()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Falha ao inicializar:', error);
    if (error?.code === 'NJS-516') {
      console.error(
        'Dica Oracle: alias TNS sem tnsnames.ora. No Linux use Easy Connect ' +
          '(ORACLE_CONNECTION_STRING=host:1521/SERVICO) ou configure TNS_ADMIN ' +
          'apontando para backend/oracle/network/admin (veja tnsnames.ora.example).'
      );
    }
    process.exit(1);
  });

export default app;
