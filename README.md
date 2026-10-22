# Progga AI — Backend 🍌🤖

Node.js API for **Progga AI**, a safe Socratic AI tutor for students from Class 3 to HSC (NCTB curriculum). Instead of handing out answers, Progga breaks maths & science problems into a few easy steps the student solves, with a 3-level hint ladder and the *why* behind each step. Factual questions get a direct answer plus extra context.

Frontend: [Progga-AI-FontEnd](https://github.com/mobasher4/Progga-AI-FontEnd)

**Stack:** Express 5 · TypeScript · Prisma (SQLite in dev, Postgres-ready) · Zod · OpenAI / DeepSeek / Claude

## Quick start

```bash
npm install
cp .env.example .env     # set JWT_SECRET and at least one AI key (OPENAI_API_KEY recommended)
npm run setup            # create the database + seed demo content
npm run dev              # http://localhost:4000
npm run check:llm        # optional: live test of the AI connection
```

Demo accounts (password `Progga@123`, local dev only): `rafi@demo.progga.ai` (student), `parent@demo.progga.ai`, `teacher@demo.progga.ai`, `admin@demo.progga.ai`.

## AI engines

One model handles everything (planning steps, fact answers, checking replies). The default is OpenAI `gpt-6-luna`. Admins can switch provider and model at runtime from the app (**/admin → AI settings**); the choice is stored in the database, so no restart is needed.

| Provider | Env key | Notes |
|---|---|---|
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Default `gpt-6-luna`; reads homework photos |
| `deepseek` | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | `deepseek-flash`; text only |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude with structured outputs |
| `mock` | none | Offline tutor for UI work and CI |

## How the tutor works

```
question ─▶ safety pre-screen (PII redaction, wellbeing/unsafe filters, daily limit)
         ─▶ PLANNER: hidden plan { mode: problem | concept | fact, steps[goal, prompt, expected, hints×3, why], final_answer … }
         ─▶ each reply ─▶ EVALUATOR verdict ─▶ state machine (src/modules/tutor/engine.ts)
                                               advance · XP · hints · reveal one step · finish
```

Expected answers, unseen hints and the final answer never leave the server, and a leak guard keeps them out of the tutor's own messages.

## API (`/api`)

`auth` · `me` · `subjects` · `tutor/sessions` (start, reply, hint, reveal-step, abandon) · `lessons` (progress, checkpoints, complete) · `quiz` (start, answer, history) · `game` (quests, achievements, leaderboard, shop) · `guardian` (link, report, transcripts, limits) · `admin/ai` (provider/model, model list, test)

## Production

- Switch `provider` in `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL` at Postgres.
- Use a long random `JWT_SECRET` and set `CORS_ORIGINS` to your frontend URL.
- Replace the placeholder lesson videos in `prisma/seed.ts` with real content.
