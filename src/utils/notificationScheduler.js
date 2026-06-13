import cron from 'node-cron';
import { supabase } from './supabase.js';
import { sendPushNotification } from './firebase.js';

async function scheduleNotifications() {
  console.log('[Scheduler] Running notification check...');
  const now = new Date();
  const nowIso = now.toISOString();

  // 1. Check for Sessions in the next 24 hours
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const { data: upcomingSessions, error: sessionError } = await supabase
    .from('Session')
    .select('*, case:Case!inner(caseNumber, caseYear, assignedLawyerId)')
    .gte('sessionDate', nowIso)
    .lte('sessionDate', tomorrow.toISOString());

  if (sessionError) {
    console.error('[Scheduler] Error fetching sessions:', sessionError);
  } else if (upcomingSessions) {
    for (const session of upcomingSessions) {
      const sessionDate = new Date(session.sessionDate);
      const diffMs = sessionDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Determine reminder type
      let reminderType = null;
      let title = '';
      let titleAr = '';
      let bodyAr = '';

      if (diffHours <= 2) {
        reminderType = 'SESSION_2H';
        title = 'Upcoming Session Reminder (2h)';
        titleAr = 'تذكير جلسة قادمة (ساعتان)';
        bodyAr = `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} في ${session.courtName} بعد ساعتين`;
      } else if (diffHours <= 24) {
        reminderType = 'SESSION_24H';
        title = 'Upcoming Session Reminder (24h)';
        titleAr = 'تذكير جلسة قادمة (24 ساعة)';
        bodyAr = `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} في ${session.courtName} غداً`;
      }

      if (reminderType) {
        const userId = session.case.assignedLawyerId;
        const alreadySent = await hasSentNotification(userId, reminderType, session.id);

        if (!alreadySent) {
          console.log(`[Scheduler] Sending ${reminderType} for session ${session.id} to user ${userId}`);
          
          await supabase.from('Notification').insert({
            userId,
            title,
            titleAr,
            body: `Session for case ${session.case.caseNumber}/${session.case.caseYear} at ${session.courtName}`,
            bodyAr,
            relatedCaseId: session.caseId,
            metadata: { reminderType, sessionId: session.id }
          });

          await sendPushNotification(
            userId,
            titleAr,
            bodyAr,
            { type: 'session_reminder', caseId: session.caseId, sessionId: session.id }
          );
        }
      }
    }
  }

  // 2. Check for Limitation Deadlines (30 days)
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { data: activeCases, error: caseError } = await supabase
    .from('Case')
    .select('id, caseNumber, caseYear, assignedLawyerId, limitationDeadline')
    .eq('status', 'ACTIVE')
    .gte('limitationDeadline', nowIso)
    .lte('limitationDeadline', thirtyDays.toISOString());

  if (caseError) {
    console.error('[Scheduler] Error fetching cases:', caseError);
  } else if (activeCases) {
    for (const caseItem of activeCases) {
      const userId = caseItem.assignedLawyerId;
      const alreadySent = await hasSentNotification(userId, 'LIMITATION_30D', caseItem.id);

      if (!alreadySent) {
        console.log(`[Scheduler] Sending LIMITATION_30D for case ${caseItem.id} to user ${userId}`);
        const titleAr = 'تنبيه التقادم (30 يوم)';
        const bodyAr = `موعد التقادم للقضية ${caseItem.caseNumber}/${caseItem.caseYear} خلال 30 يوماً`;

        await supabase.from('Notification').insert({
          userId,
          title: 'Limitation Deadline Approaching',
          titleAr,
          body: `Case ${caseItem.caseNumber}/${caseItem.caseYear} limitation deadline is within 30 days`,
          bodyAr,
          relatedCaseId: caseItem.id,
          metadata: { reminderType: 'LIMITATION_30D' }
        });

        await sendPushNotification(
          userId,
          titleAr,
          bodyAr,
          { type: 'limitation_alert', caseId: caseItem.id }
        );
      }
    }
  }
}

async function hasSentNotification(userId, type, referenceId) {
  const { data } = await supabase
    .from('Notification')
    .select('id')
    .eq('userId', userId)
    .contains('metadata', { reminderType: type })
    .or(`metadata->>sessionId.eq.${referenceId},relatedCaseId.eq.${referenceId}`)
    .maybeSingle();
  return !!data;
}

// Run every hour at the top of the hour
cron.schedule('0 * * * *', () => {
  scheduleNotifications().catch(console.error);
});

// Also run once on startup
scheduleNotifications().catch(console.error);

console.log('Notification scheduler initialized (Hourly checks)');
