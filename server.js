const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 3000);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "kongkong.sqlite");
const PUBLIC_ROOT = __dirname;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const CODE_PATTERN = /^[A-Z2-9]{12}$/;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const database = new DatabaseSync(DB_PATH);
database.exec("PRAGMA journal_mode = WAL");
database.exec("PRAGMA synchronous = NORMAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS user_state (
    sync_hash TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )
`);

const selectState = database.prepare(
  "SELECT state_json, version, updated_at FROM user_state WHERE sync_hash = ?",
);
const upsertState = database.prepare(`
  INSERT INTO user_state (sync_hash, state_json, version, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(sync_hash) DO UPDATE SET
    state_json = excluded.state_json,
    version = excluded.version,
    updated_at = excluded.updated_at
`);

function sendJson(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  });
  response.end(body);
}

function getSyncHash(request) {
  const code = String(request.headers["x-sync-key"] || "").trim().toUpperCase();
  if (!CODE_PATTERN.test(code)) return null;
  return crypto.createHash("sha256").update(code).digest("hex");
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function validateState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  const arrayFields = ["customWords", "deletedDefaultIds", "learnedWords", "wrongWords"];
  const objectFields = ["defaultOverrides", "dailyPlans", "dailyCompleted"];
  return arrayFields.every((field) => Array.isArray(state[field]))
    && objectFields.every((field) => state[field] && typeof state[field] === "object" && !Array.isArray(state[field]));
}

async function handleApi(request, response, pathname) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-Sync-Key",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Max-Age": "86400",
    });
    response.end();
    return;
  }

  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { ok: true, database: "sqlite" });
    return;
  }

  if (pathname !== "/api/state") {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const syncHash = getSyncHash(request);
  if (!syncHash) {
    sendJson(response, 401, { error: "A valid 12-character sync code is required" });
    return;
  }

  if (request.method === "GET") {
    const row = selectState.get(syncHash);
    if (!row) {
      sendJson(response, 200, { state: null, version: 0, updatedAt: null });
      return;
    }
    sendJson(response, 200, {
      state: JSON.parse(row.state_json),
      version: row.version,
      updatedAt: row.updated_at,
    });
    return;
  }

  if (request.method === "PUT") {
    const payload = await readJsonBody(request);
    if (!validateState(payload.state)) {
      sendJson(response, 400, { error: "Invalid state schema" });
      return;
    }
    const current = selectState.get(syncHash);
    const nextVersion = Number(current?.version || 0) + 1;
    const updatedAt = new Date().toISOString();
    upsertState.run(syncHash, JSON.stringify(payload.state), nextVersion, updatedAt);
    sendJson(response, 200, { ok: true, version: nextVersion, updatedAt });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".apk": "application/vnd.android.package-archive",
};

function isPublicPath(pathname) {
  if (pathname.startsWith("/assets/")) return true;
  if (/^\/KongKong-English-v\d+\.\d+\.apk$/.test(pathname)) return true;
  return ["/", "/index.html", "/styles.css", "/app.js", "/manifest.webmanifest", "/sw.js"].includes(pathname);
}

function serveStatic(request, response, pathname) {
  if (!isPublicPath(pathname)) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(PUBLIC_ROOT, relativePath);
  if (!filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`) && filePath !== path.join(PUBLIC_ROOT, "index.html")) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    if (request.headers.accept?.includes("text/html")) {
      return serveStatic(request, response, "/index.html");
    }
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  if (!stat.isFile()) {
    sendJson(response, 404, { error: "Not found" });
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const headers = {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Content-Length": stat.size,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
  if (relativePath === "sw.js") headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
  else if (relativePath === "index.html") headers["Cache-Control"] = "no-cache";
  else headers["Cache-Control"] = "public, max-age=3600";
  if (extension === ".apk") {
    headers["Content-Disposition"] = `attachment; filename="${path.basename(filePath)}"`;
  }

  response.writeHead(200, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url.pathname);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    serveStatic(request, response, url.pathname);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, error.status || 500, { error: error.message || "Server error" });
    else response.end();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`KongKong English server listening on port ${PORT}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
