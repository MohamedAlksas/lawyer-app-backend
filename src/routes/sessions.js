import { supabase } from '../utils/supabase.js';
import { authenticate } from '../middleware/auth.js';

export default async function sessionRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request) => {
    const { date, lawyerId } = request.query;
    let query = supabase
      .from('Session')
      .select('*, case:Case!inner(caseNumber, caseYear, caseType, courtName, client:Client(id, fullName), assignedLawyer:User!assignedLawyerId(id, fullName)), attendedBy:User(id, fullName)');

    if (date) {
      const dayEnd = new Date(date);
      dayEnd.setDate(dayEnd.getDate() + 1);
      query = query.gte('sessionDate', date).lt('sessionDate', dayEnd.toISOString().split('T')[0]);
    }

    if (lawyerId) {
      query = query.eq('case.assignedLawyerId', lawyerId);
    } else if (request.user.role === 'LAWYER') {
      query = query.eq('case.assignedLawyerId', request.user.id);
    }

    query = query.order('sessionDate', { ascending: true });

    const { data } = await query;
    return data || [];
  });

  fastify.get('/calendar', async (request) => {
    const { year, month, lawyerId } = request.query;
    const now = new Date();
    const y = year ? parseInt(year) : now.getFullYear();
    const m = month ? parseInt(month) - 1 : now.getMonth();
    const monthStart = new Date(y, m, 1).toISOString().split('T')[0];
    const monthEnd = new Date(y, m + 1, 1).toISOString().split('T')[0];

    let query = supabase
      .from('Session')
      .select('id, sessionDate, sessionTime, courtName, result, case:Case!inner(id, caseNumber, caseYear, caseType, assignedLawyerId)')
      .gte('sessionDate', monthStart)
      .lt('sessionDate', monthEnd);

    if (lawyerId) {
      query = query.eq('case.assignedLawyerId', lawyerId);
    } else if (request.user.role === 'LAWYER') {
      query = query.eq('case.assignedLawyerId', request.user.id);
    }

    query = query.order('sessionDate', { ascending: true });

    const { data } = await query;
    return data || [];
  });

  fastify.get('/:id', async (request, reply) => {
    const { data: session } = await supabase
      .from('Session')
      .select('*, case:Case(id, caseNumber, caseYear, caseType, courtName, client:Client(id, fullName)), attendedBy:User(id, fullName)')
      .eq('id', request.params.id)
      .maybeSingle();

    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return session;
  });

  fastify.post('/', async (request, reply) => {
    const { caseId, sessionDate, sessionTime, courtName, result, nextSessionDate, notes, attendedById } = request.body;
    if (!caseId || !sessionDate || !courtName) {
      return reply.status(400).send({ error: 'caseId, sessionDate, and courtName required' });
    }

    const { data: session, error } = await supabase
      .from('Session')
      .insert({
        caseId,
        sessionDate,
        sessionTime,
        courtName,
        result,
        nextSessionDate: nextSessionDate || null,
        notes,
        attendedById: attendedById || request.user.id,
      })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });

    await supabase.from('Action').insert({
      caseId,
      actionType: 'SESSION_ADDED',
      description: `Session added on ${sessionDate} at ${courtName}`,
      performedById: request.user.id,
      actionDate: new Date().toISOString(),
    });

    return reply.status(201).send(session);
  });

  fastify.put('/:id', async (request, reply) => {
    const { sessionDate, sessionTime, courtName, result, nextSessionDate, notes, attendedById } = request.body;
    const data = {};
    if (sessionDate !== undefined) data.sessionDate = sessionDate;
    if (sessionTime !== undefined) data.sessionTime = sessionTime;
    if (courtName !== undefined) data.courtName = courtName;
    if (result !== undefined) data.result = result;
    if (nextSessionDate !== undefined) data.nextSessionDate = nextSessionDate || null;
    if (notes !== undefined) data.notes = notes;
    if (attendedById !== undefined) data.attendedById = attendedById;
    data.updatedAt = new Date().toISOString();

    const { data: session, error } = await supabase.from('Session').update(data).eq('id', request.params.id).select().single();
    if (error || !session) return reply.status(404).send({ error: 'Session not found' });
    return session;
  });

  fastify.delete('/:id', async (request, reply) => {
    const { error } = await supabase.from('Session').delete().eq('id', request.params.id);
    if (error) return reply.status(404).send({ error: 'Session not found' });
    return { message: 'Session deleted' };
  });
}
