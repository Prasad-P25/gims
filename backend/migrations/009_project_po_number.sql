-- Migration: 009_project_po_number.sql
-- Description: Add PO (Purchase Order) number to projects.

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);

COMMENT ON COLUMN projects.po_number IS 'Purchase Order number associated with the project (optional).';
