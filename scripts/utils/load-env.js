"use strict";

const fs = require("fs");
const path = require("path");

function unquote(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseLine(line) {
  const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*(.*)\s*$/);
  if (!match) return null;
  const [, key, raw] = match;
  return { key, value: unquote(raw) };
}

function loadEnv(envFile = ".env") {
  const envPath = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .forEach((line) => {
      const entry = parseLine(line);
      if (!entry) return;
      if (process.env[entry.key] === undefined) {
        process.env[entry.key] = entry.value;
      }
    });
}

module.exports = { loadEnv };
