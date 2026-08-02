import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request) {
  try {
    const { rule_ids } = await request.json();
    if (!rule_ids || rule_ids.length === 0) return NextResponse.json({ status: 'success' });

    const placeholders = rule_ids.map((_, i) => `$${i + 1}`).join(',');
    await pool.query(`DELETE FROM dq_rules_proposed WHERE id IN (${placeholders})`, rule_ids);

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
