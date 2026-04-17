-- Test scenarios for the Projects feature.
-- Idempotent: safe to re-run. Uses fixed UUIDs so ON CONFLICT skips duplicates.
--
-- What this sets up:
--   P1 "Hospital Construction" (existing) -> flipped to active; GGC already assigned
--   P2 "Road Widening Phase 1"            -> active;    assigned to GGC + Team Alpha
--   P3 "School Renovation"                -> active;    assigned to Team Beta only
--   P4 "Drainage Repair"                  -> completed; assigned to Team Gamma
--
-- Net effect:
--   GGC members    => in 2 active projects (P1, P2)  -> AMBIGUOUS case triggers
--   Team Alpha     => in 1 active project  (P2)      -> single-team auto-pick
--   Team Beta      => in 1 active project  (P3)      -> single-team auto-pick
--   Team Gamma     => in 1 completed proj. (P4)      -> will not auto-pick completed
--   Team Delta     => in 0 projects                   -> tasks stay unassigned
--
-- Also resets active_project_id for GGC users so the "first time" flow works.

BEGIN;

-- 1. Flip Hospital Construction to active so GGC has 2 active projects
UPDATE projects
SET status = 'active'
WHERE project_id = '3061a0ec-2f26-47d7-b01e-c27088f87a43';

-- 2. Insert P2, P3, P4 with fixed UUIDs
INSERT INTO projects (project_id, name_english, name_marathi, description, location, status, start_date, end_date, budget, contact_person_name, contact_person_phone, contact_person_email, created_by)
VALUES
  ('b0000001-0000-0000-0000-000000000001',
   'Road Widening Phase 1',
   'रस्ता रुंदीकरण टप्पा १',
   'Phase 1 widening of the main approach road; shared by GGC and Team Alpha.',
   'Main Road, Sector 4',
   'active', CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '40 days',
   1500000, 'R. Patil', '9988776655', 'rpatil@example.gov',
   '05db4ee2-42a2-405a-b53e-17166e2a9cf2'),

  ('b0000001-0000-0000-0000-000000000002',
   'School Renovation',
   'शाळा नूतनीकरण',
   'Classroom and toilet block renovation; Team Beta is the execution team.',
   'Zilla Parishad School, Ward 7',
   'active', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '60 days',
   800000, 'S. Deshmukh', '9911223344', 'sdeshmukh@example.gov',
   '05db4ee2-42a2-405a-b53e-17166e2a9cf2'),

  ('b0000001-0000-0000-0000-000000000003',
   'Drainage Repair',
   'गटार दुरुस्ती',
   'Completed monsoon-prep drainage cleaning across the municipality.',
   'Ward 3',
   'completed', CURRENT_DATE - INTERVAL '90 days', CURRENT_DATE - INTERVAL '10 days',
   350000, 'K. Jadhav', '9900112233', 'kjadhav@example.gov',
   '05db4ee2-42a2-405a-b53e-17166e2a9cf2')
ON CONFLICT (project_id) DO NOTHING;

