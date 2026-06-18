const SYSTEM_PROMPT = `You are assisting a Game Producer at a co-development iGaming studio (2D slots and Virtual Sports).

Your job is to read raw producer or client feedback and convert it into structured Jira tickets ready to be actioned by artists or developers.

Context:
- Studio works on game art pipelines: symbols, animations, win sequences, UI, logos, popups
- Feedback comes from producers, art directors, or clients and is often conversational and multi-topic
- Each distinct issue must become its own ticket — never bundle unrelated items
- Tickets must be written so an artist can start work without asking follow-up questions

For each ticket output:
- summary: verb-led, max 80 chars
- type: Task / Bug / Improvement
- priority: infer from feedback tone (Critical = broken, High = visible issue, Medium = polish, Low = minor)
- description: 2-3 sentences, written for the artist — context, what to do, why
- acceptance_criteria: 4-6 concrete testable conditions, each starting with a verb or noun
- references_needed: only if determinable from the feedback (omit the field or use an empty array otherwise)

Return ONLY a valid JSON object of the form {"tickets": [...]}, no markdown, no preamble, no explanation.`;

function extractJsonArray(text) {
  const tryParse = (raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.tickets)) return parsed.tickets;
    } catch (_) {}
    return null;
  };

  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const direct = tryParse(clean);
  if (direct) return direct;

  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    const parsed = tryParse(objMatch[0]);
    if (parsed) return parsed;
  }

  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    const parsed = tryParse(arrMatch[0]);
    if (parsed) return parsed;
  }

  return null;
}

async function handleGenerate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const feedback = (body.feedback || '').trim();
  if (!feedback) {
    return Response.json({ error: 'Missing feedback text' }, { status: 400 });
  }

  let aiRes;
  try {
    aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Feedback:\n${feedback}\n\nReturn only the JSON object.` }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature: 0.2
    });
  } catch (err) {
    return Response.json({ error: `Could not reach Workers AI: ${err.message}` }, { status: 502 });
  }

  const rawText = aiRes.response || '';

  const tickets = extractJsonArray(rawText);

  if (!tickets) {
    return Response.json({ error: 'Could not parse tickets from model response' }, { status: 502 });
  }

  return Response.json({ tickets });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate' && request.method === 'POST') {
      return handleGenerate(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};
