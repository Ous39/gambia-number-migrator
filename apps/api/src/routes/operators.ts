import { Router } from 'express';
import { operatorSchema } from '@gnm/shared';
import { query } from '../db/pool';
import { requireAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { audit } from '../services/auditService';
import { mapOperator } from '../utils/mapRows';

export const operatorsRouter = Router();

operatorsRouter.get('/operators', async (_req, res, next) => {
  try { res.json({ data: (await query('SELECT * FROM operators ORDER BY name')).rows.map(mapOperator) }); } catch (e) { next(e); }
});

operatorsRouter.post('/operators', requireAdmin, validateBody(operatorSchema), async (req, res, next) => {
  try {
    const b = req.body;
    const r = await query(`INSERT INTO operators (name, code, new_prefix, color, status, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [b.name, b.code.toUpperCase(), b.newPrefix, b.color, b.status, b.notes]);
    await audit(req, 'operator_created', 'operator', r.rows[0].id, null, r.rows[0]);
    res.status(201).json({ data: mapOperator(r.rows[0]) });
  } catch (e) { next(e); }
});

operatorsRouter.put('/operators/:id', requireAdmin, validateBody(operatorSchema), async (req, res, next) => {
  try {
    const old = (await query('SELECT * FROM operators WHERE id=$1', [req.params.id])).rows[0];
    if (!old) return res.status(404).json({ message: 'Operator not found' });
    const b = req.body;
    const r = await query(`UPDATE operators SET name=$1, code=$2, new_prefix=$3, color=$4, status=$5, notes=$6, updated_at=NOW() WHERE id=$7 RETURNING *`, [b.name, b.code.toUpperCase(), b.newPrefix, b.color, b.status, b.notes, req.params.id]);
    await audit(req, 'operator_updated', 'operator', String(req.params.id), old, r.rows[0]);
    res.json({ data: mapOperator(r.rows[0]) });
  } catch (e) { next(e); }
});

operatorsRouter.delete('/operators/:id', requireAdmin, async (req, res, next) => {
  try {
    const r = await query(`UPDATE operators SET status='disabled', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ message: 'Operator not found' });
    await audit(req, 'operator_disabled', 'operator', String(req.params.id), null, r.rows[0]);
    res.json({ data: mapOperator(r.rows[0]) });
  } catch (e) { next(e); }
});
