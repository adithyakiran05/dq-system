import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request) {
  try {
    const { config_id } = await request.json();
    if (!config_id) {
      return NextResponse.json({ status: 'error', message: 'config_id is required' }, { status: 400 });
    }
    
    await pool.query('DELETE FROM dq_custom_configs WHERE id = $1', [config_id]);
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
