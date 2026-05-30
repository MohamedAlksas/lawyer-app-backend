import cron from 'node-cron';
import { supabase } from './supabase.js';

async function scheduleNotifications() {
  const now = new Date().toISOString();

  const { data: upcomingSessions } = await supabase
    .from('Session')
    .select('*, case:Case!inner(caseNumber, caseYear, assignedLawyerId, assignedLawyer:User!assignedLawyerId(fullName, id))')
    .gte('sessionDate', now);

  if (!upcomingSessions) return;

  for (const session of upcomingSessions) {
    const sessionDate = new Date(session.sessionDate);
    const diffMs = sessionDate.getTime() - new Date().getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 24 && diffHours > 23) {
      const { data: existing } = await supabase
        .from('Notification')
        .select('id')
        .eq('userId', session.case.assignedLawyerId)
        .eq('title', 'Upcoming Session Reminder (24h)')
        .eq('relatedCaseId', session.caseId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('Notification').insert({
          userId: session.case.assignedLawyerId,
          title: 'Upcoming Session Reminder (24h)',
          titleAr: 'تذكير جلسة قادمة (24 ساعة)',
          body: `Session for case ${session.case.caseNumber}/${session.case.caseYear} at ${session.courtName} in 24 hours`,
          bodyAr: `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} في ${session.courtName} بعد 24 ساعة`,
          relatedCaseId: session.caseId,
        });
      }
    }

    if (diffHours <= 2 && diffHours > 1) {
      const { data: existing } = await supabase
        .from('Notification')
        .select('id')
        .eq('userId', session.case.assignedLawyerId)
        .eq('title', 'Upcoming Session Reminder (2h)')
        .eq('relatedCaseId', session.caseId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('Notification').insert({
          userId: session.case.assignedLawyerId,
          title: 'Upcoming Session Reminder (2h)',
          titleAr: 'تذكير جلسة قادمة (ساعتان)',
          body: `Session for case ${session.case.caseNumber}/${session.case.caseYear} at ${session.courtName} in 2 hours`,
          bodyAr: `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} في ${session.courtName} بعد ساعتان`,
          relatedCaseId: session.caseId,
        });
      }
    }
  }

  const { data: activeCases } = await supabase
    .from('Case')
    .select('*')
    .eq('status', 'ACTIVE')
    .not('limitationDeadline', 'is', null);

  if (activeCases) {
    for (const caseItem of activeCases) {
      if (!caseItem.limitationDeadline) continue;
      const deadlineDate = new Date(caseItem.limitationDeadline);
      const diffMs = deadlineDate.getTime() - new Date().getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays <= 30 && diffDays > 29) {
        const { data: existing } = await supabase
          .from('Notification')
          .select('id')
          .eq('userId', caseItem.assignedLawyerId)
          .eq('title', 'Limitation Deadline Approaching')
          .eq('relatedCaseId', caseItem.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('Notification').insert({
            userId: caseItem.assignedLawyerId,
            title: 'Limitation Deadline Approaching',
            titleAr: 'اقتراب موعد التقادم',
            body: `Case ${caseItem.caseNumber}/${caseItem.caseYear} limitation deadline is within 30 days`,
            bodyAr: `موعد التقادم للقضية ${caseItem.caseNumber}/${caseItem.caseYear} خلال 30 يومًا`,
            relatedCaseId: caseItem.id,
          });
        }
      }
    }
  }
}

cron.schedule('*/30 * * * *', () => {
  scheduleNotifications().catch(console.error);
});

console.log('Notification scheduler started (runs every 30 minutes)');
