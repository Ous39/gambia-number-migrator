-- v1.8.0: give new trial devices ten safe Add & Keep Old migrations.
-- Existing administrator configuration is preserved when already customized.
UPDATE app_config
SET config_value = '10'::jsonb, updated_at = NOW()
WHERE config_key = 'free_trial_limit' AND config_value = '0'::jsonb;
