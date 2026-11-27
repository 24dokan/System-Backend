# System-Backend: Architecture (Phase 1, Area 1A)

Status: **DRAFT for review.** No feature code is written until this is approved.

## 1. Scope

Area 1A of the Phase 1 use-case diagram: products, categories, brands and features,
the product approval workflow, CSV import/export, and seller packages.
Areas 1B (order entry), 1C (fulfilment/returns) and 1D (inventory) come later, but the
schema leaves room for them (SKU is the unit of stock).

## 2. Decisions so far

| Topic | Decision |
|---|---|
| Language / framework | TypeScript, NestJS |
| Database | PostgreSQL, Prisma (schema and migrations) |
| Structure | Modular monolith, one deployable app, strict module boundaries |
| API | REST, documented with OpenAPI (Swagger) |
| Auth | Email and password, JWT. Designed so 2FA can be added later |
| Roles | `ADMIN`, `SELLER` (brand = seller), `WAREHOUSE_STAFF` |
| Tenancy | A seller sees only its own data. Admin sees everything |
| Media | S3-compatible object storage. Originals kept, derived sizes generated. Images and other file types (video etc.) |
| Background jobs | BullMQ + Redis (CSV import/export, media processing) |
| Payments | Manual for now: bank account details shown to the seller, Admin confirms receipt. Real payment gateway later |
| Repo layout | Single NestJS app at repo root (`src/`, `prisma/`, `docs/`, `test/`) |

## 3. Modules

```
src/
  identity/       users, roles, login, JWT, password reset (2FA hook later)
  sellers/        seller (brand) accounts, profile, admin approval of the account
  packages/       packages, features, subscriptions, bank details, limit enforcement
  catalog/        brands, features, categories (tree + commission)
  products/       products, options, SKU variants, generation
  approval/       review queue, approve/reject, edit re-approval, history
  media/          uploads, storage, derived sizes
  import-export/  CSV template, import with row validation, export
  common/         guards, pipes, pagination, errors, audit helpers
```

Rules: modules talk through exported services only, never through each other's tables.
`products` asks `packages` "may this seller add one more product?" and never reads
subscription tables directly.

## 4. Product model

```
Product ──< ProductOption ──< ProductOptionValue      (e.g. Size: S, M, L)
   │
   └──< Sku  (one per combination of option values; stock lives here, never on Product)
```

- A product with no options gets exactly one default SKU.
- "Generate variations" builds the cartesian product of option values and creates the
  missing SKUs. Existing SKUs are never deleted or recreated, so stock is not lost.
- Stock (1D) attaches to `Sku`.

## 5. Approval workflow

```
DRAFT --submit--> PENDING --approve--> APPROVED
                     └-----reject----> REJECTED --edit & resubmit--> PENDING
APPROVED --edit--> (live version stays visible) + pending revision --> PENDING_REVISION
```

- Imported products always start `PENDING`.
- Rejecting requires a reason.
- Editing an approved product creates a `ProductRevision` (a JSON snapshot of the proposed
  changes). The live product is untouched until an Admin approves the revision,
  then the changes are applied in one transaction.
- Every decision is appended to `ApprovalEvent` (who, when, action, reason). Never updated or deleted.
- `receivable` is set when a product is approved. Only approved products can be received
  into stock (consumed by 1D).

## 6. Packages and subscriptions

Admin-editable data, modelled on a tiered yearly plan page.

- `Package`: name, tagline, price, currency, billing period, `isContactUs` (custom
  pricing), `isPopular`, display order, active flag.
- Limits are typed columns, not free text: `maxProducts` (null = unlimited),
  `maxSkus` (default 10 x `maxProducts`, null = unlimited), `maxMicroStores`,
  `transactionFeePercent`, `pickupFeeAmount`.
- `PackageFeature` / `PackageFeatureLink`: a list of feature labels, grouped, each marked
  included or not per package. The comparison page renders from data.
- `Subscription`: seller + package + status + dates.
  `PENDING_APPROVAL -> AWAITING_PAYMENT -> ACTIVE -> EXPIRED / CANCELLED`.
  Billing starts only after the Admin approves the seller account.
- `PaymentInstruction`: bank name, account name, account number, reference format.
  Shown to the seller. Admin marks a payment received, which activates the subscription
  (`SubscriptionPayment` records who confirmed it and when).
