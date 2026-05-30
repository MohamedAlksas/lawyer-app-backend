import { authenticate } from '../middleware/auth.js';

export default async function notificationRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.addHook('onRequest', [authenticate]);

  fastify.get('/', async (request) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: request.user.id, isRead: false },
    });

    return { data: notifications, unreadCount };
  });

  fastify.put('/:id/read', async (request, reply) => {
    try {
      await prisma.notification.update({
        where: { id: request.params.id },
        data: { isRead: true },
      });
      return { message: 'Notification marked as read' };
    } catch {
      return reply.status(404).send({ error: 'Notification not found' });
    }
  });

  fastify.put('/read-all', async (request) => {
    await prisma.notification.updateMany({
      where: { userId: request.user.id, isRead: false },
      data: { isRead: true },
    });
    return { message: 'All notifications marked as read' };
  });
}
