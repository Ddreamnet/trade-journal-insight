-- Enable scheduling extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Schedule nightly portfolio snapshot (20:00 UTC = 23:00 Turkey)
SELECT cron.schedule(
  'portfolio-daily-snapshot',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://pjqbpkblutbdpfzzwxmr.supabase.co/functions/v1/portfolio-daily-snapshot',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqcWJwa2JsdXRiZHBmenp3eG1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxOTc1MDAsImV4cCI6MjA4NDc3MzUwMH0.rpDIWEclzUSg4zFnNv-ApOUGm1dGKyGldtx4LB5CHVg"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);
