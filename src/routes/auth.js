import bcrypt from 'bcrypt';
import { supabase } from '../utils/supabase.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/token.js';

export default async function authRoutes(fastify) {

  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { data: user, error } = await supabase
      .from('User')
      .select('id, fullName, email, role, isActive, createdAt')
      .eq('id', request.user.id)
      .maybeSingle();

    if (error || !user) {
      return reply.status(404).send({ error: 'User not found' });
    }
    return { user };
  });

  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password required' });
    }

    const { data: user, error } = await supabase
      .from('User')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !user || !user.isActive) {
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
      const { data: user } = await supabase
        .from('User')
        .select('*')
        .eq('id', decoded.id)
        .maybeSingle();

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
