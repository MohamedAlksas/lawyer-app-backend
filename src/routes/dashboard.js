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

    const [{ count: activeCases }, { count: upcomingDeadlinesCount }] = await Promise.all([
      activeCasesQuery,
      deadlinesQuery,
    ]);

    // 1. Today's Sessions (Detailed)
    let sessionsQuery = supabase
      .from('Session')
      .select('id, sessionDate, courtName, case:Case(caseNumber, caseYear)')
      .gte('sessionDate', today)
      .lt('sessionDate', tomorrow)
      .order('sessionDate');

    if (request.user.role === 'LAWYER') {
      const { data: lawyerCaseIds } = await supabase.from('Case').select('id').eq('assignedLawyerId', request.user.id);
      if (lawyerCaseIds && lawyerCaseIds.length > 0) {
        sessionsQuery = sessionsQuery.in('caseId', lawyerCaseIds.map(c => c.id));
      } else {
        sessionsQuery = sessionsQuery.eq('id', 'none');
      }
    }
    const { data: todaySessionsList } = await sessionsQuery;

    // 2. Approaching Deadlines (Detailed)
    let approachingDeadlinesQuery = supabase
      .from('Case')
      .select('id, caseNumber, caseYear, limitationDeadline')
      .eq('status', 'ACTIVE')
      .gte('limitationDeadline', nowCairo.toISOString())
      .lte('limitationDeadline', thirtyDaysFromNow)
      .order('limitationDeadline')
      .limit(5);

    if (request.user.role === 'LAWYER') {
      approachingDeadlinesQuery = approachingDeadlinesQuery.eq('assignedLawyerId', request.user.id);
    }
    const { data: deadlinesList } = await approachingDeadlinesQuery;

    // 3. Recent Clients
    const { data: recentClients } = await supabase
      .from('Client')
      .select('id, fullName, phone, createdAt')
      .order('createdAt', { ascending: false })
      .limit(5);

    // 4. Financial Health (Last 7 days of payments)
    const sevenDaysAgo = new Date(nowCairo.getTime() - 7 * 86400000).toISOString();
    let paymentsQuery = supabase
      .from('Payment')
      .select('amount, paidAt');
    
    if (request.user.role === 'LAWYER') {
       // Optional: Filter by cases assigned to lawyer if needed, 
       // but usually admin sees office total. Let's filter for lawyers.
       const { data: lawyerCaseIds } = await supabase.from('Case').select('id').eq('assignedLawyerId', request.user.id);
       if (lawyerCaseIds) {
         paymentsQuery = paymentsQuery.in('caseId', lawyerCaseIds.map(c => c.id));
       }
    }
    
    const { data: recentPayments } = await paymentsQuery.gte('paidAt', sevenDaysAgo);

    return { 
      activeCases: activeCases || 0, 
      todaySessionsCount: todaySessions || 0, 
      upcomingDeadlinesCount: upcomingDeadlinesCount || 0,
      sessions: todaySessionsList || [],
      deadlines: deadlinesList || [],
      recentClients: recentClients || [],
      recentPayments: recentPayments || []
    };
  });
}
