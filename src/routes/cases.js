import { supabase } from '../utils/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export default async function caseRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request) => {
    const { search, status, caseType, lawyerId, page = 1, limit = 20 } = request.query;
    const from = (parseInt(page) - 1) * parseInt(limit);
    const to = from + parseInt(limit) - 1;

    let query = supabase
      .from('Case')
      .select('*, client:Client(id, fullName), assignedLawyer:User!assignedLawyerId(id, fullName), sessions:Session(count)', { count: 'exact' });

    if (search) {
      query = query.or(`caseNumber.ilike.%${search}%,subject.ilike.%${search}%,opposingParty.ilike.%${search}%`);
    }
    if (status) query = query.eq('status', status);
    if (caseType) query = query.eq('caseType', caseType);
    if (lawyerId) query = query.eq('assignedLawyerId', lawyerId);

    if (request.user.role === 'LAWYER') {
      query = query.eq('assignedLawyerId', request.user.id);
    }

    query = query.order('createdAt', { ascending: false }).range(from, to);

    const { data, count } = await query;
    return { data: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) };
  });

  fastify.get('/:id', async (request, reply) => {
    const { data: caseItem } = await supabase
      .from('Case')
      .select('*, client:Client(*), assignedLawyer:User!assignedLawyerId(id, fullName), sessions:Session(*, attendedBy:User(id, fullName)), actions:Action(*, performedBy:User(id, fullName)), documents:Document(*, uploadedBy:User(id, fullName)), payments:Payment(*)')
      .eq('id', request.params.id)
      .maybeSingle();

    if (!caseItem) return reply.status(404).send({ error: 'Case not found' });

    if (request.user.role === 'LAWYER' && caseItem.assignedLawyerId !== request.user.id) {
      return reply.status(403).send({ error: 'Access denied' });
    }

    const totalPaid = (caseItem.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    return { ...caseItem, totalPaid, remaining: (caseItem.agreedFee || 0) - totalPaid };
  });

  fastify.post('/', async (request, reply) => {
    const {
      caseNumber, caseYear, courtName, circuitNumber, caseType, subject,
      clientId, opposingParty, assignedLawyerId, filingDate, limitationDeadline, agreedFee, notes,
    } = request.body;

    if (!caseNumber || !caseYear || !courtName || !caseType || !subject || !clientId || !assignedLawyerId) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const { data: caseItem, error } = await supabase
      .from('Case')
      .insert({
        caseNumber: String(caseNumber), caseYear: parseInt(caseYear), courtName, circuitNumber,
        caseType, subject, clientId, opposingParty, assignedLawyerId,
        filingDate: filingDate || null, limitationDeadline: limitationDeadline || null,
        agreedFee: agreedFee ? parseFloat(agreedFee) : 0, notes,
      })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(caseItem);
  });

  fastify.put('/:id', async (request, reply) => {
    const { data: existing } = await supabase.from('Case').select('assignedLawyerId').eq('id', request.params.id).maybeSingle();
    if (!existing) return reply.status(404).send({ error: 'Case not found' });

    if (request.user.role === 'LAWYER' && existing.assignedLawyerId !== request.user.id) {
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
    if (filingDate !== undefined) data.filingDate = filingDate || null;
    if (limitationDeadline !== undefined) data.limitationDeadline = limitationDeadline || null;
    if (agreedFee !== undefined) data.agreedFee = parseFloat(agreedFee);
    if (notes !== undefined) data.notes = notes;

    const { data: updated, error } = await supabase.from('Case').update(data).eq('id', request.params.id).select().single();
    if (error) return reply.status(400).send({ error: error.message });
    return updated;
  });

  fastify.delete('/:id', { preHandler: requireRole('ADMIN') }, async (request, reply) => {
    const { error } = await supabase.from('Case').delete().eq('id', request.params.id);
    if (error) return reply.status(404).send({ error: 'Case not found' });
    return { message: 'Case deleted' };
  });

  fastify.get('/:id/sessions', async (request, reply) => {
    const { data } = await supabase
      .from('Session')
      .select('*, attendedBy:User(id, fullName)')
      .eq('caseId', request.params.id)
      .order('sessionDate', { ascending: false });
    return data || [];
  });

  fastify.get('/:id/actions', async (request, reply) => {
    const { data } = await supabase
      .from('Action')
      .select('*, performedBy:User(id, fullName)')
      .eq('caseId', request.params.id)
      .order('actionDate', { ascending: false });
    return data || [];
  });

  fastify.get('/:id/documents', async (request, reply) => {
    const { data } = await supabase
      .from('Document')
      .select('*, uploadedBy:User(id, fullName)')
      .eq('caseId', request.params.id)
      .order('createdAt', { ascending: false });
    return data || [];
  });

  fastify.get('/:id/payments', async (request, reply) => {
    const { data } = await supabase
      .from('Payment')
      .select('*, client:Client(id, fullName)')
      .eq('caseId', request.params.id)
      .order('paidAt', { ascending: false });
    return data || [];
  });
}
