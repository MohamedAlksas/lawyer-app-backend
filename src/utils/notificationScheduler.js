import cron from 'node-cron';
import { supabase } from './supabase.js';
import { sendPushNotification } from './firebase.js';

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
      const title = 'Upcoming Session Reminder (24h)';
      const body = `Session for case ${session.case.caseNumber}/${session.case.caseYear} at ${session.courtName} in 24 hours`;
      const existing = await exists(session.case.assignedLawyerId, title, session.caseId);
      if (!existing) {
        await supabase.from('Notification').insert({
          userId: session.case.assignedLawyerId,
          title,
          titleAr: 'تذكير جلسة قادمة (24 ساعة)',
          body,
          bodyAr: `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} في ${session.courtName} بعد 24 ساعة`,
          relatedCaseId: session.caseId,
        });
        await sendPushNotification(
          session.case.assignedLawyerId,
          'تذكير جلسة قادمة',
          `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} بعد 24 ساعة`,
          { type: 'session_reminder', caseId: session.caseId }
        );
      }
    }

    if (diffHours <= 2 && diffHours > 1) {
      const title = 'Upcoming Session Reminder (2h)';
      const body = `Session for case ${session.case.caseNumber}/${session.case.caseYear} at ${session.courtName} in 2 hours`;
      const existing = await exists(session.case.assignedLawyerId, title, session.caseId);
      if (!existing) {
        await supabase.from('Notification').insert({
          userId: session.case.assignedLawyerId,
          title,
          titleAr: 'تذكير جلسة قادمة (ساعتان)',
          body,
          bodyAr: `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} في ${session.courtName} بعد ساعتان`,
          relatedCaseId: session.caseId,
        });
        await sendPushNotification(
          session.case.assignedLawyerId,
          'تذكير جلسة قادمة',
          `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} بعد ساعتان`,
          { type: 'session_reminder', caseId: session.caseId }
        );
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
        const title = 'Limitation Deadline Approaching';
        const body = `Case ${caseItem.caseNumber}/${caseItem.caseYear} limitation deadline is within 30 days`;
        const existing = await exists(caseItem.assignedLawyerId, title, caseItem.id);
        if (!existing) {
          await supabase.from('Notification').insert({
            userId: caseItem.assignedLawyerId,
            title,
            titleAr: 'اقتراب موعد التقادم',
            body,
            bodyAr: `موعد التقادم للقضية ${caseItem.caseNumber}/${caseItem.caseYear} خلال 30 يومًا`,
            relatedCaseId: caseItem.id,
          });
          await sendPushNotification(
            caseItem.assignedLawyerId,
            'تنبيه التقادم',
            body,
            { type: 'limitation_alert', caseId: caseItem.id }
          );
        }
      }
    }
  }
}

async function exists(userId, title, relatedCaseId) {
  const { data } = await supabase
    .from('Notification')
    .select('id')
    .eq('userId', userId)
    .eq('title', title)
    .eq('relatedCaseId', relatedCaseId)
    .maybeSingle();
  return !!data;
}

cron.schedule('*/30 * * * *', () => {
  scheduleNotifications().catch(console.error);
});

console.log('Notification scheduler started (runs every 30 minutes)');
