# Fork Goodness Baked / Em2 Catering Platform

Private chef and corporate catering website with an owner operations pilot. Built with Next.js, React, TypeScript, Neon Postgres and Vercel Blob.

## Run locally

Use Node 22.13 or later. Install the lockfile with `npm ci`. Copy `.env.example` to `.env.local`, or pull the connected Vercel development environment with `vercel env pull .env.local`. Configure `OWNER_EMAILS` with the real owner allowlist.

Apply the checked-in Postgres migrations, then start Next.js:

```sh
npm run db:migrate
npm run dev
```

Open the URL printed by the server. `/admin` enters owner sign-in. `?mode=sample` selects an isolated, persistent sample workspace; live data starts empty. Public enquiries are never imported into sample records. Sample email sending is disabled.

## Verify

```sh
npm run typecheck
npm test
npm run test:api
npm run test:walkthrough
npm run lint
npm run build
```

API smoke tests require the local development server and create clearly labelled local test enquiries. They refuse non-local URLs. They check identity rejection, forged local headers, input validation, enquiry idempotency, concurrent writes and missing integration credentials. Domain tests verify yields, variants, stock handling, cancellations, allergy review, historical snapshots and client-report isolation.

## Owner setup and integrations

Use **Vercel project environment variables** for production values; local `.env` files are ignored by Git. The site fails closed without an owner allowlist. `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` are injected automatically by the connected Neon and Blob resources.

| Variable              | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `OWNER_EMAILS`        | Comma-separated allowed ChatGPT owner emails.                                 |
| `OWNER_IDS`           | Optional site-scoped ChatGPT identity allowlist.                              |
| `AUTH_MODE`           | `demo` temporarily opens owner routes; switch to `clerk` after connecting Clerk. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser key, supplied by the Marketplace integration.       |
| `CLERK_SECRET_KEY`    | Clerk server key, supplied by the Marketplace integration.                   |
| `DATABASE_URL`        | Pooled Neon Postgres connection string used by application requests.          |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection used only for migrations and administrative work.    |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob credential used for owner recipe-image uploads.                 |
| `GEMINI_API_KEY`      | Server-side Gemini API credential.                                            |
| `GEMINI_MODEL`        | Defaults to `gemini-3.6-flash`; set a supported model for the Google project. |
| `GOOGLE_MAPS_API_KEY` | Server-side key with Places API (New) and Routes API enabled.                 |
| `SMTP2GO_API_KEY`     | SMTP2GO API credential with `/email/send` permission.                         |
| `EMAIL_FROM`          | Verified business sender, e.g. `Fork Goodness Baked <hello@your-domain.example>`. |
| `CRON_SECRET`         | Shared secret protecting the CRM digest endpoint.                            |

Google services require a configured project, enabled APIs and billing as applicable. SMTP2GO requires a verified sender and an API key permitted to call `/email/send`. Configure budget controls and appropriate API restrictions with the provider. Secrets are not entered in browser forms. Redeploy after changing runtime variables. Until configured, the app reports **Setup required**, preserves saved records and supports manual review/route estimates/email drafts.

Complete kitchen address, measured UK MPG, current fuel price, VAT settings and thresholds in Settings. Vehicle defaults to 2018 Hyundai Tucson petrol without an assumed fuel economy. Quote VAT is configurable and is not tax advice or automated classification. No payment processor, bank connection, tax filing, customer account or automated supplier ordering is included.

## Application and data flow

Public `POST /api/enquiries` validates and preserves the original request, with a unique request key, payload hash and hourly abuse limit. Guest submissions cannot pre-approve allergy reviews. A retryable importer automatically matches the normalised email to a CRM contact and creates an enquiry-stage order. Existing owner-maintained contact details are preserved. Older unconverted enquiries are backfilled on dashboard refresh. Import failures retain the original submission. The owner reviews menu suggestions, quantities, individual requirements, date and venue before accepting a quote.

Admin pages and all `/api/admin/*` routes verify ChatGPT authentication and the owner allowlist server-side. Mutations require a matching Origin. Deploy behind the identity-aware ingress that supplies the documented ChatGPT identity headers; the owner API fails closed when those headers are absent.

Neon Postgres tables store original enquiries, email send claims and separate live/sample workspace aggregates. Each aggregate contains typed customer, order, quote, recipe, ingredient, batch, movement, supplier, purchase, waste, feedback, finance, draft and audit records. Revision-checked atomic updates prevent lost writes and half-applied inventory operations. Every aggregate is checked for duplicate identifiers and broken customer, order, recipe, ingredient, supplier, stock, purchasing, finance, CRM and invoice links before it is accepted or returned. Database foreign keys protect enquiry imports and workspace leases, while check constraints protect delivery/import state machines. This intentionally coarse transaction boundary suits a small single-owner pilot. Before high-volume or multi-kitchen use, migrate the aggregates into indexed entity tables with bounded list APIs. Postgres is the source of truth; browser storage is not used for business records. Recipe images uploaded by an owner are stored in the connected public Vercel Blob store, while only their URLs are saved in the workspace state.

