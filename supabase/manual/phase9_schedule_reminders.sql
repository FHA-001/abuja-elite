-- Abuja Elite Phase 8: run the renewal reminders automatically, every hour.
--
-- STEP 1 (once): in the Supabase dashboard open  Database > Extensions,
--                find "pg_cron" and switch it ON.
-- STEP 2: run the block below in the SQL Editor.
--
-- If pg_cron is not available on your plan, skip this file: the admin screen has a
-- "Send renewal reminders now" button (Member accounts page) that does the same thing.
-- Running it often is safe: each reminder is only ever sent once.

select cron.schedule(
  'abuja-elite-renewal-reminders',
  '0 * * * *',
  $$select app_private.send_membership_reminders();$$
);

-- To see that it is scheduled:
--   select jobid, jobname, schedule, active from cron.job;
-- To see the latest runs:
--   select status, start_time, return_message from cron.job_run_details order by start_time desc limit 5;
-- To stop it:
--   select cron.unschedule('abuja-elite-renewal-reminders');
