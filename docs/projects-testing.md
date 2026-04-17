# Projects Feature — Testing Checklist

Manual test plan for the Projects feature (Stages 1–10 + super-admin Dashboard overview).
Paired with the seed file `backend/seeds/test_projects_scenarios.sql`.

---

## Before you start

### 1. Start the dev servers
Open two terminals:
```bash
cd backend  && npm run dev     # port 3001
cd frontend && npm run dev     # port 5173
```

### 2. Seed the test scenarios
```bash
export PGPASSWORD=postgres123 && "/c/Program Files/PostgreSQL/18/bin/psql.exe" \
  -U postgres -d gims_db -h localhost \
  -f backend/seeds/test_projects_scenarios.sql
```
The seed is idempotent — re-run anytime to reset the `active_project_id` for GGC users
and re-verify projects/tasks.

### 3. Expected DB state after seed

| Project               | Status    | Teams                | Tasks | Completed |
| --------------------- | --------- | -------------------- | ----- | --------- |
| Hospital Construction | active    | GGC                  | 5     | 1         |
| Road Widening Phase 1 | active    | GGC + Team Alpha     | 4     | 1         |
| School Renovation     | active    | Team Beta            | 2     | 0         |
| Drainage Repair       | completed | Team Gamma           | 2     | 2         |

**Key property:** GGC is in **2 active projects** — any GGC user creating a task on
Telegram without a sticky project set will trigger the "Which project?" ambiguous prompt.

### 4. Test accounts

| Role             | Name            | Phone        | Password | Team        |
| ---------------- | --------------- | ------------ | -------- | ----------- |
| super_admin      | Super Admin     | `9000000000` | admin123 | —           |
| admin (GGC)      | prasad palekar  | `9422514284` | *your*   | GGC         |
| admin (Alpha)    | Admin Alpha     | `9000000001` | admin123 | Team Alpha  |
| admin (Beta)     | Admin Beta      | `9000000002` | admin123 | Team Beta   |
| admin (Gamma)    | Admin Gamma     | `9000000003` | admin123 | Team Gamma  |
| admin (Delta)    | Admin Delta     | `9000000004` | admin123 | Team Delta  |
| member (GGC)    | prasad          | `8806860925` | *your*   | GGC         |
| member (GGC)    | pooja palekar   | `9921821075` | *your*   | GGC         |

### 5. Telegram setup
Have Telegram open with your linked account mapped to a GGC user
(admin `prasad palekar` or member `prasad` / `pooja palekar`).
The seed already cleared sticky projects for all GGC users so the flow starts fresh.

---

## Scenario 1 — Super admin Dashboard

Login as super admin → go to `/dashboard`.

- [ ] Page shows the usual tiles plus a **"Projects Overview"** card below "Team Overview"
- [ ] Status tiles show: **Active 3 · On Hold 0 · Completed 1 · Archived 0**
- [ ] Overall progress bar shows roughly "4 / 13 tasks" (≈ 30%)
- [ ] "Top projects by task volume" lists Hospital Construction at top, then Road Widening
- [ ] Clicking a project name navigates to `/projects/:id`
- [ ] "Manage projects →" link goes to `/projects`

---

## Scenario 2 — Projects page (`/projects`)

Still as super admin.

- [ ] All 4 projects visible as cards
- [ ] Status filter: "Active" → 3 cards; "Completed" → 1; "On Hold" → 0
- [ ] Create a new project "Test Delete Me", status `active`, assign to Team Delta → appears in grid
- [ ] Edit the same project → change description → save → card reflects change
- [ ] Delete it → disappears

### Scenario 2b — Admin visibility
Logout, login as **9422514284** (GGC admin).

