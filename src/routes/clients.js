import { supabase } from '../utils/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export default async function clientRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request) => {
    const { search, page = 1, limit = 20 } = request.query;
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    let query = supabase
      .from('Client')
      .select('*, cases:Case(count)', { count: 'exact' });

    if (search) {
      query = query.or(`fullName.ilike.%${search}%,fullNameAr.ilike.%${search}%,nationalId.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    query = query.order('createdAt', { ascending: false }).range(from, to);

    const { data, count, error } = await query;
    if (error) return { data: [], total: 0, page: parseInt(page), limit: parseInt(limit) };

    return { data: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) };
  });

  fastify.get('/:id', async (request, reply) => {
    const { data: client } = await supabase
      .from('Client')
      .select('*, cases:Case(*, assignedLawyer:User!assignedLawyerId(id, fullName), sessions:Session(*), payments:Payment(*)), payments:Payment(*)')
      .eq('id', request.params.id)
      .maybeSingle();

    if (!client) return reply.status(404).send({ error: 'Client not found' });

    const totalFee = (client.cases || []).reduce((sum, c) => sum + (c.agreedFee || 0), 0);
    const totalPaid = (client.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    return { ...client, financialSummary: { totalFee, totalPaid, remaining: totalFee - totalPaid } };
  });

  fastify.post('/', async (request, reply) => {
    const { fullName, fullNameAr, nationalId, phone, alternatePhone, address, email, notes } = request.body;
    if (!fullName || !nationalId || !phone) {
      return reply.status(400).send({ error: 'fullName, nationalId, and phone required' });
    }

    const { data: existing } = await supabase
      .from('Client')
      .select('id')
      .eq('nationalId', nationalId)
      .maybeSingle();

    if (existing) {
      return reply.status(409).send({ error: 'Client with this national ID already exists' });
    }

    const { data: client, error } = await supabase
      .from('Client')
      .insert({ fullName, fullNameAr, nationalId, phone, alternatePhone, address, email, notes, createdBy: request.user.id })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
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
    data.updatedAt = new Date().toISOString();

    const { data: client, error } = await supabase
      .from('Client')
      .update(data)
      .eq('id', request.params.id)
      .select()
      .single();

    if (error || !client) return reply.status(404).send({ error: 'Client not found' });
    return client;
  });

  fastify.delete('/:id', { preHandler: requireRole('ADMIN') }, async (request, reply) => {
    const { error } = await supabase.from('Client').delete().eq('id', request.params.id);
    if (error) return reply.status(404).send({ error: 'Client not found' });
    return { message: 'Client deleted' };
  });

  fastify.get('/:id/cases', async (request, reply) => {
    const { data } = await supabase
      .from('Case')
      .select('*, assignedLawyer:User!assignedLawyerId(id, fullName), sessions:Session(*), payments:Payment(*)')
      .eq('clientId', request.params.id)
      .order('createdAt', { ascending: false });
    return data || [];
  });

  fastify.get('/:id/payments', async (request, reply) => {
    const { data } = await supabase
      .from('Payment')
      .select('*, case:Case(caseNumber, caseYear)')
      .eq('clientId', request.params.id)
      .order('paidAt', { ascending: false });
    return data || [];
  });
}
