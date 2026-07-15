INSERT INTO operators (name,code,new_prefix,color,status,notes) VALUES
 ('QCell','QCELL','83','#6E3482','active','PURA Ref P/TR/NP/VOL.XV/(457), 9 July 2026; Phase 1 effective 4 September 2026.'),
 ('Comium','COMIUM','86','#A56ABD','active','PURA Ref P/TR/NP/VOL.XV/(457), 9 July 2026; Phase 1 effective 4 September 2026.'),
 ('Africell','AFRICELL','87','#49225B','active','PURA Ref P/TR/NP/VOL.XV/(457), 9 July 2026; Phase 1 effective 4 September 2026.')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,new_prefix=EXCLUDED.new_prefix,color=EXCLUDED.color,status='active',notes=EXCLUDED.notes,updated_at=NOW();

INSERT INTO transition_settings (transition_start_date,transition_end_date,default_update_mode,allow_replace_mode,show_transition_notice,show_cleanup_recommendation,transition_banner_message,after_transition_message,cleanup_recommendation_message)
SELECT '2026-09-04','2026-11-30','duplicate',true,true,true,
 'PURA Phase 1 begins 4 September 2026. Keep old and new numbers during parallel running through 30 November 2026.',
 'PURA parallel running has ended. You can remove an old number only after confirming its matching new number is saved.',
 'Remove old 7-digit numbers only when the verified matching 9-digit number exists in the same contact.'
WHERE NOT EXISTS (SELECT 1 FROM transition_settings);

INSERT INTO app_config (config_key,config_value) VALUES
 ('maintenance_mode','false'),('free_trial_limit','10'),('minimum_app_version','"2.1.0"'),
 ('support_whatsapp','""'),('support_email','""'),('support_phone','""'),
 ('subscription_price','100'),('pricing','{"bulk_unlock":100,"currency":"GMD"}'),
 ('announcement_message','"PURA Phase 1 number migration begins 4 September 2026"'),
 ('privacy_policy_url','""'),('terms_url','""'),
 ('default_feature_unlock_settings','{"bulk_duplicate_add":true,"replace":true,"cleanup":true,"backup_restore":true,"export_report":true}')
ON CONFLICT (config_key) DO NOTHING;
