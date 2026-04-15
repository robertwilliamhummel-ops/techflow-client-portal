# New Repo Setup — Step by Step

**Purpose:** Exact instructions to set up the TechFlow rebuild in a fresh repo. Follow in order. Do not skip.

---

## Step 1 — Create the repo

1. Create a new empty repo on GitHub.
2. Clone it to your PC (somewhere like `C:\Users\Reggie\techflow-saas\` or similar).
3. Open the new folder in VS Code.
4. **Do NOT open Claude Code yet.** Files first, Claude second.

---

## Step 2 — Copy the blueprint docs

Copy these two files from the current repo into the new repo:

- `Docs/REBUILD_PLAN.md`
- `Docs/REBUILD_PLAN_DEFERRED.md`

Put them in a `Docs/` folder at the root of the new repo. Same structure.

---

## Step 3 — Create CLAUDE.md

At the **root** of the new repo (not in Docs/), create a file called `CLAUDE.md` and paste this exact content:

```markdown
# TechFlow SaaS

## Blueprint (source of truth)
- `Docs/REBUILD_PLAN.md` is authoritative. If code diverges from it, the code is wrong.
- `Docs/REBUILD_PLAN_DEFERRED.md` is a rationale/audit log only — do not add new features there.
- Do NOT modify REBUILD_PLAN.md without the user explicitly asking. The audit cycle is closed.

## Stack
- Next.js 15 App Router on Vercel (single project, middleware host routing)
- Firebase: Firestore + Auth + Storage + Cloud Functions v2 + Emulators
- Cloud Run for Puppeteer PDF service (Google-signed ID token auth)
- Stripe Connect Express
- Resend + React Email for transactional mail
- Tailwind + shadcn/ui + Radix, semantic CSS-variable tokens (Phase 1.5)
- Vercel Edge Config for domain→tenantId cache

## Core principle
Zero-trust multi-tenancy. `tenantId` in Firebase Auth custom claims is the authoritative boundary. All mutations flow through Cloud Function callables. Firestore rules use `allow write: if false` on invoices/quotes/users — clients cannot write directly.

## Deployment safety
- Before any `firebase deploy`, run `firebase emulators:start` locally and verify against a fake tenant.
- Never deploy unverified rules to a live Firebase project.
- Never commit secrets. Use `defineSecret()` for Cloud Functions and Vercel env vars for the Next.js app.

## Workflow
- Phase-by-phase per the blueprint. No skipping ahead.
- Phase 1 (schema + security rules + emulator verification) ships before any UI work.
- User ("Solo Orchestrator") reviews every diff — keep explanations concise, show the change, not a lecture.
- User prefers full-context sessions: read ALL of `Docs/REBUILD_PLAN.md` AND `Docs/REBUILD_PLAN_DEFERRED.md` at the start of each phase before writing code. Do not skim.

## Git
- Never force-push, reset --hard, or skip hooks without explicit approval.
- Commit messages: short, imperative, reference the phase (e.g. "phase 1: add stripeStatus meta schema").
```

---

## Step 4 — First commit

```
git add .
git commit -m "initial: blueprint + CLAUDE.md"
git push
```

---

## Step 5 — Open Claude Code and run the FIRST PROMPT

Now open Claude Code (VS Code extension, Opus 4.6). Paste this **exact** first prompt:

```
First session in this new repo. Read ALL of the following, fully, before doing anything else:
1. CLAUDE.md
2. Docs/REBUILD_PLAN.md (the entire 2,700+ line blueprint — do not skim)
3. Docs/REBUILD_PLAN_DEFERRED.md (rationale / audit log)

After reading, create my memory files from scratch:
- MEMORY.md (the index)
- user_workflow_stack.md

Capture these facts about me:
- Solo Orchestrator. 15+ years MSP / IT Regional Lead / Murata (power supply) background.
- Uses Opus 4.6 in Claude Code VS Code extension exclusively for all build work.
- Other AIs (Gemini, Claude web) are only for outside audits and side chats — never for writing code in this repo.
- Prefers full-context sessions: I will tell Claude to read all of REBUILD_PLAN.md + REBUILD_PLAN_DEFERRED.md at the start of each phase. Do not skim or skip.
- Stack is locked per REBUILD_PLAN.md.
- Core principle: zero-trust multi-tenancy via tenantId in Firebase Auth custom claims.
- REBUILD_PLAN.md is the law — do not modify without explicit request.
- Business model: $999 CAD setup + $50-100/month managed fee, bundled SaaS + branded Next.js marketing site.
- Before any firebase deploy, always run emulators locally first.

After memory is written, give me a short summary of what you understood from the blueprint (stack, Phase 1 scope, key risk mitigations from the audit rounds). Confirm you are ready for Phase 1 but do NOT start coding yet. Wait for my go-ahead.
```

That one prompt does everything. No memory file copying needed.

---

## Step 6 — Verify before you proceed

After Claude Code responds to Step 5, check:

- [ ] Memory folder exists at `C:\Users\Reggie\.claude\projects\<new-repo-folder-name>\memory\`
- [ ] `MEMORY.md` is in it
- [ ] `user_workflow_stack.md` is in it
- [ ] Claude confirmed it understands the blueprint
- [ ] Claude did NOT start writing code yet

If all four check out, you are ready.

---

## Step 7 — Start Phase 1

Next prompt:

```
Re-read all of Docs/REBUILD_PLAN.md and Docs/REBUILD_PLAN_DEFERRED.md fully before starting. Do not skim.

Then initialize Phase 1 per REBUILD_PLAN.md. Scope:
1. npx create-next-app@latest with TypeScript + Tailwind + App Router
2. firebase init (Firestore + Functions + Storage + Emulators)
3. Phase 1 meta schema (including stripeStatus, customDomainStatus, userTenantMemberships)
4. firestore.rules with allow write: if false on invoices/quotes/users
5. Verify in emulators. No deploy.

Show me the plan before writing any code.
```

---

## Standing prompt template for every future phase / new session

Use this pattern at the start of every session or when starting a new phase:

```
Re-read all of Docs/REBUILD_PLAN.md and Docs/REBUILD_PLAN_DEFERRED.md fully before starting. Do not skim.

Then [describe what you want done].
```

Full context every time = fewer mistakes. You accepted the cost tradeoff; this is the prompt that enforces it.

---

## Things that will go wrong if you skip steps

- **Skipped Step 2 (Docs)**: Claude will guess the blueprint. Bad.
- **Skipped Step 3 (CLAUDE.md)**: Claude will not know project rules. Bad.
- **Skipped Step 5 (first prompt)**: Memory stays empty. Future sessions start blind.
- **Ran Step 7 before Step 5**: Phase 1 code happens without proper context. Very bad.

---

## What NOT to copy from the old repo

- Do NOT copy `feedback_colour_rule_scope.md` from the old memory folder. It references Vite/CSS classes that don't exist in the new Next.js repo. A new color rule (if needed) will emerge naturally from the Phase 1.5 shadcn design system.
- Do NOT copy any `src/` code. The rebuild starts fresh.
- Do NOT copy `package.json` from the old repo. Let create-next-app generate it.

---

## One-line summary

**Copy Docs/ → create CLAUDE.md → commit → open Claude Code → paste the Step 5 prompt → verify → start Phase 1.**
