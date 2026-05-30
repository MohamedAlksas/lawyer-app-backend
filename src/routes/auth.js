import bcrypt from 'bcrypt';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token.js';

export default async function authRoutes(fastify) {
  const prisma = fastify.prisma;

  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    };
  });

  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body;
    if (!refreshToken) {
      return reply.status(400).send({ error: 'Refresh token required' });
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      if (!user || !user.isActive) {
        return reply.status(401).send({ error: 'User not found or inactive' });
      }

      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      return reply.status(401).send({ error: 'Invalid refresh token' });
    }
  });

  fastify.post('/logout', async () => {
    return { message: 'Logged out successfully' };
  });
}
