import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { projectId, message, context } = await request.json();

    if (!projectId || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
You are an AI mentor helping a developer build their project. Be helpful, encouraging, and provide specific guidance.

Project context:
- Project: ${context.projectTitle || 'Unknown'}
- Current milestone: ${context.currentMilestone?.title || 'Getting started'}

User question: "${message}"

Provide a helpful, concise response (2-4 sentences). If they're stuck, offer specific suggestions or resources. If they're doing well, encourage them and suggest next steps.
`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    return NextResponse.json({ response: responseText });
  } catch (error: any) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { error: 'Failed to get chat response', details: error.message },
      { status: 500 }
    );
  }
}
