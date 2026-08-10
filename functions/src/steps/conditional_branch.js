/**
 * conditional_branch step handler.
 *
 * config shape:
 *   {
 *     field: "text",              // dot-path into previousOutput, e.g. "body.score"
 *     operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists",
 *     value: <any>,               // the comparand
 *     true_branch: 3,             // step_order to jump to if condition is true
 *     false_branch: 4             // step_order to jump to if condition is false (optional)
 *   }
 *
 * Returns { output, nextStepOrder }
 *   nextStepOrder: null means continue sequentially, a number means jump to that step_order.
 */

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

function evaluate(operator, actual, expected) {
  switch (operator) {
    case 'eq':       return actual == expected;         // loose equality intentional
    case 'neq':      return actual != expected;
    case 'gt':       return Number(actual) > Number(expected);
    case 'gte':      return Number(actual) >= Number(expected);
    case 'lt':       return Number(actual) < Number(expected);
    case 'lte':      return Number(actual) <= Number(expected);
    case 'contains': return String(actual).includes(String(expected));
    case 'exists':   return actual !== undefined && actual !== null;
    default:         throw new Error(`Unknown operator: ${operator}`);
  }
}

function executeConditionalBranch(config, previousOutput) {
  const { field, operator, value, true_branch, false_branch } = config;
  if (!operator) throw new Error('conditional_branch config missing operator');

  const actual = field ? getNestedValue(previousOutput, field) : previousOutput;
  const conditionMet = evaluate(operator, actual, value);

  const nextStepOrder = conditionMet
    ? (true_branch ?? null)
    : (false_branch ?? null);

  return {
    output: { condition_met: conditionMet, field, actual, expected: value, operator },
    nextStepOrder,
  };
}

module.exports = { executeConditionalBranch };
