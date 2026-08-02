import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request) {
  try {
    const { rule_ids } = await request.json();
    if (!rule_ids || rule_ids.length === 0) return NextResponse.json({ status: 'success' });

    // Iterate to copy rows safely
    for (let id of rule_ids) {
        const res = await pool.query('SELECT * FROM dq_rules_proposed WHERE id = $1', [id]);
        if(res.rows.length > 0) {
            const rule = res.rows[0];
            await pool.query(`
              INSERT INTO dq_rules (
                table_name, column_name, rule_type, rule_config, 
                severity, confidence, generated_by, dq_type
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              rule.table_name, rule.column_name, rule.rule_type, rule.rule_config,
              rule.severity, rule.confidence, rule.generated_by, rule.dq_type
            ]);
        }
    }
    
    const placeholders = rule_ids.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(`DELETE FROM dq_rules_proposed WHERE id IN (${placeholders})`, rule_ids);

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
