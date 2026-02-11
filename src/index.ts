import { Router } from 'itty-router';

export interface Env {
  AI: any;        // Cloudflare Workers AI binding
  ASSETS: Fetcher; // Static assets binding from wrangler.toml
}

const router = Router();

/* -----------------------------
   API: Health Check
----------------------------- */
router.get('/api/health', () => {
  return new Response('BlueLive Maps Worker OK', {
    headers: { 'content-type': 'text/plain' }
  });
});

/* -----------------------------
   API: Place Search (AI)
----------------------------- */
router.post('/api/search', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as {
      query: string;
      latitude?: number;
      longitude?: number;
    };

    if (!body.query) {
      return json({ error: 'Missing query' }, 400);
    }

    const prompt = `
You are an AI assistant for a maps app called BlueLive Maps.

User query: "${body.query}"
User approximate location: lat=${body.latitude ?? 'unknown'}, lng=${body.longitude ?? 'unknown'}

1. Infer what kind of places they want.
2. Suggest 3–5 related search suggestions.
3. Return 3–7 example places with:
   - name
   - short description
   - latitude (approximate)
   - longitude (approximate)

Respond ONLY as JSON with:
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

    // SAFELY extract raw AI output
    let raw = (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse)
      ? aiResponse.response
      : aiResponse;

    let parsed: any;

    if (!raw) {
      parsed = { suggestions: [], places: [] };
    } else {
      try {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        parsed = { suggestions: [], places: [] };
      }
    }

    // Guarantee valid structure
    if (!Array.isArray(parsed.suggestions)) parsed.suggestions = [];
    if (!Array.isArray(parsed.places)) parsed.places = [];

    return json(parsed);

  } catch (err: any) {
    return json({ error: err?.message ?? 'Search failed' }, 500);
  }
});

/* -----------------------------
   API: 3D Model Generation (AI)
----------------------------- */
router.post('/api/generate-model', async (request: Request, env: Env) => {
  try {
    const body = await request.json() as {
      placeName: string;
      description?: string;
    };

    if (!body.placeName) {
      return json({ error: 'Missing placeName' }, 400);
    }

    const prompt = `
You describe a simple 3D model concept for a place.

Place name: ${body.placeName}
Description: ${body.description ?? 'No extra description'}

Return JSON:
{
  "modelDescription": string
}
The description should talk about basic shapes (boxes, cylinders, spheres), colors, and rough layout.
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

    let raw = (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse)
      ? aiResponse.response
      : aiResponse;

    let parsed: any;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      parsed = {
        modelDescription: `A simple abstract 3D model representing ${body.placeName}.`
      };
    }

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
   CORS Preflight
----------------------------- */
router.options('*', () =>
  new Response(null, {
    status: 204,
    headers: corsHeaders()
  })
);

/* -----------------------------
   STATIC ASSET HANDLER (CATCH‑ALL)
----------------------------- */
router.all('*', async (request: Request, env: Env) => {
  return env.ASSETS.fetch(request);
});

/* -----------------------------
   JSON + CORS HELPERS
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
   WORKER EXPORT (FIXED)
----------------------------- */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.handle(request, env, ctx);
  }
};
