require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const { triggerWorkflowRun } = require('./src/handlers/triggerWorkflowRun');
const { approveStep } = require('./src/handlers/approveStep');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// Hasura Action: triggerWorkflowRun
app.post('/trigger-workflow-run', triggerWorkflowRun);

// Hasura Action: approveStep
app.post('/approve-step', approveStep);

const PORT = process.env.FUNCTIONS_PORT || 3001;
app.listen(PORT, () => {
  console.log(`[chainly-functions] Server running on http://localhost:${PORT}`);
  console.log(`  POST /trigger-workflow-run`);
  console.log(`  POST /approve-step`);
  console.log(`  GET  /health`);
});
