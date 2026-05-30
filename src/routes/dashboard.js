import { supabase } from '../utils/supabase.js';
import { authenticate } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify) {

  fastify.addHook('onRequest', [authenticate]);

  fastify.get('/stats', async (request) => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString();

    let activeCasesQuery = supabase.from('Case').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');
    let todaySessionsQuery = supabase.from('Session').select('*', { count: 'exact', head: true }).gte('sessionDate', today).lt('sessionDate', tomorrow);
    let deadlinesQuery = supabase.from('Case').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').lte('limitationDeadline', thirtyDaysFromNow).gte('limitationDeadline', new Date().toISOString());

    if (request.user.role === 'LAWYER') {
      activeCasesQuery = activeCasesQuery.eq('assignedLawyerId', request.user.id);
      todaySessionsQuery = todaySessionsQuery.eq('case.assignedLawyerId', request.user.id);
      deadlinesQuery = deadlinesQuery.eq('assignedLawyerId', request.user.id);
    }

    const [{ count: activeCases }, { count: todaySessions }, { count: upcomingDeadlines }] = await Promise.all([
      activeCasesQuery,
      todaySessionsQuery,
      deadlinesQuery,
    ]);

    return { activeCases: activeCases || 0, todaySessions: todaySessions || 0, upcomingDeadlines: upcomingDeadlines || 0 };
  });
}
