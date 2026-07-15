WITH next_version AS (SELECT COALESCE(MAX(version_number),0)+1 AS n FROM rules_versions),
payload AS (SELECT jsonb_build_object(
 'versionNumber',(SELECT n FROM next_version),'publishedAt',NOW(),
 'operators',(SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code,'newPrefix',new_prefix,'color',color,'status',status,'notes',notes,'createdAt',created_at,'updatedAt',updated_at) ORDER BY name) FROM operators),
 'rules',(SELECT jsonb_agg(jsonb_build_object('id',mr.id,'operatorId',mr.operator_id,'operatorName',o.name,'operatorCode',o.code,'ruleName',mr.rule_name,'ruleType',mr.rule_type,'prefixValue',mr.prefix_value,'rangeFrom',mr.range_from,'rangeTo',mr.range_to,'exactNumber',mr.exact_number,'newPrefix',mr.new_prefix,'priority',mr.priority,'status',mr.status,'notes',mr.notes,'createdAt',mr.created_at,'updatedAt',mr.updated_at) ORDER BY mr.priority DESC,mr.created_at) FROM migration_rules mr JOIN operators o ON o.id=mr.operator_id WHERE mr.status='active' AND o.status='active')
) AS body)
INSERT INTO rules_versions(version_number,rules_json,published_by,status)
SELECT n,body,(SELECT id FROM admins WHERE role='owner' AND status='active' ORDER BY created_at LIMIT 1),'published' FROM next_version,payload;