- [ ] `/projects` shows only **Hospital Construction + Road Widening Phase 1** (GGC's two)
- [ ] School Renovation and Drainage Repair are **not** visible
- [ ] Delete button is hidden on all cards (admin cannot delete)

---

## Scenario 3 — Per-project dashboard

Click any project card → "Dashboard" button.

- [ ] URL is `/projects/:id`
- [ ] Overview shows name, status badge, dates, location, contact info
- [ ] 6 stat tiles populated (Total, Pending, In Progress, Completed, Cancelled, Overdue)
- [ ] "Teams" lists assigned team(s) with member counts
- [ ] "Per-team breakdown" shows progress bars
- [ ] "Recent tasks" table lists tasks for this project only (no tasks from other projects leak in)

---

## Scenario 4 — Sticky active project (Profile page)

Login as `prasad palekar` (GGC admin).

- [ ] Go to `/profile` → see "Active Project" card
- [ ] Dropdown lists **Hospital Construction** and **Road Widening Phase 1** only
- [ ] Select "Hospital Construction" → save → refresh → still selected
- [ ] Select "— None —" → cleared
- [ ] Logout / log back in → still empty (persistence)

---

## Scenario 5 — Task form project dropdown

Still as `prasad palekar`.

### 5a) With sticky set
On `/profile`, set Active Project = "Road Widening Phase 1". Then `/tasks/new`:

- [ ] Project dropdown pre-selected to "Road Widening Phase 1"
- [ ] Helper text: "Defaulted to your active project: Road Widening Phase 1"
- [ ] Create task ("Test task 1", any category) → saved
- [ ] Go to `/tasks` → your new task shows an **indigo "Road Widening Phase 1" badge**

### 5b) With sticky cleared
`/profile` → clear sticky. Then `/tasks/new`:

- [ ] Project dropdown defaults to "— No project —"
- [ ] Create task with project = Hospital Construction → saved
- [ ] Go to `/tasks` → badge = "Hospital Construction"
- [ ] Create task with project = "— No project —" → saved
- [ ] On `/tasks` → that row has **no** badge

### 5c) Edit existing task
Click "View" on any task with a project → TaskForm loads with that project pre-selected.
Change to a different project → save → badge updates.

---

## Scenario 6 — Tasks list filter

On `/tasks`, click **Filters**:

- [ ] "Project" dropdown shows your accessible projects
- [ ] Select Hospital Construction → list narrows; every visible row has that badge
- [ ] "Clear all filters" → everything back

---

## Scenario 7 — Telegram `/project` command

On Telegram (as GGC user):

- [ ] `/help` → menu lists `/project`
- [ ] `/project` → bot shows inline buttons: **Hospital Construction**, **Road Widening Phase 1**, **🚫 None (clear)**
- [ ] Tap "Hospital Construction" → confirmation: "✅ Active project set: Hospital Construction"
- [ ] Tap `/project` again → Hospital Construction now shows a ✓ prefix
- [ ] Tap "🚫 None (clear)" → confirmation: "Active project cleared"

---

## Scenario 8 — Telegram auto-tag with sticky

After setting sticky to "Road Widening Phase 1" via `/project`:

- [ ] Send a new text task: `"tomorrow morning need to fix street light near market"`
- [ ] Bot confirms task created — **no** "Which project?" follow-up
- [ ] Open `/tasks` on web → your new task has the indigo "Road Widening Phase 1" badge

---

## Scenario 9 — Telegram ambiguous prompt

Clear sticky first via `/project` → 🚫 None. GGC is in 2 active projects, so:

- [ ] Send a new text task: `"workers need safety boots by friday"`
- [ ] Bot confirms task created
- [ ] **Immediately follows up** with a second message: "📁 Which project is this task for?"
      and buttons: Hospital Construction, Road Widening Phase 1, plus "🚫 Skip"
- [ ] Tap "Road Widening Phase 1" → confirmation: "✅ Tagged to: Road Widening Phase 1"
- [ ] Send another text task → **no** ambiguous prompt this time (sticky was auto-set)
- [ ] `/project` → Road Widening Phase 1 now marked as active

### Stale prompt test
- [ ] Trigger an ambiguous prompt again (clear sticky first)
- [ ] Wait 11+ minutes
- [ ] Tap any button → bot replies: "⌛ That prompt expired."

### Skip test
- [ ] Trigger ambiguous prompt → tap "🚫 Skip" → "Task saved without a project"
- [ ] Check `/tasks` → that task has **no** project badge

---

## Scenario 10 — Single-team auto-pick (no prompt, no sticky)

Login as **Admin Alpha** (`9000000001`, team = Team Alpha, only in Road Widening).
Set sticky = None via `/profile`.

- [ ] Telegram as Admin Alpha → send a text task
- [ ] No ambiguous prompt (team is in exactly 1 active project — auto-tagged)
- [ ] `/tasks` → task has "Road Widening Phase 1" badge

---

## Scenario 11 — Team in completed-only project

Login as **Admin Gamma** (`9000000003`, team = Team Gamma, only in Drainage Repair
which is `completed`).

- [ ] Telegram → `/project` → list shows only `active` or `on_hold` projects;
      Drainage Repair is filtered out → empty list → bot replies **"📁 No projects available"**
- [ ] Send a text task → task saved with **no** project (reason: `none`), no prompt

---

## Cleanup / reset

To reset the scenarios and re-run the seed (safe to re-run any time):

```bash
export PGPASSWORD=postgres123 && "/c/Program Files/PostgreSQL/18/bin/psql.exe" \
  -U postgres -d gims_db -h localhost \
  -f backend/seeds/test_projects_scenarios.sql
```

- Projects/tasks use fixed UUIDs with `ON CONFLICT DO NOTHING` — no duplicates on re-run
- `active_project_id` for GGC users gets reset every run so the Telegram flow is fresh

---

## What to do if a step fails

Copy the scenario number + the exact wrong result (screenshot or bot message text)
and hand it to Claude. Start with Scenario 1 (easy visual check) and work down —
by Scenario 9 you've covered all the interesting Telegram paths.

### Common failure patterns
| Symptom                                     | Likely cause                                 |
| ------------------------------------------- | -------------------------------------------- |
| Marathi shows as `?????`                    | Text was inserted via cmd.exe psql (cp1252); re-type in web form or re-save seed as UTF-8 |
| Dashboard "Projects Overview" missing       | Logged in as non-super-admin (it's super_admin-only) |
| Telegram ambiguous prompt never appears     | Sticky project is still set — clear it via `/project` → 🚫 None |
| `/project` returns "No projects available"  | Your team is not assigned to any `active`/`on_hold` project |
| Task has no badge despite sticky set        | You created the task before setting sticky; check ordering |