Confirmed orders retain item and ingredient cost snapshots. Reservation uses dated eligible batches in expiry order. Preparation and cooking retain reservations. Packaging atomically deducts actual usage and releases reservations exactly once. Extra usage updates reserve additional ingredients immediately. Cancellation before preparation releases stock; prepared/cooked orders require consumed-versus-reusable reconciliation. Legacy records already marked consumed cannot deduct again. Recipe changes that affect confirmed orders require a replacement recipe/order. Actual waste cost is an allocation of already-recorded costs, not an extra deduction from the ledger. Only stock spoilage deducts stock in the waste workflow.

AutoSous extraction returns structured suggestions and evidence, not approval. Read-only AutoSous responses use records; venue research uses only venue details with cited public sources. Guest references sent for structured extraction are pseudonymised. Free text may still contain personal data supplied by customers and should be minimised. AutoSous cannot determine allergen safety, expiry or permits. The owner verifies these.

Routing uses Google’s traffic-aware outbound route. A return estimate doubles distance and duration; it is labelled as an estimate. Fuel cost uses UK gallons: miles / MPG × 4.54609 × pounds per litre. Manual estimates remain available. Browser venue maps use a Google Maps iframe.

Emails are saved drafts with an explicit Send action and a durable delivery claim. Combined purchasing proposals use accepted demand, pack rounding and timely confirmed incoming purchases. Drafts snapshot demand and estimates, show changed inputs, and require renewed review when stale. A server-side workspace lease prevents concurrent stock or demand changes during the send claim. Sent requests only count as incoming stock after supplier confirmation. Duplicate sends are prevented. Network-uncertain attempts are not automatically retried; inspect SMTP2GO and record the provider outcome using the delivery reconciliation controls before any replacement attempt. Replies and supplier calls are logged manually. No test sends are performed by automated tests.

The CRM digest endpoint is `POST /api/cron/crm-followups`. It requires `Authorization: Bearer <CRON_SECRET>`, evaluates the live workspace in Europe/London, and sends only after 08:00 when follow-ups or relationships need attention. Delivery is recorded once per London date and owner recipient. The included GitHub Actions workflow calls the endpoint hourly; configure repository secrets `CRM_DIGEST_URL` (the deployed endpoint URL) and `CRM_CRON_SECRET` (the same value as the runtime `CRON_SECRET`). Definite provider failures may be retried on the next invocation, while network-uncertain attempts are held for manual verification to avoid duplicate mail.

Client recaps are built from a dedicated projection containing only that customer’s delivered orders within the selected period, popular dishes, measured waste and feedback. Internal costs and margins are excluded. CSV export neutralises formula prefixes. Printable reports include only the recap section.

## Launch readiness

The initial deployment is private. Before opening to customers: complete business contact/privacy/retention information, verify chef credentials before award claims, enter real recipes/allergen labels/supplier prices and approved storage instructions, configure and live-test Google/email integrations, and review a real end-to-end order with the owner. API credentials and outgoing communications are not silently substituted with fabricated results.

External API calls have bounded timeouts. Enquiries are saved independently of AutoSous availability. Missing dates prevent stock allocation; freezing never automatically extends expiry. Operational alerts are calculated from persistent records in-app; no background email campaigns run.

A page-scoped read-only WebMCP tool, `read_catering_overview`, exposes the current owner workspace counts and alerts where the browser supports it.

See [ASSETS.md](ASSETS.md) for licensed imagery and attribution sources.

## Operations upgrade and reporting

See [Operational guide](docs/OPERATIONS.md) for the stock workflow, purchasing, invoices, reporting definitions, data coverage, migration, and verification evidence.

`/admin/business` contains Overview, Purchasing, Invoices, and Costs & travel. `/admin/reports` defaults to whole-business month-to-date reporting. CRM **View reports** links select a customer; customer, service and date filters persist in the URL. Dashboards refresh every 30 seconds while visible and on focus, retaining the last successful results on errors.

Issued invoices and credit notes have independent sequential numbers and immutable snapshots. Acceptance creates a draft using the accepted quote. VAT-inclusive and exclusive entry share integer-penny calculations. Invoice payments are linked and deduplicated; existing cash entries can be reconciled without recording income twice. Printing uses the issued document snapshot. VAT settings are retained and are never automatically enabled.

The upgrade retains original-state backups and advances workspace JSON to schema version 4. It does not invent historical industries, mileage, payment links, expense attribution or geography. New stock receipts use recorded purchase cost when linked; consumption and adjustment movements snapshot their costs. Missing legacy movement costs are identified as estimates.
