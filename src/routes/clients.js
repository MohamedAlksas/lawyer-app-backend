import { authenticate, requireRole } from '../middleware/auth.js';

export default async function clientRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.addHook('onRequest', [authenticate]);

  fastify.get('/', async (request) => {
    const { search, page = 1, limit = 20 } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { fullNameAr: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { cases: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    return { data: clients, total, page: parseInt(page), limit: take };
  });

  fastify.get('/:id', async (request, reply) => {
    const client = await prisma.client.findUnique({
      where: { id: request.params.id },
      include: {
        cases: {
          include: { assignedLawyer: { select: { id: true, fullName: true } }, sessions: true, payments: true },
        },
        payments: true,
      },
    });
    if (!client) return reply.status(404).send({ error: 'Client not found' });

    const totalFee = client.cases.reduce((sum, c) => sum + c.agreedFee, 0);
    const totalPaid = client.payments.reduce((sum, p) => sum + p.amount, 0);

    return { ...client, financialSummary: { totalFee, totalPaid, remaining: totalFee - totalPaid } };
  });

  fastify.post('/', async (request, reply) => {
    const { fullName, fullNameAr, nationalId, phone, alternatePhone, address, email, notes } = request.body;
    if (!fullName || !nationalId || !phone) {
      return reply.status(400).send({ error: 'fullName, nationalId, and phone required' });
    }

    const existing = await prisma.client.findUnique({ where: { nationalId } });
    if (existing) {
      return reply.status(409).send({ error: 'Client with this national ID already exists' });
    }

    const client = await prisma.client.create({
      data: {
        fullName, fullNameAr, nationalId, phone, alternatePhone, address, email, notes,
        createdBy: request.user.id,
      },
    });
    return reply.status(201).send(client);
  });

  fastify.put('/:id', async (request, reply) => {
    const { fullName, fullNameAr, phone, alternatePhone, address, email, notes } = request.body;
    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (fullNameAr !== undefined) data.fullNameAr = fullNameAr;
    if (phone !== undefined) data.phone = phone;
    if (alternatePhone !== undefined) data.alternatePhone = alternatePhone;
    if (address !== undefined) data.address = address;
    if (email !== undefined) data.email = email;
    if (notes !== undefined) data.notes = notes;

    try {
      const client = await prisma.client.update({ where: { id: request.params.id }, data });
      return client;
    } catch {
      return reply.status(404).send({ error: 'Client not found' });
    }
  });

  fastify.delete('/:id', requireRole('ADMIN'), async (request, reply) => {
    try {
      await prisma.client.delete({ where: { id: request.params.id } });
      return { message: 'Client deleted' };
    } catch {
      return reply.status(404).send({ error: 'Client not found' });
    }
  });

  fastify.get('/:id/cases', async (request, reply) => {
    const cases = await prisma.case.findMany({
      where: { clientId: request.params.id },
      include: { assignedLawyer: { select: { id: true, fullName: true } }, sessions: true, payments: true },
      orderBy: { createdAt: 'desc' },
    });
    return cases;
  });

  fastify.get('/:id/payments', async (request, reply) => {
    const payments = await prisma.payment.findMany({
      where: { clientId: request.params.id },
      include: { case: { select: { caseNumber: true, caseYear: true } } },
      orderBy: { paidAt: 'desc' },
    });
    return payments;
  });
}
