ALTER TABLE admins DROP CONSTRAINT IF EXISTS ck_admin_role;
UPDATE admins SET role='owner' WHERE role='admin' AND NOT EXISTS (SELECT 1 FROM admins WHERE role='owner');
ALTER TABLE admins ADD CONSTRAINT ck_admin_role CHECK (role IN ('owner','admin','operations','finance','support','viewer'));
ALTER TABLE admins DROP CONSTRAINT IF EXISTS ck_admin_status;
ALTER TABLE admins ADD CONSTRAINT ck_admin_status CHECK (status IN ('active','disabled'));

INSERT INTO operators (name,code,new_prefix,color,status,notes) VALUES
 ('QCell','QCELL','83','#6E3482','active','PURA Ref P/TR/NP/VOL.XV/(457), 9 July 2026; Phase 1 effective 4 September 2026.'),
 ('Comium','COMIUM','86','#A56ABD','active','PURA Ref P/TR/NP/VOL.XV/(457), 9 July 2026; Phase 1 effective 4 September 2026.'),
 ('Africell','AFRICELL','87','#49225B','active','PURA Ref P/TR/NP/VOL.XV/(457), 9 July 2026; Phase 1 effective 4 September 2026.')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,new_prefix=EXCLUDED.new_prefix,color=EXCLUDED.color,status='active',notes=EXCLUDED.notes,updated_at=NOW();

UPDATE migration_rules SET status='inactive',updated_at=NOW() WHERE operator_id IN (SELECT id FROM operators WHERE code IN ('QCELL','COMIUM','AFRICELL'));

INSERT INTO migration_rules (operator_id,rule_name,rule_type,prefix_value,new_prefix,priority,status,notes)
SELECT o.id,v.rule_name,'prefix',v.old_prefix,o.new_prefix,200,'active','PURA official Phase 1 allocation; effective 4 September 2026; parallel running ends 30 November 2026.'
FROM operators o JOIN (VALUES
 ('QCELL','QCell 3XXXXXX','3'),('QCELL','QCell 5XXXXXX','5'),
 ('COMIUM','Comium 6XXXXXX','6'),('COMIUM','Comium 84XXXXX','84'),('COMIUM','Comium 85XXXXX','85'),('COMIUM','Comium 86XXXXX','86'),('COMIUM','Comium 87XXXXX','87'),
 ('AFRICELL','Africell 7XXXXXX','7'),('AFRICELL','Africell 2XXXXXX','2'),('AFRICELL','Africell 40XXXXX','40'),('AFRICELL','Africell 41XXXXX','41'),('AFRICELL','Africell 45XXXXX','45')
) AS v(code,rule_name,old_prefix) ON o.code=v.code;

UPDATE transition_settings SET transition_start_date='2026-09-04',transition_end_date='2026-11-30',updated_at=NOW();
