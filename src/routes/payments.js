import { authenticate } from '../middleware/auth.js';

export default async function paymentRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.addHook('onRequest', [authenticate]);

  fastify.get('/', async (request) => {
    const { caseId, clientId, page = 1, limit = 20 } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (caseId) where.caseId = caseId;
    if (clientId) where.clientId = clientId;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take,
        include: {
          client: { select: { id: true, fullName: true } },
          case: { select: { id: true, caseNumber: true, caseYear: true } },
        },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    return { data: payments, total, page: parseInt(page), limit: take };
  });

  fastify.post('/', async (request, reply) => {
    const { clientId, caseId, amount, paidAt, note } = request.body;
    if (!clientId || !caseId || amount === undefined) {
      return reply.status(400).send({ error: 'clientId, caseId, and amount required' });
    }

    const payment = await prisma.payment.create({
      data: {
        clientId, caseId,
        amount: parseFloat(amount),
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        note,
      },
    });

    return reply.status(201).send(payment);
  });

  fastify.put('/:id', async (request, reply) => {
    const { amount, paidAt, note } = request.body;
    const data = {};
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (paidAt !== undefined) data.paidAt = new Date(paidAt);
    if (note !== undefined) data.note = note;

    try {
      const payment = await prisma.payment.update({ where: { id: request.params.id }, data });
      return payment;
    } catch {
      return reply.status(404).send({ error: 'Payment not found' });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    try {
      await prisma.payment.delete({ where: { id: request.params.id } });
      return { message: 'Payment deleted' };
    } catch {
      return reply.status(404).send({ error: 'Payment not found' });
    }
  });
}