- **Enforcement:** products counted = status in (`PENDING`, `APPROVED`, `PENDING_REVISION`).
  Drafts and rejected products do not count. SKUs counted the same way. Over the limit,
  submit/import is refused with a clear error. Import checks the whole file first and
  refuses rows past the limit.
- Names, prices and features are seed data, not code, and are editable by Admin.

## 7. Import / export

- Template download, upload, background validation, per-row result report (created / rejected + reason).
- Imported products go to `PENDING` and count toward limits.
- Brand and category are matched by name or code. Variations are described per row
  (one row per SKU, grouped by a product key).
- Export streams CSV for the seller's own products. Admin can export all.

## 8. Security and cross-cutting

- Passwords hashed with argon2. Short-lived access token plus refresh token.
- Role guard on every route. Tenant guard scopes every seller query by `sellerId`.
- Audit log for admin actions. Uploads validated by type and size.
- Money stored as integer minor units (sen / cents), never floats.

## 9. Open items

- 2FA method (TOTP vs SMS vs email). Later.
- Real payment gateway. Later. Manual bank transfer for now.
- Storefront (phase 6/7) will read approved products and media from this API.
- Category commission rules: percentage only for now.

## 10. Build order after approval

1. Project scaffold, config, Docker Compose (Postgres, Redis), CI
2. identity + sellers
3. catalog (brands, features, categories)
4. packages and subscriptions
5. products, options, SKUs, media
6. approval workflow
7. import / export

## File storage

All uploads go through one `StorageService` contract with two drivers, chosen by `STORAGE_DRIVER`:

- `local` (default): files are saved in `STORAGE_LOCAL_DIR` (default `./storage`, git-ignored). Upload and download links are signed and expire, exactly like cloud links, so the rest of the app is identical.
- `s3`: any S3-compatible service (AWS S3, Cloudflare R2, Backblaze B2). Set `S3_ENDPOINT` (not needed for AWS), `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`.

Moving to the cloud is a configuration change. Files already saved locally must be copied to the bucket under the same keys (the `Media.storageKey` column). The bucket also needs a CORS rule allowing `PUT` and `GET` from the web app's address.

## Staff, roles and permissions

- Every admin action has a permission key, listed in one place: `src/permissions/permissions.ts`. Routes declare what they need with `@Permission('key')` (admin-only routes) or `@AdminPermission('key')` (routes shared with sellers, where the check applies to administrators only).
- A **role** is a named set of keys (table `StaffRole`). A staff member is an `ADMIN` user with a role. An `ADMIN` user with **no role is a super admin** and may do everything, so the seeded admin keeps full access.
- Permissions are read from the database on every guarded request, so removing a permission or switching an account off takes effect immediately, even while a login token is still valid.
- Nobody can hand out a permission they do not hold themselves, and only a super admin can change another super admin. This stops staff from promoting themselves.
- `GET /api/auth/me` returns `permissions` and `superAdmin` so the web app can hide screens. The backend enforces the same rules regardless.
- Planned: a seller's ID number and bank details are only shown in full to roles with `sellers.view_sensitive` (arrives with the store profile).

## Seller store profile

- Sellers register with just brand name, email and password. After an administrator approves the account, a **Store profile** page opens with contact, company, bank, store, technical contact and e-invoicing details (table `SellerProfile`).
- A seller cannot submit products for review until every required field is filled in (`src/sellers/profile.rules.ts` lists them). Products already approved are not affected.
- ID number and bank account number are shown masked to staff unless their role has `sellers.view_sensitive`. Each full view is recorded in `SellerProfileView`.
- The drop-down choices (seller types, shopping systems, product counts) are placeholders in `profile.rules.ts` until the business confirms the lists.
- Not yet built: supporting documents (e.g. company registration certificate), social links, and encrypting these two fields in the database.

## Option library

- Option names (Size, Colour) and values (S, M, Red) live in a shared library (`OptionDefinition`, `OptionDefinitionValue`). Admins with `options.manage` add entries and approve or decline seller requests.
- When a seller saves product options, what they typed is matched (ignoring case and spaces) against the library and saved with the library's spelling. Anything not in the library becomes a PENDING request from that seller; options or values the team declined are refused with the reason.
- A product can be saved and edited while its options are pending, but it cannot be **submitted for review** until every option and value on it is approved. CSV imports follow the same rule: products with unapproved options are saved as drafts, not sent for review.
- Products keep their own copy of option names and values, so renaming a library entry later does not change existing products.
- `prisma/seed.ts` adds a starter library (Size, Colour, Material). The lists are placeholders.
