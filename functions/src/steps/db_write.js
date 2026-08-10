/**
 * db_write step handler. OWNER-ONLY step type.
 *
 * Layer-2 enforcement: this handler is only reached if the runtime check
 * in triggerWorkflowRun confirmed the step was created by an owner.
 * Additionally, the Hasura insert permission on workflow_steps blocks
 * editors from even creating this step type.
 *
 * config shape:
 *   {
 *     table: "public.my_table",     // schema-qualified target table
 *     data: { col: "{{previous_output.field}}" }  // values to insert
 *   }
 *
 * Inserts one row into the specified table using admin privileges.
 */

const { adminQuery } = require('../hasura');
const { serializeOutput } = require('../utils');

function interpolateValue(value, previousOutput) {
  if (typeof value === 'string') {
    // Support {{previous_output}} or {{previous_output.some.field}}
    return value.replace(/\{\{previous_output(?:\.(\w[\w.]*)?)?\}\}/g, (_match, path) => {
      if (!path) return serializeOutput(previousOutput);
      const nested = path.split('.').reduce((acc, k) => acc?.[k], previousOutput);
      return nested != null ? String(nested) : 'null';
    });
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, interpolateValue(v, previousOutput)]),
    );
  }
  return value;
}

async function executeDbWrite(config, previousOutput) {
  const { table, data } = config;
  if (!table) throw new Error('db_write config missing table');
  if (!data || typeof data !== 'object') throw new Error('db_write config missing data object');

  // Derive Hasura mutation name from table: "public.my_table" → "insert_my_table_one"
  const tableName = table.includes('.') ? table.split('.')[1] : table;
  const mutationName = `insert_${tableName}_one`;

  const interpolatedData = interpolateValue(data, previousOutput);

  const mutation = `
    mutation DbWrite($object: ${tableName}_insert_input!) {
      ${mutationName}(object: $object) {
        id
      }
    }
  `;

  const result = await adminQuery(mutation, { object: interpolatedData });
  return { inserted: result[mutationName] };
}

module.exports = { executeDbWrite };