-- 3. Assign teams to projects (idempotent)
INSERT INTO project_teams (project_id, team_id, assigned_by)
VALUES
  -- P2 Road Widening -> GGC + Team Alpha  (gives GGC 2 active projects)
  ('b0000001-0000-0000-0000-000000000001', '06582d08-5447-4b7a-be86-b804f0c6d1a4', '05db4ee2-42a2-405a-b53e-17166e2a9cf2'),
  ('b0000001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '05db4ee2-42a2-405a-b53e-17166e2a9cf2'),
  -- P3 School Renovation -> Team Beta
  ('b0000001-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '05db4ee2-42a2-405a-b53e-17166e2a9cf2'),
  -- P4 Drainage Repair -> Team Gamma
  ('b0000001-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', '05db4ee2-42a2-405a-b53e-17166e2a9cf2')
ON CONFLICT DO NOTHING;

-- 4. Clear sticky active_project_id for GGC users so you can see the picker flow fresh
UPDATE users
SET active_project_id = NULL
WHERE team_id = '06582d08-5447-4b7a-be86-b804f0c6d1a4';

-- 5. Seed a handful of tasks per project so the dashboards show real numbers.
-- Fixed registry_ids keep this idempotent.
INSERT INTO task_registry (registry_id, category_id, registered_by, assigned_to, project_id, task_data, input_mode, input_source, priority, status, registration_date, registration_time)
VALUES
  -- Hospital Construction (P1) - 3 tasks
  ('a1a1a1a1-0000-0000-0000-000000000001', 1, '0993a142-e7df-4f21-905c-caf21c4db934', '0993a142-e7df-4f21-905c-caf21c4db934', '3061a0ec-2f26-47d7-b01e-c27088f87a43',
   '{"title":"Concrete pouring - wing B","description":"Site needs concrete supply by 11 AM"}'::jsonb,
   'text', 'web', 'high', 'in_progress', CURRENT_DATE, CURRENT_TIME),
  ('a1a1a1a1-0000-0000-0000-000000000002', 2, '0993a142-e7df-4f21-905c-caf21c4db934', 'ac4ed221-72e4-47bd-8cf7-485ad6108aa7', '3061a0ec-2f26-47d7-b01e-c27088f87a43',
   '{"title":"Inspect east scaffolding","description":"Safety rail check"}'::jsonb,
   'text', 'web', 'medium', 'pending', CURRENT_DATE, CURRENT_TIME),
  ('a1a1a1a1-0000-0000-0000-000000000003', 1, '0993a142-e7df-4f21-905c-caf21c4db934', 'ac4ed221-72e4-47bd-8cf7-485ad6108aa7', '3061a0ec-2f26-47d7-b01e-c27088f87a43',
   '{"title":"Plumbing rough-in completed","description":"Wing A ground floor done"}'::jsonb,
   'text', 'web', 'low', 'completed', CURRENT_DATE - 2, CURRENT_TIME),

  -- Road Widening (P2) - 4 tasks
  ('a2a2a2a2-0000-0000-0000-000000000001', 1, 'b2529d6a-cf6a-462d-9970-b8b689f2dceb', '4354ee3b-47ad-40bb-b657-b24868fd4077', 'b0000001-0000-0000-0000-000000000001',
   '{"title":"Survey stake on km 3","description":"Mark left shoulder"}'::jsonb,
   'text', 'web', 'medium', 'completed', CURRENT_DATE - 1, CURRENT_TIME),
  ('a2a2a2a2-0000-0000-0000-000000000002', 4, 'b2529d6a-cf6a-462d-9970-b8b689f2dceb', '6300ba90-d003-470a-ac06-ee43930f11f1', 'b0000001-0000-0000-0000-000000000001',
   '{"title":"Worker shift roster - week 3","description":"Finalise roster"}'::jsonb,
   'text', 'web', 'medium', 'in_progress', CURRENT_DATE, CURRENT_TIME),
  ('a2a2a2a2-0000-0000-0000-000000000003', 1, 'b2529d6a-cf6a-462d-9970-b8b689f2dceb', NULL, 'b0000001-0000-0000-0000-000000000001',
   '{"title":"Tarmac order - delay","description":"Supplier reconfirmation"}'::jsonb,
   'text', 'web', 'high', 'pending', CURRENT_DATE, CURRENT_TIME),
  ('a2a2a2a2-0000-0000-0000-000000000004', 3, 'b2529d6a-cf6a-462d-9970-b8b689f2dceb', '41ca54ae-3a03-414b-af16-241be4bb28e7', 'b0000001-0000-0000-0000-000000000001',
   '{"title":"Night-shift supervisor patrol","description":"Sector 4 to Sector 5"}'::jsonb,
   'text', 'web', 'low', 'pending', CURRENT_DATE, CURRENT_TIME),

  -- School Renovation (P3) - 2 tasks
  ('a3a3a3a3-0000-0000-0000-000000000001', 1, '68de37b3-957c-49fe-8547-b3d1a21274fb', '5db6907d-c691-4013-aa82-25ab9f3825cf', 'b0000001-0000-0000-0000-000000000002',
   '{"title":"Paint classroom 4-A","description":"Use green base tint"}'::jsonb,
   'text', 'web', 'medium', 'in_progress', CURRENT_DATE, CURRENT_TIME),
  ('a3a3a3a3-0000-0000-0000-000000000002', 1, '68de37b3-957c-49fe-8547-b3d1a21274fb', '589eea1f-704d-4ddf-87e8-7b2e477f392a', 'b0000001-0000-0000-0000-000000000002',
   '{"title":"Toilet block tiling","description":"East wing ground floor"}'::jsonb,
   'text', 'web', 'high', 'pending', CURRENT_DATE, CURRENT_TIME),

  -- Drainage Repair (P4 - completed project) - 2 completed tasks
  ('a4a4a4a4-0000-0000-0000-000000000001', 1, '3807b657-a828-4f38-8812-624c0242118c', '1e2cafc3-a0a0-4790-b02d-258c23e7e52a', 'b0000001-0000-0000-0000-000000000003',
   '{"title":"Ward 3 channel cleaning","description":"North stretch"}'::jsonb,
   'text', 'web', 'medium', 'completed', CURRENT_DATE - 15, CURRENT_TIME),
  ('a4a4a4a4-0000-0000-0000-000000000002', 1, '3807b657-a828-4f38-8812-624c0242118c', '04abdc0c-e814-49f0-8a80-287948392c41', 'b0000001-0000-0000-0000-000000000003',
   '{"title":"Desilting outfall pipe","description":"South-east outfall"}'::jsonb,
   'text', 'web', 'low', 'completed', CURRENT_DATE - 20, CURRENT_TIME)
ON CONFLICT (registry_id) DO NOTHING;

COMMIT;

-- Handy verification queries (uncomment to run after):
-- SELECT p.name_english, p.status, COUNT(pt.team_id) AS teams, COUNT(tr.registry_id) AS tasks,
--        COUNT(tr.registry_id) FILTER (WHERE tr.status='completed') AS completed
-- FROM projects p
-- LEFT JOIN project_teams pt ON pt.project_id = p.project_id
-- LEFT JOIN task_registry tr ON tr.project_id = p.project_id AND tr.deleted_at IS NULL
-- WHERE p.deleted_at IS NULL
-- GROUP BY p.project_id, p.name_english, p.status
-- ORDER BY p.status, p.name_english;
