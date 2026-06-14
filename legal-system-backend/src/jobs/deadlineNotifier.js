const cron = require('node-cron');
const supabase = require('../config/supabase');
const { createNotification } = require('../services/notificationService');
const { LEVEL_1 } = require('../middleware/auth');

const dateStr = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
};

async function notifyUpcomingStages() {
  const target = dateStr(3);

  const { data: stages, error } = await supabase
    .from('case_stages')
    .select('id, title, stage_date, case_id, case_file:case_files!case_stages_case_id_fkey(id, assigned_to)')
    .eq('stage_date', target)
    .eq('is_completed', false);

  if (error) { console.error('[deadlineNotifier] stages query error:', error.message); return; }
  if (!stages?.length) return;

  for (const stage of stages) {
    const assignedTo = stage.case_file?.assigned_to;
    if (!assignedTo) continue;

    const recipientIds = new Set([assignedTo]);

    // Also notify Level 1 staff whose supervisor is the assigned associate
    const { data: subordinates } = await supabase
      .from('users')
      .select('id')
      .eq('supervisor_id', assignedTo)
      .in('role', LEVEL_1);

    if (subordinates?.length) {
      subordinates.forEach(u => recipientIds.add(u.id));
    }

    const title = 'Upcoming Case Stage';
    const message = `Stage "${stage.title}" is due in 3 days (${stage.stage_date}).`;

    await Promise.all(
      [...recipientIds].map(uid =>
        createNotification(uid, title, message, 'deadline_reminder', stage.id, 'case_stages')
      )
    );
  }

  console.log(`[deadlineNotifier] Notified for ${stages.length} upcoming stage(s) on ${target}`);
}

async function notifyUpcomingFirmDeadlines() {
  const target = dateStr(1);

  const { data: deadlines, error } = await supabase
    .from('firm_deadlines')
    .select('id, title, deadline_date, created_by')
    .eq('deadline_date', target)
    .eq('is_completed', false);

  if (error) { console.error('[deadlineNotifier] firm_deadlines query error:', error.message); return; }
  if (!deadlines?.length) return;

  for (const dl of deadlines) {
    if (!dl.created_by) continue;
    const title = 'Firm Deadline Tomorrow';
    const message = `Firm deadline "${dl.title}" is due tomorrow (${dl.deadline_date}).`;
    await createNotification(dl.created_by, title, message, 'deadline_reminder', dl.id, 'firm_deadlines');
  }

  console.log(`[deadlineNotifier] Notified for ${deadlines.length} firm deadline(s) on ${target}`);
}

async function runNotifier() {
  console.log('[deadlineNotifier] Running daily deadline check…');
  await Promise.all([notifyUpcomingStages(), notifyUpcomingFirmDeadlines()]);
}

function register() {
  // Daily at 8:00 AM server time
  cron.schedule('0 8 * * *', runNotifier, { timezone: 'Asia/Kuala_Lumpur' });
  console.log('[deadlineNotifier] Cron job registered — runs daily at 08:00 MYT');
}

module.exports = { register, runNotifier };
