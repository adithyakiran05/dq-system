import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { tableName, payload } = body;

    if (!tableName || !payload || Object.keys(payload).length === 0) {
      return NextResponse.json({ status: 'error', message: 'Table name and payload are required' }, { status: 400 });
    }

    // Extract columns and values from payload
    const columns = Object.keys(payload);
    const values = Object.values(payload);

    // Validate table and column names to prevent SQL injection on identifiers
    // Only allow alphanumeric and underscores
    const isValidIdentifier = (str) => /^[a-zA-Z0-9_]+$/.test(str);
    if (!isValidIdentifier(tableName) || !columns.every(isValidIdentifier)) {
      return NextResponse.json({ status: 'error', message: 'Invalid table or column names' }, { status: 400 });
    }

    // Construct the parameter placeholders (e.g. $1, $2, $3)
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const columnsStr = columns.join(', ');

    const query = `INSERT INTO ${tableName} (${columnsStr}) VALUES (${placeholders}) RETURNING *`;
    
    const result = await pool.query(query, values);

    return NextResponse.json({ 
      status: 'success', 
      message: 'Record inserted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Insert Error:', error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
