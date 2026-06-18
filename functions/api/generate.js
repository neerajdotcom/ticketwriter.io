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

Return ONLY a valid JSON array of ticket objects, no markdown, no preamble, no explanation.`;

function extractJsonArray(text) {
  try {
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
  } catch (_) {}

  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }

  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;

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

  if (!env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'Server is not configured with an API key' }, { status: 500 });
  }

  let apiRes;
  try {
    apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Feedback:\n${feedback}\n\nReturn only the JSON array.` }]
      })
    });
  } catch (err) {
    return Response.json({ error: `Could not reach Claude API: ${err.message}` }, { status: 502 });
  }

  const data = await apiRes.json();

  if (!apiRes.ok || data.error) {
    return Response.json({ error: data.error?.message || `API error (${apiRes.status})` }, { status: 502 });
  }

  const rawText = (data.content || [])
    .filter(item => item.type === 'text')
    .map(item => item.text || '')
    .join('');

  const tickets = extractJsonArray(rawText);

  if (!tickets) {
    return Response.json({ error: 'Could not parse tickets from model response' }, { status: 502 });
  }

  return Response.json({ tickets });
}
