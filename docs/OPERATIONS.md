# Owner operations guide

## Intake and preparation

Website submissions remain stored independently of conversion. The importer matches trimmed, case-normalised emails without replacing CRM notes or contact details. Import status allows safe retry after interruptions. A submission request key cannot be reused with different content. Sample workspaces never import public enquiries.

New orders receive `EM-YYYY-NNNNNN` references inside the revision-checked transaction. Existing references remain unchanged. AutoSous can suggest recipe matches and quantities; the owner applies and reviews them before accepting. Allergy checks remain an explicit owner step.

Venue selection saves identity, coordinates, address, postcode/locality and a map link. Manual address corrections remain available. Changing a selected venue or address invalidates its location selection; event-date/time changes mark research stale. Venue research, customer access instructions, parking and journey planning share one panel while customer-supplied instructions remain distinct from public research. Research looks for parking restrictions, payment systems such as RingGo or PayByPhone, published tariffs, loading and accessibility, with source links, timestamps and nearby car-park map links. The journey estimate calculates traffic-aware outbound and return legs around the expected venue stay and uses a published hourly parking rate and known daily cap when available; all estimates remain editable and unknown or unverified facts require manual confirmation.

## Recipes, stock and expiry

Use All recipes for unassigned recipes, or a year and Spring/Summer/Autumn/Winter collection. A recipe may appear in multiple collections without duplicating its definition. Search and pagination keep large collections manageable. Owner image URLs have previews and missing-image fallbacks. Eight labelled ingredient symbols supplement allergens; they do not replace them.

On-hand is recorded physical stock. Reserved is eligible stock committed to accepted orders. Available excludes reservations and batches without valid label dates. Tentative enquiries preview demand but neither reserve stock nor affect purchasing totals. Existing valid allocations are retained; remaining accepted demand is allocated by event date, acceptance time and batch expiry.

Preparation and cooking retain reservations. Record actual usage changes for extra ingredients, mistakes or unused amounts. Packaging performs the deduction once and writes costed stock movements. Receipts and stock changes recalculate availability without reversing a cooked order's stage. Cancellation before preparation releases stock; later cancellation requires every ingredient's consumed and reusable amounts to be reconciled.

Expiry counts calendar days in Europe/London and refreshes at London midnight and on focus. Long intervals include months. The defaults are a seven-day amber warning and a three-day red use-by warning, configurable in Settings. Best-before passed, use-by passed, due today and missing dates also have textual labels. Expired and missing label dates are excluded from automatic allocation.

## Purchasing and supplier records

Supplier profiles support named contacts, roles, website, address, logo and business details. Research is a suggestion: confirm the business match before applying it. Ingredient offerings capture preferred/alternative suppliers, packs and known prices/VAT, combined with supplier delivery charges, minimum order and estimated calendar-day lead times.

Business → Purchasing combines accepted-order shortages per supplier. Confirmed purchases are allocated once to demand their ETA can meet; overdue deliveries remain visible. Quantities round to packs. Proposals show affected orders, required amounts, purchase quantities, costs, delivery estimates and ordering deadlines. Unknown prices/VAT remain unknown. Supplier history and related recipes explain likely next orders; AutoSous must not invent prices or availability.

Review and edit supplier drafts before sending. Changes to demand, stock, offerings or incoming purchases mark a draft Needs updating; review its differences and regenerate it. The server verifies freshness again while holding a workspace send lease. Network-uncertain deliveries require checking the provider and recording the result. A sent request is not a confirmed purchase. Confirm supplier quantities, cost and ETA, or record a manual purchase, then receive the actual delivery. Subsequent demand becomes a new or amended request after resolving the previous request.

## Invoices and cost records

Acceptance creates an invoice draft from the accepted quote. Complete business identity/address, billing address, dates and payment instructions. Where VAT is charged, complete registration details and review explicit rates. Inclusive/exclusive entry uses shared integer-penny rounding. Issue freezes the document and allocates an independent invoice number. Corrections use linked, separately numbered credit notes. Print/save PDF and email sending are explicit actions.

Record invoice payments with a unique reference and payment date. To link an existing legacy receipt, use Costs & travel → reconcile income; this links the existing cash record without creating another one. Do not record the same receipt separately as a new invoice payment.

Expenses have incurred and paid dates, actual/estimated status, VAT treatment, service attribution and optional order/purchase links. A blank paid date means unpaid. Order-linked costs inherit private/corporate service. Use ingredients for supplier purchase payments: buying stock affects cash when paid, while consuming stock affects job profitability. Purchase-linked receipts use recorded purchase unit cost. Edit an estimated labour/cost record to its actual value rather than adding its replacement twice. Journey edits preserve a single linked cash record; actual journeys replace the order's route estimate. Unknown fuel stays unknown; an explicitly recorded zero is valid.

## Waste and CRM reports

Reports opens on Whole business and current month to date. Customer, service and date controls apply to the complete page: waste records/totals/categories/trends, completed orders, popular dishes and feedback. CRM View reports supplies a customer deep link. Whole business clears customer and service selection while retaining dates.

Waste belongs to a customer through its order. Unassigned spoilage remains business waste. Waste registers use waste-record dates; completed-event recaps use event dates. The unserved percentage uses only unserved portions associated with the same completed-order cohort as its denominator, including later waste observations. Missing measurements are counted separately from measured zero. Historical zero weights remain unmeasured unless explicitly corrected.

Customer print, CSV and email recaps use an allowlisted projection. It excludes internal waste costs, margins, supplier prices, shared expenses and other customers. CSV cells escape spreadsheet formula prefixes. Internal business exports are separately labelled and should not be sent as customer recaps.

