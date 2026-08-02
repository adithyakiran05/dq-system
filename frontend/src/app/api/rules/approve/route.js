import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request) {
  try {
    const { rule_id } = await request.json();
    
    // 1. Fetch the proposed rule
    const res = await pool.query('SELECT * FROM dq_rules_proposed WHERE id = $1', [rule_id]);
    if (res.rows.length === 0) {
      return NextResponse.json({ status: 'error', message: 'Rule not found' }, { status: 404 });
    }
    
    const rule = res.rows[0];
    
    // 2. Insert into dq_rules
    await pool.query(`
      INSERT INTO dq_rules (
        table_name, column_name, rule_type, rule_config, 
        severity, confidence, generated_by, dq_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      rule.table_name, rule.column_name, rule.rule_type, rule.rule_config,
      rule.severity, rule.confidence, rule.generated_by, rule.dq_type
    ]);
    
    // 3. Delete from proposed
    await pool.query('DELETE FROM dq_rules_proposed WHERE id = $1', [rule_id]);
    
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
