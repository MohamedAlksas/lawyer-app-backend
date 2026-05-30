import { authenticate, requireRole } from '../middleware/auth.js';

export default async function caseRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.addHook('onRequest', [authenticate]);

  fastify.get('/', async (request) => {
    const { search, status, caseType, lawyerId, page = 1, limit = 20 } = request.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};
    if (search) {
      where.OR = [
        { caseNumber: { contains: search } },
        { subject: { contains: search, mode: 'insensitive' } },
        { opposingParty: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (caseType) where.caseType = caseType;
    if (lawyerId) where.assignedLawyerId = lawyerId;

    if (request.user.role === 'LAWYER') {
      where.assignedLawyerId = request.user.id;
    }

    const [cases, total] = await Promise.all([
      prisma.case.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, fullName: true } },
          assignedLawyer: { select: { id: true, fullName: true } },
          _count: { select: { sessions: true } },
        },
      }),
      prisma.case.count({ where }),
    ]);

    return { data: cases, total, page: parseInt(page), limit: take };
  });

  fastify.get('/:id', async (request, reply) => {
    const caseItem = await prisma.case.findUnique({
      where: { id: request.params.id },
      include: {
        client: true,
        assignedLawyer: { select: { id: true, fullName: true } },
        sessions: { orderBy: { sessionDate: 'desc' } },
        actions: { orderBy: { actionDate: 'desc' }, take: 10 },
        documents: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!caseItem) return reply.status(404).send({ error: 'Case not found' });

    if (request.user.role === 'LAWYER' && caseItem.assignedLawyerId !== request.user.id) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const totalPaid = caseItem.payments.reduce((sum, p) => sum + p.amount, 0);
    return { ...caseItem, totalPaid, remaining: caseItem.agreedFee - totalPaid };
  });

  fastify.post('/', async (request, reply) => {
    const {
      caseNumber, caseYear, courtName, circuitNumber, caseType, subject,
      clientId, opposingParty, assignedLawyerId, filingDate, limitationDeadline, agreedFee, notes,
    } = request.body;

    if (!caseNumber || !caseYear || !courtName || !caseType || !subject || !clientId || !assignedLawyerId) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const caseItem = await prisma.case.create({
      data: {
        caseNumber: String(caseNumber), caseYear: parseInt(caseYear), courtName, circuitNumber,
        caseType, subject, clientId, opposingParty, assignedLawyerId,
        filingDate: filingDate ? new Date(filingDate) : null,
        limitationDeadline: limitationDeadline ? new Date(limitationDeadline) : null,
        agreedFee: agreedFee ? parseFloat(agreedFee) : 0, notes,
      },
    });
    return reply.status(201).send(caseItem);
  });

  fastify.put('/:id', async (request, reply) => {
    const caseItem = await prisma.case.findUnique({ where: { id: request.params.id } });
    if (!caseItem) return reply.status(404).send({ error: 'Case not found' });

    if (request.user.role === 'LAWYER' && caseItem.assignedLawyerId !== request.user.id) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const {
      caseNumber, caseYear, courtName, circuitNumber, caseType, subject,
      clientId, opposingParty, assignedLawyerId, status, filingDate, limitationDeadline, agreedFee, notes,
    } = request.body;

    const data = {};
    if (caseNumber !== undefined) data.caseNumber = String(caseNumber);
    if (caseYear !== undefined) data.caseYear = parseInt(caseYear);
    if (courtName !== undefined) data.courtName = courtName;
    if (circuitNumber !== undefined) data.circuitNumber = circuitNumber;
    if (caseType !== undefined) data.caseType = caseType;
    if (subject !== undefined) data.subject = subject;
    if (clientId !== undefined) data.clientId = clientId;
    if (opposingParty !== undefined) data.opposingParty = opposingParty;
    if (assignedLawyerId !== undefined) data.assignedLawyerId = assignedLawyerId;
    if (status !== undefined) data.status = status;
    if (filingDate !== undefined) data.filingDate = filingDate ? new Date(filingDate) : null;
    if (limitationDeadline !== undefined) data.limitationDeadline = limitationDeadline ? new Date(limitationDeadline) : null;
    if (agreedFee !== undefined) data.agreedFee = parseFloat(agreedFee);
    if (notes !== undefined) data.notes = notes;

    const updated = await prisma.case.update({ where: { id: request.params.id }, data });
    return updated;
  });

  fastify.delete('/:id', requireRole('ADMIN'), async (request, reply) => {
    try {
      await prisma.case.delete({ where: { id: request.params.id } });
      return { message: 'Case deleted' };
    } catch {
      return reply.status(404).send({ error: 'Case not found' });
    }
  });

  fastify.get('/:id/sessions', async (request, reply) => {
    const sessions = await prisma.session.findMany({
      where: { caseId: request.params.id },
      include: { attendedBy: { select: { id: true, fullName: true } } },
      orderBy: { sessionDate: 'desc' },
    });
    return sessions;
  });

  fastify.get('/:id/actions', async (request, reply) => {
    const actions = await prisma.action.findMany({
      where: { caseId: request.params.id },
      include: { performedBy: { select: { id: true, fullName: true } } },
      orderBy: { actionDate: 'desc' },
    });
    return actions;
  });

  fastify.get('/:id/documents', async (request, reply) => {
    const documents = await prisma.document.findMany({
      where: { caseId: request.params.id },
      include: { uploadedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return documents;
  });

  fastify.get('/:id/payments', async (request, reply) => {
    const payments = await prisma.payment.findMany({
      where: { caseId: request.params.id },
      include: { client: { select: { id: true, fullName: true } } },
      orderBy: { paidAt: 'desc' },
    });
    return payments;
  });
}