## Business calculation definitions

The Overview defaults to month to date, all customers and both service types. Presets include last month, year to date, last twelve months and custom dates. Comparisons use the immediately preceding period with the same number of calendar days. Filters persist in the URL, including ranking drilldowns; refresh errors retain the previous state and its last-updated time.

- **Invoiced sales excluding VAT, VAT and invoice totals including VAT:** issued invoices minus issued credits, by issue date. Cash uses payment dates. Outstanding amounts are evaluated at the period end from linked payments and credits. Legacy unlinked cash remains visible for reconciliation.
- **Completed-job revenue:** event-date cohort, using issued invoice values and credits where available, otherwise the accepted quote, labelled estimated.
- **Gross profit:** completed-job revenue excluding VAT minus ingredient consumption, direct labour and direct travel. New movements retain historical costs when supplier prices change. Missing legacy costs use accepted cost snapshots and are labelled estimates.
- **Net operating profit before tax:** gross profit minus attributable operating expenses, whole-business shared overheads and recorded stock losses. Waste allocations explain those costs; they are not charged again. Negative stock adjustments and cancelled-order consumption are stock losses.
- **Private/corporate contribution:** each service's completed revenue minus direct costs and its attributable operating expenses and order-linked stock losses. Shared overheads are shown only at whole-business level. A customer view includes directly linked costs and does not allocate service-wide/shared overheads.
- **Purchasing rankings:** purchases recorded in the period. Distinct supplier requests count once across ingredient lines. Undated historical purchases are flagged rather than assigned a fictitious date. A purchase covering multiple customers/services is shown in full only when all its linked orders belong to the selected scope; no arbitrary proportional allocation is made. Ingredient quantities retain their units and are not summed across incompatible units.
- **Markets:** postcode district or recorded locality, CRM industry, and event type are separate dimensions. Missing location/industry remains Unclassified. Historical addresses are not automatically geocoded.
- **Pipeline:** enquiry/cancellation counts use event dates; upcoming accepted quotes are shown separately from invoiced sales and completed jobs. Upcoming workload is future work regardless of the historical reporting period.

Four Recharts SVG panels show monthly sales/cash, service activity, cost composition and measured waste. Each has a table equivalent. Rankings are sortable and paginated; selecting a row reveals its source orders or purchases. Service rows change the service scope. Coverage notices identify estimated revenue/ingredients/travel/labour, missing labour/fuel, unclassified finance and unknown historical losses. A displayed partial profit is not a confirmed complete cost result.

## Migration and deployment

Run all checked-in Postgres migrations with the direct `DATABASE_URL_UNPOOLED` connection. Application requests continue using the pooled `DATABASE_URL`. Schema creation and upgrades happen only through migrations; request handlers never need DDL permissions. Versioned JSON normalisation writes an original-state backup in `workspace_backups` before advancing to v4, preserving the prior workspace and revision. Prior version backups remain intact. Single-supplier ingredient links become preferred offerings. Existing `consumed` flags, references, quotes and stock history are retained. Never clear a legacy consumed flag to re-run packaging.

Before rollout, retain the database backup and inspect both live/sample records. Business identity, VAT treatment and real data still require owner setup. AutoSous, Google Places/Routes and Resend require server-side credentials and provider configuration. No live provider result or email delivery is fabricated when credentials are missing. No deployment is performed by the verification scripts.

## Verification

`npm test` runs domain/reporting tests and isolated SQL-backed API tests, including concurrent imports, send leases, stale/uncertain delivery, repeat migration, stock lifecycle, purchasing, invoices, reporting isolation and cost attribution. Provider responses in these tests are mocked; they send no real emails.

`npm run test:api` checks the running localhost APIs, authentication, idempotency, sample isolation and integration fallback. `npm run test:walkthrough` creates clearly named fixtures only in the local sample workspace and exercises an enquiry-stage order through acceptance, manual purchasing, receipt, preparation/cooking, repeated packaging, invoice issue/payment, actual labour/travel and delivery. Public automatic intake is separately covered by SQL/API tests because it intentionally cannot import into sample mode.

Browser verification covered desktop and 390px layouts, season navigation and recipe details, four rendered charts, keyboard business tabs, CRM deep links, refresh persistence, customer CSV and print isolation, and a simulated failed refresh retaining prior results. Additional browser fixtures verified 500-recipe pagination/search and the Europe/London midnight countdown transition. Issued invoice printing was checked independently of the dashboard layout. Browser provider behaviour still needs credentialed live verification. Screenshots from the local session are in `/tmp/em2-analytics-*.png`, `/tmp/em2-business-mobile.png` and `/tmp/em2-customer-print.png`.

Run typecheck, tests, API checks, lint and production build before release. The original repository had 84 ESLint errors (primarily explicit `any`, state-in-effect and navigation rules); report remaining baseline lint debt separately from new feature checks rather than disabling those rules.

Integration contracts were checked against [Gemini search grounding](https://ai.google.dev/gemini-api/docs/google-search) and [GOV.UK invoice fields](https://www.gov.uk/invoicing-and-taking-payment-from-customers/invoices-what-they-must-include). Live integration verification remains dependent on credentials.

Latest local verification: 40 domain/reporting tests and 11 SQL/API tests passed, along with typecheck, API smoke, sample walkthrough and production build. Targeted lint of new feature modules passed. Repository-wide lint retains 61 pre-existing errors (down from the original 84); these remain release debt. No live deployment or real outgoing emails were performed.
