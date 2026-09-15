# EM² Meals

Private chef and corporate catering website with an owner operations pilot. Built with the Sites Vinext/React/TypeScript starter, Cloudflare Workers and D1.

## Run locally

Use Node 22.13 or later. Install the lockfile with `npm ci`. Copy `.env.example` to `.env`; local development sign-in uses `seedy@sites.test`, so set `OWNER_EMAILS=seedy@sites.test` **only locally**. Never put that test identity in production.

Run `npm run build` to generate the local Worker configuration, then apply both checked-in migrations to a new local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_gorgeous_xorn.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_operations.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_crm.sql
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

Use **Sites runtime environment configuration** for production variables; `.env` is ignored and never packaged. The site fails closed without an owner allowlist.

| Variable              | Purpose                                                                       |
| --------------------- | ----------------------------------------------------------------------------- |
| `OWNER_EMAILS`        | Comma-separated allowed ChatGPT owner emails.                                 |
| `OWNER_IDS`           | Optional site-scoped ChatGPT identity allowlist.                              |
| `GEMINI_API_KEY`      | Server-side Gemini API credential.                                            |
| `GEMINI_MODEL`        | Defaults to `gemini-3.8-flash`; set a supported model for the Google project. |
| `GOOGLE_MAPS_API_KEY` | Server-side key with Places API (New) and Routes API enabled.                 |
| `SMTP2GO_API_KEY`     | SMTP2GO API credential with `/email/send` permission.                         |
| `EMAIL_FROM`          | Verified business sender, e.g. `EM2 Meals <hello@your-domain.example>`.       |
| `CRON_SECRET`         | Shared secret protecting the CRM digest endpoint.                            |

Google services require a configured project, enabled APIs and billing as applicable. SMTP2GO requires a verified sender and an API key permitted to call `/email/send`. Configure budget controls and appropriate API restrictions with the provider. Secrets are not entered in browser forms. Redeploy after changing runtime variables. Until configured, the app reports **Setup required**, preserves saved records and supports manual review/route estimates/email drafts.

Complete kitchen address, measured UK MPG, current fuel price, VAT settings and thresholds in Settings. Vehicle defaults to 2018 Hyundai Tucson petrol without an assumed fuel economy. Quote VAT is configurable and is not tax advice or automated classification. No payment processor, bank connection, tax filing, customer account or automated supplier ordering is included.

## Application and data flow

Public `POST /api/enquiries` validates and preserves the original request, with a unique request key, payload hash and hourly abuse limit. Guest submissions cannot pre-approve allergy reviews. A retryable importer automatically matches the normalised email to a CRM contact and creates an enquiry-stage order. Existing owner-maintained contact details are preserved. Older unconverted enquiries are backfilled on dashboard refresh. Import failures retain the original submission. The owner reviews menu suggestions, quantities, individual requirements, date and venue before accepting a quote.

Admin pages and all `/api/admin/*` routes verify ChatGPT authentication and the owner allowlist server-side. Mutations require a matching Origin. ChatGPT identity headers are trusted only behind Sites dispatch; the stock local development plugin strips forged headers and provides its documented test identity. Do not expose a raw Worker origin outside this trusted deployment arrangement.

D1 tables store original enquiries, email send claims and separate live/sample workspace aggregates. Each aggregate contains typed customer, order, quote, recipe, ingredient, batch, movement, supplier, purchase, waste, feedback, finance, draft and audit records. Revision-checked atomic updates prevent lost writes and half-applied inventory operations. This intentionally coarse transaction boundary suits a small single-owner pilot. Before high-volume or multi-kitchen use, migrate the aggregates into indexed entity tables with bounded list APIs. D1 is the source of truth; browser storage is not used for business records.

Confirmed orders retain item and ingredient cost snapshots. Reservation uses dated eligible batches in expiry order. Preparation and cooking retain reservations. Packaging atomically deducts actual usage and releases reservations exactly once. Extra usage updates reserve additional ingredients immediately. Cancellation before preparation releases stock; prepared/cooked orders require consumed-versus-reusable reconciliation. Legacy records already marked consumed cannot deduct again. Recipe changes that affect confirmed orders require a replacement recipe/order. Actual waste cost is an allocation of already-recorded costs, not an extra deduction from the ledger. Only stock spoilage deducts stock in the waste workflow.

