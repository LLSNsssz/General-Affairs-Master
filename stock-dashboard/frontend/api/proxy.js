const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

module.exports = async function handler(req, res) {
  const backendBaseUrl = process.env.BACKEND_API_BASE_URL;

  if (!backendBaseUrl) {
    return res.status(500).json({
      detail: "BACKEND_API_BASE_URL is not configured on Vercel."
    });
  }

  const targetUrl = buildTargetUrl(backendBaseUrl, req.query);
  const headers = forwardHeaders(req.headers);

  try {
    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: buildBody(req),
    });

    upstreamResponse.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.status(upstreamResponse.status);
    const payload = Buffer.from(await upstreamResponse.arrayBuffer());
    res.send(payload);
  } catch (error) {
    res.status(502).json({
      detail: "Backend proxy request failed.",
      error: String(error),
    });
  }
};

function buildTargetUrl(backendBaseUrl, query) {
  const path = Array.isArray(query.path) ? query.path.join("/") : query.path || "";
  const normalizedBase = backendBaseUrl.endsWith("/") ? backendBaseUrl : `${backendBaseUrl}/`;
  const url = new URL(`api/${path}`, normalizedBase);

  for (const [key, value] of Object.entries(query)) {
    if (key === "path" || value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => url.searchParams.append(key, entry));
      continue;
    }

    url.searchParams.append(key, value);
  }

  return url.toString();
}

function forwardHeaders(headers) {
  const nextHeaders = {};

  for (const [key, value] of Object.entries(headers)) {
    const normalizedKey = key.toLowerCase();
    if (!value || normalizedKey === "host" || HOP_BY_HOP_HEADERS.has(normalizedKey)) {
      continue;
    }

    nextHeaders[key] = Array.isArray(value) ? value.join(",") : value;
  }

  return nextHeaders;
}

function buildBody(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  if (req.body == null) {
    return undefined;
  }

  if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
    return req.body;
  }

  return JSON.stringify(req.body);
}
