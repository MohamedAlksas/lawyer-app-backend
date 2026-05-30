import { authenticate } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.addHook('onRequest', [authenticate]);

  fastify.get('/stats', async (request) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const caseWhere = {};
    const sessionWhere = {};

    if (request.user.role === 'LAWYER') {
      caseWhere.assignedLawyerId = request.user.id;
      sessionWhere.case = { assignedLawyerId: request.user.id };
    }

    const [activeCases, todaySessions, upcomingDeadlines] = await Promise.all([
      prisma.case.count({ where: { ...caseWhere, status: 'ACTIVE' } }),
      prisma.session.count({
        where: {
          ...sessionWhere,
          sessionDate: { gte: today, lt: tomorrow },
        },
      }),
      prisma.case.count({
        where: {
          ...caseWhere,
          status: 'ACTIVE',
          limitationDeadline: { lte: thirtyDaysFromNow, gte: new Date() },
        },
      }),
    ]);

    return { activeCases, todaySessions, upcomingDeadlines };
  });
}