AI extraction returns structured suggestions and evidence, not approval. Read-only assistant responses use records; venue research uses only venue details with cited public sources. Guest references sent for structured extraction are pseudonymised. Free text may still contain personal data supplied by customers and should be minimised. No model can determine allergen safety, expiry or permits. The owner verifies these.

Routing uses Google’s traffic-aware outbound route. A return estimate doubles distance and duration; it is labelled as an estimate. Fuel cost uses UK gallons: miles / MPG × 4.54609 × pounds per litre. Manual estimates remain available. Browser venue maps use a Google Maps iframe.

Emails are saved drafts with an explicit Send action and a durable delivery claim. Combined purchasing proposals use accepted demand, pack rounding and timely confirmed incoming purchases. Drafts snapshot demand and estimates, show changed inputs, and require renewed review when stale. A server-side workspace lease prevents concurrent stock or demand changes during the send claim. Sent requests only count as incoming stock after supplier confirmation. Duplicate sends are prevented. Network-uncertain attempts are not automatically retried; inspect SMTP2GO and record the provider outcome using the delivery reconciliation controls before any replacement attempt. Replies and supplier calls are logged manually. No test sends are performed by automated tests.

The CRM digest endpoint is `POST /api/cron/crm-followups`. It requires `Authorization: Bearer <CRON_SECRET>`, evaluates the live workspace in Europe/London, and sends only after 08:00 when follow-ups or relationships need attention. Delivery is recorded once per London date and owner recipient. The included GitHub Actions workflow calls the endpoint hourly; configure repository secrets `CRM_DIGEST_URL` (the deployed endpoint URL) and `CRM_CRON_SECRET` (the same value as the runtime `CRON_SECRET`). Definite provider failures may be retried on the next invocation, while network-uncertain attempts are held for manual verification to avoid duplicate mail.

Client recaps are built from a dedicated projection containing only that customer’s delivered orders within the selected period, popular dishes, measured waste and feedback. Internal costs and margins are excluded. CSV export neutralises formula prefixes. Printable reports include only the recap section.

## Launch readiness

The initial deployment is private. Before opening to customers: complete business contact/privacy/retention information, verify chef credentials before award claims, enter real recipes/allergen labels/supplier prices and approved storage instructions, configure and live-test Google/email integrations, and review a real end-to-end order with the owner. API credentials and outgoing communications are not silently substituted with fabricated results.

External API calls have bounded timeouts. Enquiries are saved independently of AI availability. Missing dates prevent stock allocation; freezing never automatically extends expiry. Operational alerts are calculated from persistent records in-app; no background email campaigns run.

A page-scoped read-only WebMCP tool, `read_catering_overview`, exposes the current owner workspace counts and alerts where the browser supports it.

See [ASSETS.md](ASSETS.md) for licensed imagery and attribution sources.

## Operations upgrade and reporting

See [Operational guide](docs/OPERATIONS.md) for the stock workflow, purchasing, invoices, reporting definitions, data coverage, migration, and verification evidence.

`/admin/business` contains Overview, Purchasing, Invoices, and Costs & travel. `/admin/reports` defaults to whole-business month-to-date reporting. CRM **View reports** links select a customer; customer, service and date filters persist in the URL. Dashboards refresh every 30 seconds while visible and on focus, retaining the last successful results on errors.

Issued invoices and credit notes have independent sequential numbers and immutable snapshots. Acceptance creates a draft using the accepted quote. VAT-inclusive and exclusive entry share integer-penny calculations. Invoice payments are linked and deduplicated; existing cash entries can be reconciled without recording income twice. Printing uses the issued document snapshot. VAT settings are retained and are never automatically enabled.

The upgrade retains original-state backups and advances workspace JSON to schema version 4. It does not invent historical industries, mileage, payment links, expense attribution or geography. New stock receipts use recorded purchase cost when linked; consumption and adjustment movements snapshot their costs. Missing legacy movement costs are identified as estimates.
