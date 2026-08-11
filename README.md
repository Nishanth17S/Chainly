**To login as an ORG user the tester/reviewer must and should login using these credentials in the current version of the product:**
**Email: orgb.test@gmail.com**
**Password: test@12345**

# ChainLy

ChainLy is a multi-tenant B2B workflow automation platform. It allows organizations to visually build, manage, and execute automated sequences of tasks (LLM calls, HTTP requests, Approval gates, etc.) securely within their isolated workspaces.

## Features

- **Multi-Tenant Architecture:** Secure data isolation using Hasura Row-Level Security (RLS). Every workflow, trigger, and step run is strictly scoped to an Organization (`org_id`).
- **Nhost Authentication & JWT Integration:** Users authenticate via Nhost. Organization membership and roles are securely baked into the JWT via Permission Variables.
- **Workflow Builder:** A clean, intuitive frontend interface for creating multi-step sequential workflows.
- **Real-Time Execution Status:** Live tracking of workflow step execution powered by Apollo GraphQL WebSockets.
- **Approval Gates:** Secure manual intervention steps requiring users with "Editor" or "Owner" roles to authorize paused runs before they continue.
- **Quota Tracking:** Built-in usage tracking to monitor allowed vs used API calls for each organization.

## Tech Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS, Lucide React (Icons)
- **Data Fetching:** Apollo Client v4 (HTTP & WebSocket links)
- **Authentication:** Nhost React Client

### Backend
- **Database:** PostgreSQL (via Hasura/Nhost)
- **API:** Hasura GraphQL Engine (Queries, Mutations, Subscriptions)
- **Custom Logic:** Hasura Actions & Webhooks for triggering workflow runs and handling step approvals.

## Local Development

### Prerequisites
- Node.js
- Nhost CLI (Optional, if running backend locally)

### Setup
1. Clone the repository.
2. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

The frontend is configured and optimized for deployment on **Vercel**. 
Ensure the Vercel project's Root Directory is set to `frontend` so the build cache correctly identifies the Next.js output directory. No environment variables are strictly necessary for the frontend if the Nhost Subdomain and Region fallbacks in `apolloProvider.tsx` match your production Nhost instance.
