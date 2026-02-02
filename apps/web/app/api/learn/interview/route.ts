
import { runInterviewStep } from '@/lib/ai/agents/interview/machine';
import { isAIConfigured, getAIProviderInfo } from '@/lib/ai/registry';
import { auth } from '@/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { messages, interviewState, interviewContext } = await req.json();

  if (!isAIConfigured()) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 }
    );
  }

  const input = messages && messages.length > 0 ? messages[messages.length - 1].content : '';
  const currentState = interviewState || 'IDLE';
  const currentContext = interviewContext || {};

  try {
    const result = await runInterviewStep(currentState, input, currentContext);
    
    const response = result.stream;
    
    // Set headers for client-side state management
    response.headers.set('X-Nexus-Interview-State', result.nextState);
    
    if (Object.keys(result.contextUpdates).length > 0) {
      // Ensure context updates are JSON stringified and safe for headers
      response.headers.set('X-Nexus-Interview-Context', JSON.stringify(result.contextUpdates));
    }
    
    return response;
  } catch (error) {
    console.error('Interview API Error:', error);
    return Response.json(
      { error: 'Failed to generate interview response' },
      { status: 500 }
    );
  }
}
