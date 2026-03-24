const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "db.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function ensureDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ items: [] }, null, 2));
  }
}

function readDatabase() {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDatabase(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function validateItem(payload) {
  const requiredFields = ["type", "name", "location", "desc", "contact", "image"];
  const hasMissingField = requiredFields.some((field) => {
    return typeof payload[field] !== "string" || payload[field].trim() === "";
  });

  if (hasMissingField) {
    return "All item fields are required.";
  }

  if (!["lost", "found"].includes(payload.type)) {
    return 'Item type must be either "lost" or "found".';
  }

  return null;
}

function handleApiRequest(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/items") {
    const database = readDatabase();
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();

    const items = !search
      ? database.items
      : database.items.filter((item) => {
          const haystack = [item.name, item.location, item.desc, item.contact, item.type]
            .join(" ")
            .toLowerCase();
          return haystack.includes(search);
        });

    return sendJson(res, 200, { items });
  }

  if (req.method === "POST" && url.pathname === "/api/items") {
    return collectRequestBody(req)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const validationError = validateItem(payload);

        if (validationError) {
          return sendJson(res, 400, { error: validationError });
        }

        const database = readDatabase();
        const item = {
          id: randomUUID(),
          type: payload.type,
          name: payload.name.trim(),
          location: payload.location.trim(),
          desc: payload.desc.trim(),
          contact: payload.contact.trim(),
          image: payload.image,
          time: payload.time || new Date().toLocaleString()
        };

        database.items.unshift(item);
        writeDatabase(database);
        return sendJson(res, 201, { item });
      })
      .catch((error) => {
        if (error instanceof SyntaxError) {
          return sendJson(res, 400, { error: "Invalid JSON payload." });
        }

        return sendJson(res, 500, { error: "Unable to save item." });
      });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/items/")) {
    const itemId = url.pathname.split("/").pop();
    const database = readDatabase();
    const nextItems = database.items.filter((item) => item.id !== itemId);

    if (nextItems.length === database.items.length) {
      return sendJson(res, 404, { error: "Item not found." });
    }

    writeDatabase({ items: nextItems });
    return sendJson(res, 200, { success: true });
  }

  return sendJson(res, 404, { error: "Not found." });
}

function serveStaticFile(res, filePath) {
  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end(error.code === "ENOENT" ? "File not found." : "Internal server error.");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    handleApiRequest(req, res, url);
    return;
  }

  let filePath = path.join(ROOT, url.pathname === "/" ? "index.html" : url.pathname);
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  serveStaticFile(res, filePath);
});

ensureDatabase();

server.listen(PORT, () => {
  console.log(`Lost & Found server running at http://localhost:${PORT}`);
});