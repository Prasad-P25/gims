-- GIMS Task Registry System - Category Seed Data
-- Seed: 001_categories.sql
-- Description: Insert 11 task categories with Marathi and English names

-- Clear existing categories (if re-running seed)
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;

-- Insert the 11 task categories
INSERT INTO categories (name_english, name_marathi, description, field_template, display_order, is_active) VALUES
(
    'Work Description',
    'कामाचे सविस्तर वर्णन',
    'Detailed maintenance work descriptions',
    '{
        "work_type": {"type": "text", "label_english": "Work Type", "label_marathi": "कामाचा प्रकार", "required": true},
        "location": {"type": "text", "label_english": "Location", "label_marathi": "स्थान", "required": true},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true},
        "assigned_to": {"type": "text", "label_english": "Assigned To", "label_marathi": "नियुक्त केलेले", "required": false}
    }',
    1,
    true
),
(
    'Site Updates',
    'साईट वरुन आपडेट घेणे',
    'Updates received from various sites',
    '{
        "site_name": {"type": "text", "label_english": "Site Name", "label_marathi": "साईटचे नाव", "required": true},
        "update_type": {"type": "select", "label_english": "Update Type", "label_marathi": "अपडेटचा प्रकार", "required": true, "options": ["Progress", "Issue", "Completion", "Delay", "Other"]},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true},
        "reported_by": {"type": "text", "label_english": "Reported By", "label_marathi": "अहवाल दिलेला", "required": false}
    }',
    2,
    true
),
(
    'Supervisor Watch',
    'सुपरवायझर/टेलिकॉलर वॉच',
    'Supervisor and telecaller activity tracking',
    '{
        "supervisor_name": {"type": "text", "label_english": "Supervisor Name", "label_marathi": "सुपरवायझरचे नाव", "required": true},
        "activity_type": {"type": "select", "label_english": "Activity Type", "label_marathi": "क्रियाकलाप प्रकार", "required": true, "options": ["Site Visit", "Call Monitoring", "Team Meeting", "Report Review", "Other"]},
        "observations": {"type": "text", "label_english": "Observations", "label_marathi": "निरीक्षणे", "required": true},
        "action_taken": {"type": "text", "label_english": "Action Taken", "label_marathi": "केलेली कारवाई", "required": false}
    }',
    3,
    true
),
(
    'Worker Updates',
    'कारस्तगण साईट अपडेट',
    'Updates about workers at sites',
    '{
        "worker_name": {"type": "text", "label_english": "Worker Name", "label_marathi": "कामगाराचे नाव", "required": true},
        "site_name": {"type": "text", "label_english": "Site Name", "label_marathi": "साईटचे नाव", "required": true},
        "update_type": {"type": "select", "label_english": "Update Type", "label_marathi": "अपडेटचा प्रकार", "required": true, "options": ["Attendance", "Work Progress", "Issue", "Leave", "Other"]},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    4,
    true
),
(
    'Email Responses',
    'ई-मेल रिस्पॉन्स',
    'Email correspondence and responses',
    '{
        "email_subject": {"type": "text", "label_english": "Email Subject", "label_marathi": "ईमेल विषय", "required": true},
        "sender": {"type": "text", "label_english": "From", "label_marathi": "कडून", "required": true},
        "recipient": {"type": "text", "label_english": "To", "label_marathi": "प्रति", "required": false},
        "summary": {"type": "text", "label_english": "Summary", "label_marathi": "सारांश", "required": true},
        "action_required": {"type": "select", "label_english": "Action Required", "label_marathi": "आवश्यक कारवाई", "required": false, "options": ["Reply Needed", "Forward", "Archive", "Follow Up", "None"]}
    }',
    5,
    true
),
(
    'SOS/Consultant',
    'सल्लागार व घेर सेफिंग SOS',
    'Emergency situations and consultant interactions',
    '{
        "sos_type": {"type": "select", "label_english": "SOS Type", "label_marathi": "SOS प्रकार", "required": true, "options": ["Emergency", "Consultant Call", "Safety Issue", "Equipment Failure", "Other"]},
        "location": {"type": "text", "label_english": "Location", "label_marathi": "स्थान", "required": true},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true},
        "action_taken": {"type": "text", "label_english": "Action Taken", "label_marathi": "केलेली कारवाई", "required": true},
        "resolved": {"type": "select", "label_english": "Resolved", "label_marathi": "निराकरण झाले", "required": true, "options": ["Yes", "No", "In Progress"]}
    }',
    6,
    true
),
(
    'Site Visits',
    'साईट व्हिजिट टीम',
    'Team site visit records',
    '{
        "site_name": {"type": "text", "label_english": "Site Name", "label_marathi": "साईटचे नाव", "required": true},
        "visit_date": {"type": "date", "label_english": "Visit Date", "label_marathi": "भेटीची तारीख", "required": true},
        "team_members": {"type": "text", "label_english": "Team Members", "label_marathi": "टीम सदस्य", "required": true},
        "purpose": {"type": "text", "label_english": "Purpose", "label_marathi": "उद्देश", "required": true},
        "findings": {"type": "text", "label_english": "Findings", "label_marathi": "निष्कर्ष", "required": false}
    }',
    7,
    true
),
(
    'Travel Records',
    'ट्रेन रिकॉर्ड जाणे/येणे',
    'Travel and transportation logs',
    '{
        "travel_type": {"type": "select", "label_english": "Travel Type", "label_marathi": "प्रवास प्रकार", "required": true, "options": ["Outgoing", "Incoming", "Round Trip"]},
        "from_location": {"type": "text", "label_english": "From", "label_marathi": "कुठून", "required": true},
        "to_location": {"type": "text", "label_english": "To", "label_marathi": "कुठे", "required": true},
        "traveler_name": {"type": "text", "label_english": "Traveler Name", "label_marathi": "प्रवाशाचे नाव", "required": true},
        "purpose": {"type": "text", "label_english": "Purpose", "label_marathi": "उद्देश", "required": false}
    }',
    8,
    true
),
(
    'Customer Communication',
    'कस्टमर बोलणे',
    'New and existing customer interactions',
    '{
        "customer_name": {"type": "text", "label_english": "Customer Name", "label_marathi": "ग्राहकाचे नाव", "required": true},
        "customer_type": {"type": "select", "label_english": "Customer Type", "label_marathi": "ग्राहक प्रकार", "required": true, "options": ["New", "Existing", "Potential"]},
        "communication_type": {"type": "select", "label_english": "Communication Type", "label_marathi": "संवाद प्रकार", "required": true, "options": ["Call", "Meeting", "Email", "WhatsApp", "Other"]},
        "summary": {"type": "text", "label_english": "Summary", "label_marathi": "सारांश", "required": true},
        "follow_up_required": {"type": "select", "label_english": "Follow Up Required", "label_marathi": "फॉलो अप आवश्यक", "required": false, "options": ["Yes", "No"]}
    }',
    9,
    true
),
(
    'Yesterday''s Remaining Calls',
    'काल चे राहिलेले कॉल',
    'Follow-up calls pending from previous day',
    '{
        "contact_name": {"type": "text", "label_english": "Contact Name", "label_marathi": "संपर्काचे नाव", "required": true},
        "phone_number": {"type": "text", "label_english": "Phone Number", "label_marathi": "फोन नंबर", "required": false},
        "reason": {"type": "text", "label_english": "Reason for Call", "label_marathi": "कॉलचे कारण", "required": true},
        "status": {"type": "select", "label_english": "Status", "label_marathi": "स्थिती", "required": true, "options": ["Completed", "No Answer", "Busy", "Rescheduled", "Pending"]},
        "notes": {"type": "text", "label_english": "Notes", "label_marathi": "नोट्स", "required": false}
    }',
    10,
    true
),
(
    'Today''s Remaining Calls',
    'आज चे राहिलेले कॉल',
    'Calls pending for today that need follow-up',
    '{
        "contact_name": {"type": "text", "label_english": "Contact Name", "label_marathi": "संपर्काचे नाव", "required": true},
        "phone_number": {"type": "text", "label_english": "Phone Number", "label_marathi": "फोन नंबर", "required": false},
        "reason": {"type": "text", "label_english": "Reason for Call", "label_marathi": "कॉलचे कारण", "required": true},
        "priority": {"type": "select", "label_english": "Priority", "label_marathi": "प्राधान्य", "required": true, "options": ["High", "Medium", "Low"]},
        "notes": {"type": "text", "label_english": "Notes", "label_marathi": "नोट्स", "required": false}
    }',
    11,
    true
);

-- Insert default admin user (password: admin123 - change in production!)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (name, phone, email, password_hash, role, preferred_language, is_active)
VALUES (
    'System Admin',
    '9999999999',
    'admin@gims.gov.in',
    '$2a$10$97N6.zTU8dgICAefrVYLueDLCXfAx955FeXYKiPJ77JdMrdoEVsAi',
    'admin',
    'english',
    true
) ON CONFLICT (phone) DO NOTHING;

-- Verify seed data
SELECT 'Categories inserted: ' || COUNT(*) FROM categories;
SELECT 'Users count: ' || COUNT(*) FROM users;
