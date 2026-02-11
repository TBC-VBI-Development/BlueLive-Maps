import { Router } from 'itty-router';

export interface Env {
  AI: any;
  ASSETS: Fetcher;
}

const router = Router();

/* -----------------------------
   HEALTH CHECK
----------------------------- */
router.get('/api/health', () => {
  return new Response('BlueLive Maps Worker OK', {
    headers: { 'content-type': 'text/plain' }
  });
});

/* -----------------------------
   SAFE JSON PARSER
----------------------------- */
function safeJsonParse(raw: any, fallback: any) {
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
  } catch {
    return fallback;
  }
}

/* -----------------------------
   PLACE SEARCH
----------------------------- */
router.post('/api/search', async (request: Request, env: Env) => {
  try {
    const body = await request.json().catch(() => null);

    if (!body?.query) {
      return json({ error: 'Missing query' }, 400);
    }

    const prompt = `
You are an AI assistant for a maps app called BlueLive Maps.

User query: "${body.query}"
User approximate location: lat=${body.latitude ?? 'unknown'}, lng=${body.longitude ?? 'unknown'}

1. Suggest 3–5 related search suggestions.
2. Provide 3–7 example places with:
   - name
   - description
   - latitude
   - longitude

Respond ONLY as JSON:
{
  "suggestions": string[],
  "places": {
    "name": string,
    "description": string,
    "latitude": number,
    "longitude": number
  }[]
}
`;

    const aiResponse = await env.AI.run(
      '@cf/mistral/mistral-7b-instruct-v0.1',
      {
        messages: [
          { role: 'system', content: 'You generate structured JSON for a maps app.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.6
      }
    );

    const raw = typeof aiResponse === 'string'
      ? aiResponse
      : aiResponse?.response ?? '';

    const parsed = safeJsonParse(raw, { suggestions: [], places: [] });

    if (!Array.isArray(parsed.suggestions)) parsed.suggestions = [];
    if (!Array.isArray(parsed.places)) parsed.places = [];

    return json(parsed);

  } catch (err: any) {
    return json({ error: err?.message ?? 'Search failed' }, 500);
  }
});

/* -----------------------------
   3D MODEL GENERATION
----------------------------- */
router.post('/api/generate-model', async (request: Request, env: Env) => {
  try {
    const body = await request.json().catch(() => null);

    if (!body?.placeName) {
      return json({ error: 'Missing placeName' }, 400);
    }

    const prompt = `
Describe a simple 3D model concept for this place:

Name: ${body.placeName}
Description: ${body.description ?? 'No description'}

Return JSON:
{
  "modelDescription": string
}
`;

    const aiResponse = await env.AI.run(
      '@cf/mistral/mistral-7b-instruct-v0.1',
      {
        messages: [
          { role: 'system', content: 'You design simple 3D model descriptions.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 256,
        temperature: 0.7
      }
    );

    const raw = typeof aiResponse === 'string'
      ? aiResponse
      : aiResponse?.response ?? '';

    const parsed = safeJsonParse(raw, {
      modelDescription: `A simple abstract 3D model representing ${body.placeName}.`
    });

    if (typeof parsed.modelDescription !== 'string') {
      parsed.modelDescription = `A simple abstract 3D model representing ${body.placeName}.`;
    }

    return json({
      ...parsed,
      placeName: body.placeName,
      generatedAt: new Date().toISOString()
    });

  } catch (err: any) {
    return json({ error: err?.message ?? 'Model generation failed' }, 500);
  }
});

/* -----------------------------
   CORS
----------------------------- */
router.options('*', () =>
  new Response(null, {
    status: 204,
    headers: corsHeaders()
  })
);

/* -----------------------------
   STATIC ASSETS (CATCH‑ALL)
----------------------------- */
router.all('*', async (request: Request, env: Env) => {
  return env.ASSETS.fetch(request);
});

/* -----------------------------
   HELPERS
----------------------------- */
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders()
    }
  });
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Content-Type',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
}

/* -----------------------------
   WORKER EXPORT
----------------------------- */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.handle(request, env, ctx);
  }
};
