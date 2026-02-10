// node_modules/itty-router/index.mjs
var t = ({ base: e = "", routes: t2 = [], ...r2 } = {}) => ({ __proto__: new Proxy({}, { get: (r3, o2, a, s) => (r4, ...c) => t2.push([o2.toUpperCase?.(), RegExp(`^${(s = (e + r4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>*))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), c, s]) && a }), routes: t2, ...r2, async fetch(e2, ...o2) {
  let a, s, c = new URL(e2.url), n = e2.query = { __proto__: null };
  for (let [e3, t3] of c.searchParams) n[e3] = n[e3] ? [].concat(n[e3], t3) : t3;
  e: try {
    for (let t3 of r2.before || []) if (null != (a = await t3(e2.proxy ?? e2, ...o2))) break e;
    t: for (let [r3, n2, l, i] of t2) if ((r3 == e2.method || "ALL" == r3) && (s = c.pathname.match(n2))) {
      e2.params = s.groups || {}, e2.route = i;
      for (let t3 of l) if (null != (a = await t3(e2.proxy ?? e2, ...o2))) break t;
    }
  } catch (t3) {
    if (!r2.catch) throw t3;
    a = await r2.catch(t3, e2.proxy ?? e2, ...o2);
  }
  try {
    for (let t3 of r2.finally || []) a = await t3(a, e2.proxy ?? e2, ...o2) ?? a;
  } catch (t3) {
    if (!r2.catch) throw t3;
    a = await r2.catch(t3, e2.proxy ?? e2, ...o2);
  }
  return a;
} });
var r = (e = "text/plain; charset=utf-8", t2) => (r2, o2 = {}) => {
  if (void 0 === r2 || r2 instanceof Response) return r2;
  const a = new Response(t2?.(r2) ?? r2, o2.url ? void 0 : o2);
  return a.headers.set("content-type", e), a;
};
var o = r("application/json; charset=utf-8", JSON.stringify);
var p = r("text/plain; charset=utf-8", String);
var f = r("text/html");
var u = r("image/jpeg");
var h = r("image/png");
var g = r("image/webp");

// src/index.ts
var router = t();
router.get("/api/health", () => {
  return new Response("BlueLive Maps Worker OK", {
    headers: { "content-type": "text/plain" }
  });
});
router.post("/api/search", async (request, env) => {
  try {
    const body = await request.json();
    if (!body.query) {
      return json({ error: "Missing query" }, 400);
    }
    const prompt = `
You are an AI assistant for a maps app called BlueLive Maps.

User query: "${body.query}"
User approximate location: lat=${body.latitude ?? "unknown"}, lng=${body.longitude ?? "unknown"}

1. Infer what kind of places they want.
2. Suggest 3\u20135 related search suggestions.
3. Return 3\u20137 example places with:
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
      "@cf/mistral/mistral-7b-instruct-v0.1",
      {
        messages: [
          { role: "system", content: "You generate structured JSON for a maps app." },
          { role: "user", content: prompt }
        ],
        max_tokens: 512,
        temperature: 0.6
      }
    );
    let parsed;
    try {
      parsed = JSON.parse(aiResponse.response ?? aiResponse);
    } catch {
      parsed = {
        suggestions: ["Popular places", "Nearby landmarks"],
        places: []
      };
    }
    return json(parsed);
  } catch (err) {
    return json({ error: err?.message ?? "Search failed" }, 500);
  }
});
router.post("/api/generate-model", async (request, env) => {
  try {
    const body = await request.json();
    if (!body.placeName) {
      return json({ error: "Missing placeName" }, 400);
    }
    const prompt = `
You describe a simple 3D model concept for a place.

Place name: ${body.placeName}
Description: ${body.description ?? "No extra description"}

Return JSON:
{
  "modelDescription": string
}
The description should talk about basic shapes (boxes, cylinders, spheres), colors, and rough layout.
`;
    const aiResponse = await env.AI.run(
      "@cf/mistral/mistral-7b-instruct-v0.1",
      {
        messages: [
          { role: "system", content: "You design simple 3D model descriptions." },
          { role: "user", content: prompt }
        ],
        max_tokens: 256,
        temperature: 0.7
      }
    );
    let parsed;
    try {
      parsed = JSON.parse(aiResponse.response ?? aiResponse);
    } catch {
      parsed = {
        modelDescription: `A simple abstract 3D model representing ${body.placeName}.`
      };
    }
    return json({
      ...parsed,
      placeName: body.placeName,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    return json({ error: err?.message ?? "Model generation failed" }, 500);
  }
});
router.options(
  "*",
  () => new Response(null, {
    status: 204,
    headers: corsHeaders()
  })
);
router.all("*", async (request, env) => {
  return env.ASSETS.fetch(request);
});
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders()
    }
  });
}
function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "Content-Type",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  };
}
var index_default = {
  fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
};
export {
  index_default as default
};
