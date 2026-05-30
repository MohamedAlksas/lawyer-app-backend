import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function scheduleNotifications() {
  const now = new Date();

  const upcomingSessions = await prisma.session.findMany({
    where: {
      sessionDate: { gte: now },
    },
    include: {
      case: {
        include: {
          assignedLawyer: true,
        },
      },
    },
  });

  for (const session of upcomingSessions) {
    const sessionDate = new Date(session.sessionDate);
    const diffMs = sessionDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= 24 && diffHours > 23) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: session.case.assignedLawyerId,
          title: 'Upcoming Session Reminder (24h)',
          relatedCaseId: session.caseId,
        },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            userId: session.case.assignedLawyerId,
            title: 'Upcoming Session Reminder (24h)',
            titleAr: 'تذكير جلسة قادمة (24 ساعة)',
            body: `Session for case ${session.case.caseNumber}/${session.case.caseYear} at ${session.courtName} in 24 hours`,
            bodyAr: `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} في ${session.courtName} بعد 24 ساعة`,
            relatedCaseId: session.caseId,
          },
        });
      }
    }

    if (diffHours <= 2 && diffHours > 1) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: session.case.assignedLawyerId,
          title: 'Upcoming Session Reminder (2h)',
          relatedCaseId: session.caseId,
        },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            userId: session.case.assignedLawyerId,
            title: 'Upcoming Session Reminder (2h)',
            titleAr: 'تذكير جلسة قادمة (ساعتان)',
            body: `Session for case ${session.case.caseNumber}/${session.case.caseYear} at ${session.courtName} in 2 hours`,
            bodyAr: `جلسة القضية ${session.case.caseNumber}/${session.case.caseYear} في ${session.courtName} بعد ساعتان`,
            relatedCaseId: session.caseId,
          },
        });
      }
    }
  }

  const activeCases = await prisma.case.findMany({
    where: {
      status: 'ACTIVE',
      limitationDeadline: { not: null },
    },
    include: { assignedLawyer: true },
  });

  for (const caseItem of activeCases) {
    if (!caseItem.limitationDeadline) continue;
    const deadlineDate = new Date(caseItem.limitationDeadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays <= 30 && diffDays > 29) {
      const existing = await prisma.notification.findFirst({
        where: {
          userId: caseItem.assignedLawyerId,
          title: 'Limitation Deadline Approaching',
          relatedCaseId: caseItem.id,
        },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            userId: caseItem.assignedLawyerId,
            title: 'Limitation Deadline Approaching',
            titleAr: 'اقتراب موعد التقادم',
            body: `Case ${caseItem.caseNumber}/${caseItem.caseYear} limitation deadline is within 30 days`,
            bodyAr: `موعد التقادم للقضية ${caseItem.caseNumber}/${caseItem.caseYear} خلال 30 يومًا`,
            relatedCaseId: caseItem.id,
          },
        });
      }
    }
  }
}

cron.schedule('*/30 * * * *', () => {
  scheduleNotifications().catch(console.error);
});

console.log('Notification scheduler started (runs every 30 minutes)');
