import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const configText = body.config_text;

    const agentUrl = process.env.AGENT_URL || 'http://127.0.0.1:8080';
    
    const response = await fetch(`${agentUrl}/configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ config_text: configText })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to save config to agent");
    }

    return NextResponse.json({ status: 'success', message: 'Config saved' });
  } catch (error) {
    console.error("Config Save Failed:", error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
