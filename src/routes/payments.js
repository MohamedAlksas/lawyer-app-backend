import { supabase } from '../utils/supabase.js';
import { authenticate } from '../middleware/auth.js';

export default async function paymentRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request) => {
    const { caseId, clientId, page = 1, limit = 20 } = request.query;
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    let query = supabase
      .from('Payment')
      .select('*, client:Client(id, fullName), case:Case(id, caseNumber, caseYear)', { count: 'exact' });

    if (caseId) query = query.eq('caseId', caseId);
    if (clientId) query = query.eq('clientId', clientId);

    query = query.order('paidAt', { ascending: false }).range(from, to);

    const { data, count } = await query;
    return { data: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) };
  });

  fastify.post('/', async (request, reply) => {
    const { clientId, caseId, amount, paidAt, note } = request.body;
    if (!clientId || !caseId || amount === undefined) {
      return reply.status(400).send({ error: 'clientId, caseId, and amount required' });
    }

    const { data: payment, error } = await supabase
      .from('Payment')
      .insert({ clientId, caseId, amount: parseFloat(amount), paidAt: paidAt || new Date().toISOString(), note })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(payment);
  });

  fastify.put('/:id', async (request, reply) => {
    const { amount, paidAt, note } = request.body;
    const data = {};
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (paidAt !== undefined) data.paidAt = paidAt;
    if (note !== undefined) data.note = note;
    data.updatedAt = new Date().toISOString();

    const { data: payment, error } = await supabase
      .from('Payment')
      .update(data)
      .eq('id', request.params.id)
      .select()
      .single();

    if (error || !payment) return reply.status(404).send({ error: 'Payment not found' });
    return payment;
  });

  fastify.delete('/:id', async (request, reply) => {
    const { error } = await supabase.from('Payment').delete().eq('id', request.params.id);
    if (error) return reply.status(404).send({ error: 'Payment not found' });
    return { message: 'Payment deleted' };
  });
}
