import bcrypt from 'bcrypt';
import { supabase } from '../utils/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export default async function userRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);
  fastify.addHook('onRequest', requireRole('ADMIN'));

  fastify.get('/', async () => {
    const { data } = await supabase
      .from('User')
      .select('id, fullName, email, role, phone, isActive, createdAt')
      .order('createdAt', { ascending: false });
    return data || [];
  });

  fastify.post('/', async (request, reply) => {
    const { fullName, email, password, role, phone } = request.body;
    if (!fullName || !email || !password) {
      return reply.status(400).send({ error: 'fullName, email, and password required' });
    }

    const { data: existing } = await supabase
      .from('User')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return reply.status(409).send({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from('User')
      .insert({ fullName, email, password: hashedPassword, role: role || 'LAWYER', phone })
      .select('id, fullName, email, role, phone, isActive, createdAt')
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(user);
  });

  fastify.get('/:id', async (request, reply) => {
    const { data: user } = await supabase
      .from('User')
      .select('id, fullName, email, role, phone, isActive, createdAt')
      .eq('id', request.params.id)
      .maybeSingle();

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

    const { data: user, error } = await supabase
      .from('User')
      .update(data)
      .eq('id', request.params.id)
      .select('id, fullName, email, role, phone, isActive')
      .single();

    if (error || !user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  fastify.delete('/:id', async (request, reply) => {
    const { error } = await supabase
      .from('User')
      .delete()
      .eq('id', request.params.id);

    if (error) return reply.status(404).send({ error: 'User not found' });
    return { message: 'User deleted' };
  });
}
