/**
 * Shared output serializer for {{previous_output}} template substitution.
 *
 * When a previous step's output has a `.text` property (e.g. llm_call returns
 * { text: "...", raw: {...} }), we use the clean text string directly.
 * For all other shapes, we fall back to JSON.stringify so downstream steps
 * still get something useful.
 *
 * @param {any} previousOutput - the output object from the prior step
 * @returns {string}
 */
function serializeOutput(previousOutput) {
  if (previousOutput == null) return 'null';
  if (typeof previousOutput.text === 'string') return previousOutput.text;
  if (typeof previousOutput === 'string') return previousOutput;
  return JSON.stringify(previousOutput);
}

module.exports = { serializeOutput };
