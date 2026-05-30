import { supabase } from '../utils/supabase.js';
import { authenticate } from '../middleware/auth.js';

export default async function notificationTokenRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);

  fastify.post('/register', async (request, reply) => {
    const { token, platform } = request.body;
    if (!token) {
      return reply.status(400).send({ error: 'Token is required' });
    }

    const { error } = await supabase.from('DeviceToken').upsert(
      {
        userId: request.user.id,
        token,
        platform: platform || 'mobile',
      },
      { onConflict: 'userId,token', ignoreDuplicates: false }
    );

    if (error) {
      return reply.status(500).send({ error: 'Failed to register device token' });
    }
    return { message: 'Device token registered' };
  });

  fastify.delete('/unregister', async (request, reply) => {
    const { token } = request.body;
    if (!token) {
      return reply.status(400).send({ error: 'Token is required' });
    }

    const { error } = await supabase
      .from('DeviceToken')
      .delete()
      .eq('userId', request.user.id)
      .eq('token', token);

    if (error) {
      return reply.status(500).send({ error: 'Failed to unregister device token' });
    }
    return { message: 'Device token unregistered' };
  });
}
