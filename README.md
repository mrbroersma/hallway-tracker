# Hallway Desk

A Chromebook-friendly hallway tracker for teachers. Create passes with a reason, check students back in, see the shared hallway list, and configure pairs or groups that cannot be out together. Separation checks run on the server, including when two classrooms issue passes simultaneously.

**This repository contains code only. Student records live in your Cloudflare D1 database.**

## Get it live

You need your GitHub account and a Cloudflare account. A custom domain is optional: Cloudflare supplies a `workers.dev` address.

### 1. Create the database

In Cloudflare, open **Storage & databases → D1 SQL Database → Create database**. Name it **hallway-tracker**. Copy the database ID.

In this repository, edit `wrangler.jsonc`: replace `00000000-0000-4000-8000-000000000000` with that database ID and commit the change. The database ID is a configuration identifier, not a password.

### 2. Connect the GitHub repository

In Cloudflare, open **Workers & Pages → Create application → Import a repository** (or **Connect to Git**), choose GitHub, and select `mrbroersma/hallway-tracker`.

Use these build settings:

| Setting | Value |
| --- | --- |
| Worker name | `hallway-tracker` |
| Production branch | `main` |
| Root directory | repository root |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Node version | `22` (also recorded in `.node-version`) |

If the dashboard asks for a non-production branch deploy command, disable non-production builds for now. Do not point branch previews at the live school database.

The deploy command applies the versioned SQL migration before deploying the built Worker. If D1 migration permission is denied, grant the Worker's Cloudflare build token access to this account's D1 database and retry. No Cloudflare token belongs in GitHub source files.

The first deployment deliberately displays **“Hallway Desk is locked until staff sign-in is configured.”** Complete step 3 to unlock it.

### 3. Configure staff sign-in

1. Enable Cloudflare Zero Trust for your account if you have not already.
2. Open **Workers & Pages → hallway-tracker → Access → Protect this Worker behind Access**. Choose **All traffic**, covering production and previews. A hostname-based self-hosted Access application also works if it covers every enabled app address.
3. Create an **Allow** policy containing the specific staff email addresses permitted to use the app. For a school domain that also contains students, use specific staff addresses or a staff group rather than allowing the entire domain. Email one-time PIN is an option; a configured Google identity provider is another.
4. From the Access application details, copy its **Application Audience (AUD)** tag. Also copy your Zero Trust **team domain**, such as `your-school.cloudflareaccess.com`.
5. Under **Workers & Pages → hallway-tracker → Settings → Variables and Secrets**, add these runtime variables, then deploy the change:

   | Variable | Value |
   | --- | --- |
   | `ACCESS_TEAM_DOMAIN` | Your exact team hostname, without `https://` or a trailing slash |
   | `ACCESS_AUD` | The Access application's AUD tag |

`keep_vars` preserves dashboard runtime variables on later deployments. The app validates the Access token's cryptographic signature, issuer, audience, and expiration. It denies access if sign-in is missing or misconfigured.

### 4. Try it on two Chromebooks

Open the Worker's production URL, sign in with allowed staff accounts, and use fictional students for the first test:

1. Add two students under **Students**.
2. Create a rule containing both under **Separation rules**.
3. Issue a pass for the first student on one Chromebook.
4. Try issuing one for the second on the other Chromebook. It should ask you to wait.
5. Check in the first student and retry. The second pass should succeed.
6. Confirm that an incognito visitor cannot see student records without staff sign-in.

Then teachers can bookmark the URL. The hallway display refreshes every five seconds. A new pass is checked against the latest server state immediately.

## Development

Requires Node 22.13 or newer.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Local Vite development bypasses Cloudflare Access and uses local D1. Production builds always require Access. Do not expose the local dev server to the public internet.

```sh
npm test
npm run typecheck
npm run build
```

For manual deployment, authenticate with Cloudflare (`npx wrangler login`), complete the real D1 ID in `wrangler.jsonc`, then run `npm run build` and `npm run deploy`.

## Current scope

All allowed staff have equal access to passes, roster, history, and separation rules. Separate administrator roles, student deletion, and automatic record retention are not implemented. History can be exported as CSV. Teacher and room preferences stay on the teacher's device; student records are shared through D1.

The current storage implementation keeps school state in one versioned row. It provides atomic conflict checks, but large rosters and long histories will eventually need normalized tables and pagination.

## Verification

Automated tests cover simultaneous checkout conflicts, group rules, duplicate passes, return/retry, invalid passes, and staff token validation. The GitHub Actions workflow runs tests, TypeScript checking, and a production build on Node 22. A live database and browser verification are still required after Cloudflare setup.

Official references: [Workers GitHub builds](https://developers.cloudflare.com/workers/ci-cd/builds/), [D1 setup](https://developers.cloudflare.com/d1/get-started/), [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/).
