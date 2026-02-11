export interface Env {
  AI: any;
  ASSETS: Fetcher;
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'Content-Type',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders()
    }
  });
}

function safeJsonParse(raw: any, fallback: any) {
  try {
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
  } catch {
    return fallback;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    // HEALTH CHECK
    if (pathname === '/api/health' && request.method === 'GET') {
      return new Response('BlueLive Maps Worker OK', {
        headers: { 'content-type': 'text/plain', ...corsHeaders() }
      });
    }

    // PLACE SEARCH
    if (pathname === '/api/search' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => null) as {
          query?: string;
          latitude?: number;
          longitude?: number;
        } | null;

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
          : (aiResponse && (aiResponse as any).response) ?? '';

        const parsed = safeJsonParse(raw, { suggestions: [], places: [] });

        if (!Array.isArray(parsed.suggestions)) parsed.suggestions = [];
        if (!Array.isArray(parsed.places)) parsed.places = [];

        return json(parsed);
      } catch (err: any) {
        return json({ error: err?.message ?? 'Search failed' }, 500);
      }
    }

    // 3D MODEL GENERATION
    if (pathname === '/api/generate-model' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => null) as {
          placeName?: string;
          description?: string;
        } | null;

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
          : (aiResponse && (aiResponse as any).response) ?? '';

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
    }

    // STATIC ASSETS (fallback)
    return env.ASSETS.fetch(request);
  }
};
