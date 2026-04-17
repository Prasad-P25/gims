# GIMS v2 — Projects Module Knowledge Transfer

**Version:** 1.0
**Last updated:** 2026-04-18
**Audience:** End users, operations team, developers

This document is the single source of truth for the **Projects** feature in GIMS v2. It covers what the feature does, how to use it from the web and Telegram, the business rules that drive it, and the technical implementation details.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Key Concepts](#2-key-concepts)
3. [End-User Guide — Web](#3-end-user-guide--web)
4. [End-User Guide — Telegram](#4-end-user-guide--telegram)
5. [Operations Team Guide](#5-operations-team-guide)
6. [Telegram Bot Command Reference](#6-telegram-bot-command-reference)
7. [Business Rules Reference](#7-business-rules-reference)
8. [Developer Reference](#8-developer-reference)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Overview

### What is a Project?

A **Project** is a long-running piece of work (e.g. *"Hospital Construction"*, *"Road Widening Phase 1"*) that groups many tasks together. Instead of seeing one giant flat list of tasks, each task can be tagged to a project so you can track progress, budget, and team activity per project.

### Why Projects exist

- **Grouping**: See only tasks that belong to *"Road Widening Phase 1"* without noise from other work.
- **Progress tracking**: How many of this project's tasks are done? A dashboard shows the percentage.
- **Team alignment**: Know which teams are working on which project, and see per-team breakdowns.
- **Auto-tagging from Telegram**: When supervisors send a task on Telegram, the system auto-assigns it to the right project (no extra steps needed in the common case).

### Who uses it

| Role             | What they can do                                                             |
| ---------------- | ---------------------------------------------------------------------------- |
| **Super admin**  | Everything — see/create/edit/delete any project, assign any team.            |
| **Admin**        | See/create/edit projects their team is in. Cannot delete.                    |
| **Member**       | See and use projects their team is in. Cannot create, edit, or delete.       |

---

## 2. Key Concepts

### 2.1 Project statuses

| Status       | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `active`     | Ongoing work. Accepts new tasks. Shows in Telegram `/project` picker.   |
| `on_hold`    | Temporarily paused. Still visible in pickers.                           |
| `completed`  | Finished. **Not shown** in Telegram `/project` picker.                  |
| `archived`   | Historical. Hidden from most pickers; only visible in filtered views.   |

### 2.2 Team assignment

A project has one or more **teams** assigned to it. This is what controls who can see the project:

- If your team is assigned to a project, you can see it.
- If your team is not assigned, you can't see it (except super admin, who sees everything).

### 2.3 Active Project (sticky)

Every user has one optional **Active Project** saved on their profile. When set:

- New tasks created via Web, Telegram, or WhatsApp are **auto-tagged** to that project.
- You don't have to pick a project every single time.
- It persists across devices and sessions until you change it.

You can set it from two places:
- Web → `Profile` page → "Active Project" card
- Telegram → `/project` command

### 2.4 The resolution cascade

When a task is created, the system decides which project it belongs to using this order (first match wins):

1. **Explicit choice** — User picked a project in the form or Telegram prompt.
2. **Sticky** — User's Active Project (if their team still has access to it).
3. **Single-team auto-pick** — If the user's team is in exactly **one** active project, use it.
4. **Ambiguous prompt** — If the team is in **two or more** projects, Telegram asks which one.
5. **None** — Task is saved without a project.

This cascade is **deliberate** — don't simplify it.

---

## 3. End-User Guide — Web

### 3.1 Setting your Active Project

1. Log in → top-right menu → **Profile**.
2. Scroll to **"Active Project"** card.
3. Pick a project from the dropdown → it **auto-saves** (no Save button needed).
4. A blue banner below confirms: *"✓ Active: [project name]"*.
5. To clear it, click the **"Clear"** button next to the dropdown.

The dropdown only shows projects your team is assigned to, plus **"— None (tasks stay unassigned) —"**.

### 3.2 Creating a task with a project

1. Go to `/tasks/new`.
2. The **Project** dropdown at the top:
   - If you have an Active Project set → it's pre-selected, and helper text shows *"Defaulted to your active project: [name]"*.
   - If you don't → defaults to **"— No project —"**.
3. You can override: pick a different project, or **"— No project —"** to save unassigned.
4. Fill in the rest of the task → Save.

### 3.3 Viewing tasks by project

**On `/tasks`:**
- Each task row with a project shows an **indigo badge** with the project name.
- Tasks without a project have no badge.
- Click **Filters** → select a **Project** → list narrows to just that project's tasks.
- **Clear all filters** brings everything back.

### 3.4 Viewing a single project's dashboard

1. Go to `/projects`.
2. Find the project card → click the **"📊 Dashboard"** link at the bottom of the card.
   - **Note:** The card body itself is not clickable — use the Dashboard link.
3. URL becomes `/projects/<id>` showing:
   - **Overview**: name, status, dates, location, contact info, budget.
   - **6 stat tiles**: Total, Pending, In Progress, Completed, Cancelled, Overdue.
   - **Teams**: each assigned team with member count.
   - **Per-team breakdown**: progress bars.
   - **Recent tasks**: list of tasks in this project only.

### 3.5 Editing a task's project

1. Open an existing task (click **View** on any row).
2. Change the **Project** dropdown to a different project.
3. Save → the badge on the `/tasks` list updates automatically.

---

## 4. End-User Guide — Telegram

### 4.1 First-time setup

Your Telegram account must be linked to your GIMS account. You need to do this once.

**Steps:**
1. On the web → `Profile` → **Telegram Integration** section → click **"Link Telegram"**.
2. Copy the command shown (looks like `/link 9876543210`).
3. Open Telegram, find the GIMS bot, send that command.
4. Bot confirms: *"✅ Account linked successfully! Welcome, [your name]!"*

### 4.2 Setting your Active Project via Telegram

1. Send **`/project`** to the bot.
2. Bot replies with **inline buttons** — one button per project your team is in (active and on_hold only — completed/archived projects are excluded), plus a **"🚫 None (clear)"** button.
3. Tap a project → bot confirms: *"✅ Active project set: [name]"*.
4. Send `/project` again → the active project now shows with a **✓ prefix**.
5. Tap **"🚫 None (clear)"** any time to remove the sticky → *"Active project cleared"*.

### 4.3 Creating a task by text

Send any plain-text message ≥ 5 characters, in Marathi / Hindi / English:

> *"उद्या सकाळी पाईप दुरुस्ती करायची आहे"*
> *"Road repair needed at Main Street tomorrow"*
> *"कल सुबह बिजली का काम करना है"*

**What happens:**
1. Google Gemini AI extracts a task structure (category, priority, due date, description).
2. Task is saved with your user as `registered_by`.
3. Project assignment uses the [resolution cascade](#24-the-resolution-cascade).

### 4.4 Creating a task by voice

Send a voice message in any language. The bot transcribes it via Gemini, extracts the task, and confirms.

### 4.5 The "Which project?" prompt

**When it appears:**
- You don't have an Active Project set (sticky is empty).
- Your team is in **2 or more** active projects.

**What the bot does:**
1. Creates the task.
2. Immediately sends a second message: **"📁 Which project is this task for?"** with buttons for each project + **"🚫 Skip"**.

**Your options:**
- **Tap a project** → task is tagged to it AND your Active Project is auto-set (so next time, no prompt).
- **Tap 🚫 Skip** → task stays without a project.
- **Ignore it for 10+ minutes** → the prompt expires; tapping any button gives *"⌛ That prompt expired."*

### 4.6 Single-team auto-tagging

If your team is in **exactly one** active project, new tasks tag to it automatically with no prompt and no sticky needed.

### 4.7 Viewing and updating tasks on Telegram

See the [full command reference](#6-telegram-bot-command-reference) below.

---

## 5. Operations Team Guide

This section is for people who **manage** projects (super admins and team admins).

### 5.1 Creating a new project

1. Go to `/projects` → click **"+ New Project"**.
2. Fill in:
   - **Name (English)** — required, min 2 chars.
   - **Name (Marathi)** — optional, displayed in Telegram and on some reports.
   - **Description**, **Location**, **Status** (default `active`).
   - **Start / End date**, **Budget**.
   - **Contact person** — name, phone, email.
   - **Teams** — check the boxes of teams that should work on this project.
3. Click **Create Project**.

> **Admin note:** If you're an admin (not super admin), you must include your own team in the assigned teams. You can't create a project your team isn't part of.

### 5.2 Editing a project

1. On `/projects` → click the **pencil icon** on a project card.
2. Modify fields → Save.
3. Team assignments are managed separately: check/uncheck teams in the edit form — each toggle saves immediately (with a confirmation for removals).

### 5.3 Deleting a project (super admin only)

Only super admins see the **trash-can icon** on cards. Deletion is a **soft delete** — the project row is marked `deleted_at` but not physically removed. Tasks linked to the project keep working (their `project_id` gets set to NULL via foreign-key `ON DELETE SET NULL`).

### 5.4 Assigning teams to a project

Two ways:
- **At creation**: check teams in the form.
- **After creation**: open the edit form → toggle teams in the "Teams on this project" section.

### 5.5 Monitoring project progress

- **Super admin Dashboard** (`/dashboard`) has a **"Projects Overview"** card with:
  - Status counts: Active / On Hold / Completed / Archived.
  - Overall progress bar across all projects.
  - Top 5 projects by task volume.
  - Click a project name → goes to its dashboard.
- **Per-project dashboard** (`/projects/<id>`) — full stats per project (see §3.4).

### 5.6 Common operations tasks

| Task                                            | Where                                                    |
| ----------------------------------------------- | -------------------------------------------------------- |
| Add a new team to an existing project           | `/projects` → Edit the project → check the team         |
| Move a team off a project                       | `/projects` → Edit → uncheck the team (confirmation)    |
| Mark a project as complete                      | `/projects` → Edit → set status to `completed` → Save   |
| Pause a project temporarily                     | Edit → set status to `on_hold`                          |
| Hide a finished project from pickers            | Edit → set status to `archived`                         |
| Find out why a user doesn't see a project       | Check their team → is that team assigned to the project? |

---

## 6. Telegram Bot Command Reference

Every slash command the bot accepts, grouped by purpose.

### 6.1 Account commands

| Command             | What it does                                                                 |
| ------------------- | ---------------------------------------------------------------------------- |
| `/link [phone]`     | Links your Telegram to a GIMS account by phone (10 digits). Fails if phone not found or already linked to another Telegram. |
| `/whoami`           | Shows your linked name, phone, role, and Telegram ID.                        |
| `/start` / `/help`  | Shows the full command menu.                                                 |

### 6.2 Task commands

| Command         | What it does                                                                      |
| --------------- | --------------------------------------------------------------------------------- |
| `/mytasks`      | Tasks you created or were assigned in the last 24 hours. Each has inline buttons to change status. Limit 10. |
| `/today`        | All tasks registered today, with completion count and status breakdown.           |
| `/pending`      | All pending tasks — priority, category, due date, location.                       |
| `/status`       | Full task overview: total, pending, in progress, completed. Plus detail lists.    |
| `/menu`         | Shows the category menu as inline buttons to start creating a task.               |
| `/assign`       | **Admin only.** Lists unassigned tasks (last 7 days) with buttons to assign them to team members. Super admin sees all; team admin sees their team's tasks only. |
| `/summary`      | **Admin / super admin only.** Daily task summary with team stats.                 |
| `/testreminder` | **Super admin only.** Manually trigger a reminder job: `/testreminder overdue`, `/testreminder morning`, `/testreminder evening`, `/testreminder daily`. |

### 6.3 Project commands

| Command    | What it does                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------ |
| `/project` | Shows inline buttons to set your Active Project. Projects listed: active + on_hold only. Current active project marked with ✓. Tap **"🚫 None (clear)"** to unset. If your team is in zero active/on_hold projects, bot replies *"📁 No projects available"*. |

### 6.4 Conversational behavior (non-commands)

These aren't commands, but things the bot responds to:

| Trigger                                         | Behavior                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Plain text ≥ 5 chars**                        | Treats as a task. Gemini extracts category/priority/due date/description.          |
| **Voice / audio message**                       | Transcribes via Gemini, then treats as a task.                                     |
| **Low-confidence extraction (0.4–0.7)**         | Bot stores original text, asks you to pick a category manually.                    |
| **Very low confidence (<0.4)**                  | Bot rejects and suggests rephrasing.                                               |
| **Greeting ("hi", "hello", "नमस्कार", etc.)**   | Bot replies with a welcome and suggests `/help`.                                   |
| **Ambiguous project (team in 2+ projects)**     | After task creation, bot asks "📁 Which project?" with project buttons + Skip.     |
| **Button tapped >10 min after prompt**          | Bot replies *"⌛ That prompt expired."*                                             |

### 6.5 Example `/help` output

```
GIMS Task Bot Commands:

Account:
/link [phone] - Link your Telegram to GIMS account
/whoami - Show your linked account info

Tasks:
/mytasks - View & update your tasks (last 24 hours)
/assign - Assign a task to team member (admin)
/status - Show full task overview with details
/today - Show today's tasks
/pending - Show all pending tasks
/menu - Show category menu
/project - Set your active project (auto-tags new tasks)
/summary - Daily task summary (admin only)
/testreminder - Test a reminder now (super admin)

How to use:
1. First link your account: /link 9876543210
2. Send a text message describing your task
3. Or send a voice message in Marathi/Hindi/English
4. The bot will automatically categorize and register your task
5. Use /mytasks to update task status

Example messages:
• "उद्या सकाळी पाईप दुरुस्ती करायची आहे"
• "Road repair needed at Main Street tomorrow"
• "कल सुबह बिजली का काम करना है"
```

---

## 7. Business Rules Reference

Quick-reference table of every rule that governs Projects.

### 7.1 Visibility rules

| User role    | Can see                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| super_admin  | All projects (active, on_hold, completed, archived).                       |
| admin        | Only projects where their team is in `project_teams`.                      |
| member       | Only projects where their team is in `project_teams`.                      |

Soft-deleted projects (`deleted_at IS NOT NULL`) are hidden from **everyone**.

### 7.2 Permission rules

| Action                 | super_admin | admin (team owner) | admin (other team) | member |
| ---------------------- | :---------: | :----------------: | :----------------: | :----: |
| View project           | ✅           | ✅                  | ❌                  | ✅*     |
| Create project         | ✅           | ✅                  | ✅                  | ❌      |
| Edit project           | ✅           | ✅                  | ❌                  | ❌      |
| Delete project         | ✅           | ❌                  | ❌                  | ❌      |
| Assign team to project | ✅           | ✅ (own team)       | ❌                  | ❌      |
| Remove team            | ✅           | ✅ (own team)       | ❌                  | ❌      |
| Set Active Project     | ✅           | ✅                  | ✅                  | ✅      |

*Members see only if their team is in the project.

### 7.3 Telegram project-picker rules

| Condition                                        | Bot behavior                                |
| ------------------------------------------------ | ------------------------------------------- |
| User's team in 0 active/on_hold projects         | *"📁 No projects available"*                |
| User's team in 1 active project                  | Single button + "None (clear)"              |
| User's team in 2+ active projects                | One button per project + "None (clear)"     |
| Completed / archived projects                    | Always filtered out of the picker           |

### 7.4 Ambiguous prompt rules

- Appears only when: sticky is not set **and** single-team auto-pick doesn't apply (team in 2+ projects).
- Stored in Redis under key `telegram:proj_pick:<chatId>` with **10-minute TTL**.
- Tapping a project: tags the task + sets sticky (so future tasks don't re-prompt).
- Tapping Skip: task stays unassigned, no sticky set.
- Expiry: any button tap after 10 min → *"⌛ That prompt expired."*

### 7.5 Auto-clearing the sticky

The sticky (`users.active_project_id`) is effectively cleared in these cases:
- User selects "— None —" in Profile or taps "🚫 None (clear)" in Telegram.
- Project's `active_project_id` FK is set to NULL via `ON DELETE SET NULL` when the project is soft-deleted.
- The resolution cascade skips the sticky if the user's team no longer has access (e.g. team was removed from the project) — but the column still holds the stale ID until explicitly reset.

---

## 8. Developer Reference

### 8.1 Database schema

**`projects` table** (`backend/migrations/008_projects.sql`):

| Column                  | Type                 | Notes                                                       |
| ----------------------- | -------------------- | ----------------------------------------------------------- |
| `project_id`            | UUID PK              | Default `gen_random_uuid()`                                 |
| `name_english`          | VARCHAR(200) NOT NULL|                                                             |
| `name_marathi`          | VARCHAR(200)         |                                                             |
| `description`           | TEXT                 |                                                             |
| `location`              | VARCHAR(300)         |                                                             |
| `status`                | VARCHAR(20) NOT NULL | CHECK in (`active`, `on_hold`, `completed`, `archived`)     |
| `start_date`, `end_date`| DATE                 |                                                             |
| `budget`                | NUMERIC(14,2)        |                                                             |
| `project_manager_id`    | UUID FK users        | Informational only — no special permissions attached.       |
| `contact_person_*`      | VARCHAR              | `name`, `phone`, `email`                                    |
| `created_by`            | UUID FK users NOT NULL |                                                           |
| `created_at`, `updated_at` | TIMESTAMPTZ       | `updated_at` auto-bumped by trigger                          |
| `deleted_at`            | TIMESTAMPTZ          | Soft delete                                                 |

Indexes: `status`, `project_manager_id`, `created_by`.

**`project_teams` junction** (composite PK: `project_id`, `team_id`):

| Column         | Type          |
| -------------- | ------------- |
| `project_id`   | UUID FK projects (CASCADE) |
| `team_id`      | UUID FK teams (CASCADE)    |
| `assigned_at`  | TIMESTAMPTZ DEFAULT NOW()  |
| `assigned_by`  | UUID FK users              |

**Added columns:**

- `task_registry.project_id` — UUID, nullable, FK projects ON DELETE SET NULL.
- `users.active_project_id` — UUID, nullable, FK projects ON DELETE SET NULL.

### 8.2 API endpoints

Base path: `/api/projects`. All require `authenticate` middleware.

| Method | Path                         | Purpose                                                  | Permission           |
| ------ | ---------------------------- | -------------------------------------------------------- | -------------------- |
| GET    | `/mine`                      | List projects the user's team is in (dropdown source).   | Any authenticated    |
| GET    | `/`                          | List projects (role-filtered).                            | Any authenticated    |
| POST   | `/`                          | Create project with optional team assignments.           | super_admin, admin   |
| GET    | `/:id`                       | Get a single project (with access check).                 | Access-controlled    |
| PUT    | `/:id`                       | Update project fields.                                    | super_admin, creator |
| DELETE | `/:id`                       | Soft delete project.                                      | super_admin          |
| GET    | `/:id/teams`                 | List teams on a project.                                  | Access-controlled    |
| POST   | `/:id/teams`                 | Assign team(s) to a project.                              | super_admin, admin   |
| DELETE | `/:id/teams/:teamId`         | Remove a team from a project.                             | super_admin, admin   |
| GET    | `/:id/dashboard`             | Full project dashboard data (stats, per-team, recent tasks). | Access-controlled |

Profile-related:
- `GET /api/profile/active-project` — Get the user's current Active Project.
- `PUT /api/profile/active-project` — Set or clear the user's Active Project. Body: `{ "project_id": "<uuid or null>" }`.

### 8.3 Key service functions

**`backend/src/services/project.service.ts`:**
- `list(user)` — returns projects with access filter applied.
- `create(user, data)` — creates project + optional team assignments in a transaction.
- `accessFilter(user)` — SQL fragment: super_admin → none; admin/member → `EXISTS (project_teams WHERE team_id = <user's team>)`.

**`backend/src/services/task.service.ts::resolveProjectForUser()`:**

```
Input:  { user, requestedProjectId?, source }
Output: { project_id: string | null, reason: string, candidates?: Project[] }

Reasons (in cascade order):
  'explicit'             — user picked one in the form/buttons
  'sticky'               — user.active_project_id, still accessible
  'single_team_project'  — team in exactly 1 active project
  'ambiguous'            — team in 2+ projects; candidates returned
  'none'                 — no projects match

Side effects:
  - If reason === 'ambiguous' and source === 'telegram', caller stores
    registry_id in Redis (TTL 10 min) and sends inline buttons.
  - Explicit choice validates team has access; falls through to sticky if not.
```

**Do not simplify this cascade.** It encodes several product decisions (single-team auto, ambiguous-only prompts, explicit override) that were deliberately chosen.

### 8.4 Frontend pages

- `frontend/src/pages/Projects.tsx` — list/create/edit/delete, team assignment.
- `frontend/src/pages/ProjectDashboard.tsx` — per-project overview with stats.
- `frontend/src/pages/Profile.tsx` — Active Project section.
- `frontend/src/pages/TaskForm.tsx` — project dropdown with sticky pre-fill.
- `frontend/src/pages/Tasks.tsx` — project filter + badges.
- `frontend/src/pages/Dashboard.tsx` — super-admin-only Projects Overview card.

### 8.5 Queues and jobs

- `telegram.queue.ts` handles the ambiguous-prompt callback — reads `telegram:proj_pick:<chatId>` from Redis, updates task, sets sticky, and confirms.
- No project-specific cron jobs (reminders are task-level, not project-level).

### 8.6 Test seed

- `backend/seeds/test_projects_scenarios.sql` — idempotent, sets up 4 projects with known team assignments so Telegram scenarios can be exercised.
- `backend/seeds/fix_hospital_marathi.sql` — one-time fix for a pre-existing project's mangled Marathi; re-apply if DB is rebuilt.
- Test plan: `docs/projects-testing.md` — 16 scenarios covering every path.

---

## 9. Troubleshooting

| Symptom                                                        | Likely cause                                                           | Fix                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| User can't see a project they should                           | Their team isn't in `project_teams` for that project                   | Admin → `/projects` → Edit → add the team                                |
| Telegram `/project` returns "No projects available"            | User's team isn't in any `active` or `on_hold` project                 | Assign their team to an appropriate project, or mark an existing project `active` |
| New task doesn't get auto-tagged despite sticky being set      | Task was created *before* sticky was set; or team lost access since    | Edit task to set project manually; re-set sticky                         |
| Ambiguous prompt never appears                                 | User already has a sticky set (sticky wins over ambiguous)             | `/project` → 🚫 None (clear)                                             |
| Button tap replies "⌛ That prompt expired"                     | More than 10 minutes passed since the prompt was sent                  | Send a new task — a fresh prompt appears                                 |
| Marathi project names show as `????`                           | Seed was loaded via Windows `cmd.exe` psql (cp1252 encoding)           | Re-save as UTF-8 and load via bash-compatible shell                      |
| Dashboard "Projects Overview" card is missing                  | Logged in as non-super_admin (card is super_admin only)                | Log in as super_admin                                                    |
| Task in deleted project's row still shows a badge              | Badge reads from the task's cached project_id                          | Refresh the page (FK already set to NULL on delete, the UI just reloads) |
| Clicking a project card does nothing                           | Card body is not a link — the **"Dashboard"** button at the bottom is  | Click the Dashboard link/button on the card                              |

---

## Appendix A — Test accounts

For testing environments only:

| Role             | Phone        | Password   | Team        |
| ---------------- | ------------ | ---------- | ----------- |
| super_admin      | `9000000000` | `admin123` | —           |
| admin (GGC)      | `9422514284` | *custom*   | GGC         |
| admin (Alpha)    | `9000000001` | `admin123` | Team Alpha  |
| admin (Beta)     | `9000000002` | `admin123` | Team Beta   |
| admin (Gamma)    | `9000000003` | `admin123` | Team Gamma  |
| admin (Delta)    | `9000000004` | `admin123` | Team Delta  |
| member (GGC)     | `8806860925` | *custom*   | GGC         |
| member (GGC)     | `9921821075` | *custom*   | GGC         |

---

## Appendix B — Related documents

- `docs/projects-testing.md` — Full manual test checklist (16 scenarios).
- `backend/migrations/008_projects.sql` — Schema DDL.
- `backend/seeds/test_projects_scenarios.sql` — Test seed.
- `CLAUDE.md` — Project-wide developer guide.

---

*End of document.*
