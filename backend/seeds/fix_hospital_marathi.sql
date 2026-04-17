-- Fix mangled Marathi name for Hospital Construction project
UPDATE projects
SET name_marathi = 'रुग्णालय बांधकाम'
WHERE project_id = '3061a0ec-2f26-47d7-b01e-c27088f87a43';
