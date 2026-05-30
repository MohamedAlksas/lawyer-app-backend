import { supabase } from '../utils/supabase.js';
import { authenticate } from '../middleware/auth.js';

export default async function notificationRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);

  fastify.get('/', async (request) => {
    const { data } = await supabase
      .from('Notification')
      .select('*')
      .eq('userId', request.user.id)
      .order('createdAt', { ascending: false })
      .limit(50);

    const { count } = await supabase
      .from('Notification')
      .select('*', { count: 'exact', head: true })
      .eq('userId', request.user.id)
      .eq('isRead', false);

    return { data: data || [], unreadCount: count || 0 };
  });

  fastify.put('/:id/read', async (request, reply) => {
    const { error } = await supabase
      .from('Notification')
      .update({ isRead: true })
      .eq('id', request.params.id);

    if (error) return reply.status(404).send({ error: 'Notification not found' });
    return { message: 'Notification marked as read' };
  });

  fastify.put('/read-all', async (request) => {
    await supabase
      .from('Notification')
      .update({ isRead: true })
      .eq('userId', request.user.id)
      .eq('isRead', false);

    return { message: 'All notifications marked as read' };
  });
}
