import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const triggerUrl = process.env.NEXT_PUBLIC_TRIGGER_API_URL;
    
    if (!triggerUrl) {
      console.warn("NEXT_PUBLIC_TRIGGER_API_URL is not set. Simulating success for local testing.");
      return NextResponse.json({ status: 'success', logs: "Simulated response" });
    }

    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // You can add authentication headers here if your API Gateway requires it
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to trigger Lambda");
    }

    return NextResponse.json({ status: 'success', logs: data });
  } catch (error) {
    console.error("Trigger Failed:", error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
