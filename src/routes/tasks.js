import { supabase } from '../utils/supabase.js';
import { authenticate } from '../middleware/auth.js';

export default async function taskRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request) => {
    const { date, lawyerId } = request.query;
    let query = supabase
      .from('Task')
      .select('*, user:User(id, fullName)');

    if (date) {
      const dayEnd = new Date(date);
      dayEnd.setDate(dayEnd.getDate() + 1);
      query = query.gte('dueDate', date).lt('dueDate', dayEnd.toISOString().split('T')[0]);
    }

    if (lawyerId) {
      query = query.eq('userId', lawyerId);
    } else if (request.user.role === 'LAWYER') {
      query = query.eq('userId', request.user.id);
    }

    query = query.order('dueDate', { ascending: true });

    const { data } = await query;
    return data || [];
  });

  fastify.post('/', async (request, reply) => {
    const { title, description, dueDate, userId } = request.body;
    if (!title || !dueDate) {
      return reply.status(400).send({ error: 'title and dueDate required' });
    }

    const { data: task, error } = await supabase
      .from('Task')
      .insert({
        title,
        description,
        dueDate,
        userId: userId || request.user.id,
      })
      .select()
      .single();

    if (error) return reply.status(400).send({ error: error.message });
    return reply.status(201).send(task);
  });

  fastify.put('/:id', async (request, reply) => {
    const { title, description, dueDate, isCompleted } = request.body;
    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (dueDate !== undefined) data.dueDate = dueDate;
    if (isCompleted !== undefined) data.isCompleted = isCompleted;
    data.updatedAt = new Date().toISOString();

    const { data: task, error } = await supabase.from('Task').update(data).eq('id', request.params.id).select().single();
    if (error || !task) return reply.status(404).send({ error: 'Task not found' });
    return task;
  });

  fastify.delete('/:id', async (request, reply) => {
    const { error } = await supabase.from('Task').delete().eq('id', request.params.id);
    if (error) return reply.status(404).send({ error: 'Task not found' });
    return { message: 'Task deleted' };
  });
}
