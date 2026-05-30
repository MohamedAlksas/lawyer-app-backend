import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import clientRoutes from './routes/clients.js';
import caseRoutes from './routes/cases.js';
import sessionRoutes from './routes/sessions.js';
import paymentRoutes from './routes/payments.js';
import documentRoutes from './routes/documents.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import { authenticate } from './middleware/auth.js';

const prisma = new PrismaClient();
const server = Fastify({ logger: true });

server.decorate('prisma', prisma);
server.decorate('authenticate', authenticate);

await server.register(cors, { origin: true, credentials: true });
await server.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

await server.register(authRoutes, { prefix: '/auth' });
await server.register(dashboardRoutes, { prefix: '/dashboard' });
await server.register(userRoutes, { prefix: '/users' });
await server.register(clientRoutes, { prefix: '/clients' });
await server.register(caseRoutes, { prefix: '/cases' });
await server.register(sessionRoutes, { prefix: '/sessions' });
await server.register(paymentRoutes, { prefix: '/payments' });
await server.register(documentRoutes, { prefix: '/documents' });
await server.register(notificationRoutes, { prefix: '/notifications' });

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    await server.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

import('./utils/notificationScheduler.js').catch(() => {});
