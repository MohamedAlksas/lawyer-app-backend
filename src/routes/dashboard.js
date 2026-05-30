import { supabase } from '../utils/supabase.js';
import { authenticate } from '../middleware/auth.js';

export default async function dashboardRoutes(fastify) {

  fastify.addHook('onRequest', authenticate);

  fastify.get('/stats', async (request) => {
    const nowCairo = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const today = nowCairo.toISOString().split('T')[0];
    const tomCairo = new Date(nowCairo.getTime() + 86400000);
    const tomorrow = tomCairo.toISOString().split('T')[0];
    const futureCairo = new Date(nowCairo.getTime() + 30 * 86400000);
    const thirtyDaysFromNow = futureCairo.toISOString();

    let activeCasesQuery = supabase.from('Case').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');
    let deadlinesQuery = supabase.from('Case').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE').lte('limitationDeadline', thirtyDaysFromNow).gte('limitationDeadline', new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' })).toISOString());

    if (request.user.role === 'LAWYER') {
      activeCasesQuery = activeCasesQuery.eq('assignedLawyerId', request.user.id);
      deadlinesQuery = deadlinesQuery.eq('assignedLawyerId', request.user.id);
    }

    let todaySessions = 0;
    if (request.user.role === 'LAWYER') {
      const { data: caseIds } = await supabase
        .from('Case')
        .select('id')
        .eq('assignedLawyerId', request.user.id);

      if (caseIds && caseIds.length > 0) {
        const ids = caseIds.map(c => c.id);
        const { count } = await supabase
          .from('Session')
          .select('*', { count: 'exact', head: true })
          .in('caseId', ids)
          .gte('sessionDate', today)
          .lt('sessionDate', tomorrow);
        todaySessions = count || 0;
      }
    } else {
      const { count } = await supabase
        .from('Session')
        .select('*', { count: 'exact', head: true })
        .gte('sessionDate', today)
        .lt('sessionDate', tomorrow);
      todaySessions = count || 0;
    }

    const [{ count: activeCases }, { count: upcomingDeadlines }] = await Promise.all([
      activeCasesQuery,
      deadlinesQuery,
    ]);

    return { activeCases: activeCases || 0, todaySessions, upcomingDeadlines: upcomingDeadlines || 0 };
  });
}
