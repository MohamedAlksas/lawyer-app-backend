import bcrypt from 'bcrypt';
import { authenticate, requireRole } from '../middleware/auth.js';

export default async function userRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.addHook('onRequest', [authenticate, requireRole('ADMIN')]);

  fastify.get('/', async (request) => {
    const users = await prisma.user.findMany({
      select: { id: true, fullName: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return users;
  });

  fastify.post('/', async (request, reply) => {
    const { fullName, email, password, role, phone } = request.body;
    if (!fullName || !email || !password) {
      return reply.status(400).send({ error: 'fullName, email, and password required' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { fullName, email, password: hashedPassword, role: role || 'LAWYER', phone },
      select: { id: true, fullName: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
    });
    return reply.status(201).send(user);
  });

  fastify.get('/:id', async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.params.id },
      select: { id: true, fullName: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  fastify.put('/:id', async (request, reply) => {
    const { fullName, email, role, phone, isActive, password } = request.body;
    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (email !== undefined) data.email = email;
    if (role !== undefined) data.role = role;
    if (phone !== undefined) data.phone = phone;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.password = await bcrypt.hash(password, 10);

    try {
      const user = await prisma.user.update({
        where: { id: request.params.id },
        data,
        select: { id: true, fullName: true, email: true, role: true, phone: true, isActive: true },
      });
      return user;
    } catch {
      return reply.status(404).send({ error: 'User not found' });
    }
  });

  fastify.delete('/:id', async (request, reply) => {
    try {
      await prisma.user.delete({ where: { id: request.params.id } });
      return { message: 'User deleted' };
    } catch {
      return reply.status(404).send({ error: 'User not found' });
    }
  });
}
