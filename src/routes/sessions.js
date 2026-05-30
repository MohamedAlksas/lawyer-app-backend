import { authenticate } from '../middleware/auth.js';

export default async function sessionRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.addHook('onRequest', [authenticate]);

  fastify.get('/', async (request) => {
    const { date, lawyerId } = request.query;
    const where = {};

    if (date) {
      const dayStart = new Date(date);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      where.sessionDate = { gte: dayStart, lt: dayEnd };
    }

    if (lawyerId) {
      where.case = { assignedLawyerId: lawyerId };
    } else if (request.user.role === 'LAWYER') {
      where.case = { assignedLawyerId: request.user.id };
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        case: {
          select: {
            id: true, caseNumber: true, caseYear: true, caseType: true, courtName: true,
            client: { select: { id: true, fullName: true } },
            assignedLawyer: { select: { id: true, fullName: true } },
          },
        },
        attendedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { sessionDate: 'asc' },
    });

    return sessions;
  });

  fastify.get('/calendar', async (request) => {
    const { year, month, lawyerId } = request.query;
    const now = new Date();
    const y = year ? parseInt(year) : now.getFullYear();
    const m = month ? parseInt(month) - 1 : now.getMonth();

    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 1);

    const where = {
      sessionDate: { gte: monthStart, lt: monthEnd },
    };

    if (lawyerId) {
      where.case = { assignedLawyerId: lawyerId };
    } else if (request.user.role === 'LAWYER') {
      where.case = { assignedLawyerId: request.user.id };
    }

    const sessions = await prisma.session.findMany({
      where,
      select: {
        id: true, sessionDate: true, sessionTime: true, courtName: true, result: true,
        case: { select: { id: true, caseNumber: true, caseYear: true, caseType: true, assignedLawyerId: true } },
      },
      orderBy: { sessionDate: 'asc' },
    });

    return sessions;
  });

  fastify.get('/:id', async (request, reply) => {
    const session = await prisma.session.findUnique({
      where: { id: request.params.id },
      include: {
        case: {
          select: {
            id: true, caseNumber: true, caseYear: true, caseType: true, courtName: true,
            client: { select: { id: true, fullName: true } },
          },
        },
        attendedBy: { select: { id: true, fullName: true } },
      },
    });
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return session;
  });

  fastify.post('/', async (request, reply) => {
    const { caseId, sessionDate, sessionTime, courtName, result, nextSessionDate, notes, attendedById } = request.body;
    if (!caseId || !sessionDate || !courtName) {
      return reply.status(400).send({ error: 'caseId, sessionDate, and courtName required' });
    }

    const session = await prisma.session.create({
      data: {
        caseId,
        sessionDate: new Date(sessionDate),
        sessionTime,
        courtName,
        result,
        nextSessionDate: nextSessionDate ? new Date(nextSessionDate) : null,
        notes,
        attendedById: attendedById || request.user.id,
      },
    });

    await prisma.action.create({
      data: {
        caseId,
        actionType: 'SESSION_ADDED',
        description: `Session added on ${sessionDate} at ${courtName}`,
        performedById: request.user.id,
        actionDate: new Date(),
      },
    });

    return reply.status(201).send(session);
  });

  fastify.put('/:id', async (request, reply) => {
    const { sessionDate, sessionTime, courtName, result, nextSessionDate, notes, attendedById } = request.body;
    const data = {};
    if (sessionDate !== undefined) data.sessionDate = new Date(sessionDate);
    if (sessionTime !== undefined) data.sessionTime = sessionTime;
    if (courtName !== undefined) data.courtName = courtName;
    if (result !== undefined) data.result = result;
    if (nextSessionDate !== undefined) data.nextSessionDate = nextSessionDate ? new Date(nextSessionDate) : null;
    if (notes !== undefined) data.notes = notes;
    if (attendedById !== undefined) data.attendedById = attendedById;

    try {
      const session = await prisma.session.update({ where: { id: request.params.id }, data });
      return session;
    } catch {
      return reply.status(404).send({ error: 'Session not found' });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    try {
      await prisma.session.delete({ where: { id: request.params.id } });
      return { message: 'Session deleted' };
    } catch {
      return reply.status(404).send({ error: 'Session not found' });
    }
  });
}
