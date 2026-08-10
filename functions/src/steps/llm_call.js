/**
 * llm_call step handler.
 *
 * config shape:
 *   { model: "llama3-8b-8192", prompt: "...", system: "..." }
 *
 * The prompt may contain {{previous_output}} which is replaced with the
 * text from the previous step (or full JSON if no .text field exists).
 */

const { serializeOutput } = require('../utils');

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama3-8b-8192';
const RETRY_DELAY_MS = 1500;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGroq(config, previousOutput) {
  const { default: fetch } = await import('node-fetch');
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set in environment');

  const model = config.model || DEFAULT_MODEL;

  // Interpolate {{previous_output}} placeholder in the prompt
  const rawPrompt = config.prompt || '';
  const prompt = rawPrompt.replace(
    /\{\{previous_output\}\}/g,
    serializeOutput(previousOutput),
  );

  const messages = [];
  if (config.system) {
    messages.push({ role: 'system', content: config.system });
  }
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API ${res.status}: ${text}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? null;
  return { text: content, raw: json };
}

/**
 * Execute an llm_call step with one retry on failure.
 * Returns { output, attemptCount }.
 */
async function executeLlmCall(config, previousOutput) {
  try {
    const output = await callGroq(config, previousOutput);
    return { output, attemptCount: 1 };
  } catch (firstErr) {
    await sleep(RETRY_DELAY_MS);
    try {
      const output = await callGroq(config, previousOutput);
      return { output, attemptCount: 2 };
    } catch (secondErr) {
      throw new Error(`llm_call failed after 2 attempts: ${secondErr.message}`);
    }
  }
}

module.exports = { executeLlmCall };
