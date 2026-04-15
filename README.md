This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## System-Wide AI Copilot (Groq + Safety Gating)

The platform includes a **system-wide biomedical AI copilot**:

- Global assistant launcher available throughout authenticated dashboard routes.
- Right-side assistant panel with persistent session continuity while navigating modules.
- Contextual Ask-AI entry points in equipment detail, work-order detail, PM, analytics risk, decision-support, and logistics views.
- Dedicated full workspace at `/chatbot`.

The assistant is backend-controlled and safety-gated for medical equipment operations support.

### 1) Environment configuration

Create your env file from `.env.example` and set:

```bash
CHAT_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
```

Optional provider controls:

```bash
GROQ_TEMPERATURE=0.1
GROQ_TIMEOUT_MS=30000
GROQ_BASE_URL=https://api.groq.com/openai/v1
```

Optional non-production adapters remain available:

- `CHAT_PROVIDER=stub` for deterministic local safety-flow validation
- `CHAT_PROVIDER=ollama` for local legacy adapter usage

### 2) Safety decision flow

The backend enforces policy before any model call:

1. Identify authenticated user and role scope.
2. Classify request intent.
3. Retrieve grounded context from Supabase (equipment/work orders/PM/calibration/logistics/analytics/manual snippets).
4. Evaluate evidence sufficiency and safety policy.
5. If blocked, return structured refusal/redirect without calling LLM.
6. If allowed, call Groq and validate structured JSON output contract.

Decisions:

- `answer`
- `limited_answer`
- `check_manual`
- `escalate`
- `refuse`

### 3) Persistence and RLS

- Chat sessions and messages persist in:
  - `chat_sessions`
  - `chat_messages`
- Schema + policies are defined in:
  - `supabase/migrations/00015_chatbot_tables.sql`
- RLS enforces ownership-based access, with admin visibility where policy allows.

### 4) Go-live checklist

- [ ] Apply `supabase/migrations/00015_chatbot_tables.sql`.
- [ ] Set `CHAT_PROVIDER=groq` and valid `GROQ_API_KEY`.
- [ ] Run `npm run lint` and `npm run build`.
- [ ] Validate contextual assistant entry points from major modules.
- [ ] Validate refusal/escalation behavior for unsupported or unsafe prompts.
- [ ] Validate role-scoped visibility (`department_user`, `technician`, `admin`) and context restrictions.
