import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT *
      FROM dq_profiles
      ORDER BY table_name, column_name;
    `);

    // Group the results by table_name for easier consumption by the frontend
    const database = {};
    result.rows.forEach(row => {
      if (!database[row.table_name]) {
        database[row.table_name] = [];
      }
      database[row.table_name].push(row);
    });

    return NextResponse.json({ status: 'success', data: database });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
