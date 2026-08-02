import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request) {
  try {
    const { rule_id } = await request.json();
    await pool.query('DELETE FROM dq_rules_proposed WHERE id = $1', [rule_id]);
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
