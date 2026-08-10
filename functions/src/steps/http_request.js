/**
 * http_request step handler.
 *
 * config shape:
 *   {
 *     url: "https://...",
 *     method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
 *     headers: { "key": "value" },
 *     body: { ... }          // only for non-GET; {{previous_output}} interpolated
 *   }
 */

const { serializeOutput } = require('../utils');

const RETRY_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function interpolate(value, previousOutput) {
  if (typeof value === 'string') {
    return value.replace(/\{\{previous_output\}\}/g, serializeOutput(previousOutput));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, interpolate(v, previousOutput)]),
    );
  }
  return value;
}

async function makeRequest(config, previousOutput) {
  const { default: fetch } = await import('node-fetch');

  const method = (config.method || 'GET').toUpperCase();
  const url = config.url;
  if (!url) throw new Error('http_request config missing url');

  const headers = interpolate(config.headers || {}, previousOutput);
  const bodyObj = ['GET', 'HEAD'].includes(method)
    ? undefined
    : interpolate(config.body || {}, previousOutput);

  const fetchOptions = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (bodyObj !== undefined) {
    fetchOptions.body = JSON.stringify(bodyObj);
  }

  const res = await fetch(url, fetchOptions);
  let responseBody;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    responseBody = await res.json();
  } else {
    responseBody = await res.text();
  }

  if (!res.ok) {
    throw new Error(`http_request ${res.status} from ${url}: ${JSON.stringify(responseBody)}`);
  }

  return { status: res.status, body: responseBody };
}

/**
 * Execute an http_request step with one retry on failure.
 * Returns { output, attemptCount }.
 */
async function executeHttpRequest(config, previousOutput) {
  try {
    const output = await makeRequest(config, previousOutput);
    return { output, attemptCount: 1 };
  } catch (firstErr) {
    await sleep(RETRY_DELAY_MS);
    try {
      const output = await makeRequest(config, previousOutput);
      return { output, attemptCount: 2 };
    } catch (secondErr) {
      throw new Error(`http_request failed after 2 attempts: ${secondErr.message}`);
    }
  }
}

module.exports = { executeHttpRequest };
