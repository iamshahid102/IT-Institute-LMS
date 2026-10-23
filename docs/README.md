# IT Institute LMS — Documentation Pack

**Status:** Draft for stakeholder review and approval  
**Purpose:** Implementation-ready planning documents before coding begins  
**Architecture:** Next.js + TypeScript + Tailwind CSS + shadcn/ui; Node.js + Express.js + TypeScript; PostgreSQL + Prisma

## How to use this pack

1. Read `01_PRD.md` to approve the product scope and user outcomes.
2. Read `02_SRS.md` to approve functional and non-functional requirements.
3. Read `03_DATABASE_SCHEMA.md` to review the data model and constraints.
4. Read `04_API_SPECIFICATION.md` to review the REST API contract.
5. Read `05_UI_UX_SPECIFICATION.md` to approve navigation, pages, and screen behavior.
6. Read `06_SECURITY.md` before implementation, especially authentication, permissions, personal data, and payments.
7. Read `07_IMPLEMENTATION_ROADMAP.md` to agree on delivery sequence and acceptance gates.
8. Record decisions in `08_DECISIONS_AND_OPEN_QUESTIONS.md`.
9. Use `09_TEST_PLAN.md` as the definition of done for each module.

## Project principles

- Build a **modular monolith**, not microservices, for the first release.
- Keep the frontend and Express API as separate deployable applications.
- The backend is the authority for validation, permissions, financial calculations, attendance decisions, and certificate issuance.
- Preserve academic and financial history; archive or reverse rather than hard-delete transactional records.
- Treat PWA offline support as an enhancement to app-shell availability, not permission to trust offline financial or attendance actions.
- No coding should begin until the scope, open decisions, and acceptance criteria are approved.

## Suggested repository layout

```text
it-institute-lms/
├── apps/
│   ├── web/                 # Next.js PWA
│   └── api/                 # Express API
├── packages/
│   └── shared/              # Shared non-secret types/schemas if appropriate
├── docs/                    # This documentation pack
├── package.json             # Optional npm workspaces root
└── README.md
```

The `packages/shared` workspace is optional. Do not couple frontend runtime code to Prisma-generated types or server-only modules.

## After the pack is approved

Two documents describe the implementation that was built from this pack, so the approved requirements above can be
traced to running code:

- `10_IMPLEMENTATION_PLAN.md` — resolved architecture, requirements traceability to the shipped modules, the
  approved business rules, environment prerequisites and the verification plan.
- `11_VERIFICATION_REPORT.md` — the checks that were actually executed (API suite, browser journeys, lint, type
  checks, builds, migrations) with exact results, plus what still needs manual QA.
