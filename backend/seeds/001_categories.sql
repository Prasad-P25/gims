-- GIMS Task Registry System - Category Seed Data
-- Seed: 001_categories.sql
-- Description: Insert 11 government work categories with Marathi and English names

-- Clear existing categories (if re-running seed)
TRUNCATE TABLE categories RESTART IDENTITY CASCADE;

-- Insert the 11 government work categories
INSERT INTO categories (name_english, name_marathi, description, field_template, display_order, is_active) VALUES
(
    'Revenue and Land Records',
    'महसूल आणि जमीन अभिलेख',
    'Land ownership records, 7/12 extracts, property disputes, land mutations',
    '{
        "land_survey_number": {"type": "text", "label_english": "Survey Number", "label_marathi": "सर्वे नंबर", "required": true},
        "village_name": {"type": "text", "label_english": "Village Name", "label_marathi": "गावाचे नाव", "required": true},
        "taluka": {"type": "text", "label_english": "Taluka", "label_marathi": "तालुका", "required": true},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["7/12 Extract", "Property Mutation", "Land Dispute", "Boundary Issue", "Other"]},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    1,
    true
),
(
    'Agriculture and Farmers',
    'शेती आणि शेतकरी',
    'Crop insurance, subsidies, PM-KISAN, agricultural loans, farming issues',
    '{
        "farmer_name": {"type": "text", "label_english": "Farmer Name", "label_marathi": "शेतकऱ्याचे नाव", "required": true},
        "aadhar_number": {"type": "text", "label_english": "Aadhar Number", "label_marathi": "आधार क्रमांक", "required": false},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["PM-KISAN", "Crop Insurance", "Subsidy", "Agricultural Loan", "Seeds/Fertilizer", "Other"]},
        "crop_type": {"type": "text", "label_english": "Crop Type", "label_marathi": "पिकाचा प्रकार", "required": false},
        "land_area_acres": {"type": "number", "label_english": "Land Area (Acres)", "label_marathi": "जमीन क्षेत्र (एकर)", "required": false},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    2,
    true
),
(
    'Water Supply and Sanitation',
    'पाणी पुरवठा आणि स्वच्छता',
    'Drinking water issues, pipeline complaints, Jal Jeevan Mission, sanitation',
    '{
        "village_name": {"type": "text", "label_english": "Village/Ward Name", "label_marathi": "गाव/वॉर्डचे नाव", "required": true},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["No Water Supply", "Low Pressure", "Pipeline Leak", "Water Quality", "New Connection", "Jal Jeevan Mission", "Sanitation", "Other"]},
        "affected_households": {"type": "number", "label_english": "Affected Households", "label_marathi": "प्रभावित कुटुंबे", "required": false},
        "duration_days": {"type": "number", "label_english": "Issue Duration (Days)", "label_marathi": "समस्या कालावधी (दिवस)", "required": false},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    3,
    true
),
(
    'Roads and Infrastructure',
    'रस्ते आणि पायाभूत सुविधा',
    'Road repairs, potholes, bridges, street lights, public infrastructure',
    '{
        "location": {"type": "text", "label_english": "Location", "label_marathi": "स्थान", "required": true},
        "road_type": {"type": "select", "label_english": "Road Type", "label_marathi": "रस्त्याचा प्रकार", "required": true, "options": ["National Highway", "State Highway", "District Road", "Village Road", "City Road", "Other"]},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["Potholes", "Road Damage", "Bridge Repair", "Street Light", "Drainage", "Footpath", "Other"]},
        "estimated_length_km": {"type": "number", "label_english": "Estimated Length (KM)", "label_marathi": "अंदाजे लांबी (किमी)", "required": false},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    4,
    true
),
(
    'Health and Medical',
    'आरोग्य आणि वैद्यकीय',
    'PHC issues, medicine availability, ambulance, health camps, Ayushman Bharat',
    '{
        "facility_name": {"type": "text", "label_english": "Health Facility Name", "label_marathi": "आरोग्य सुविधेचे नाव", "required": false},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["Medicine Shortage", "Doctor Unavailable", "Ambulance Issue", "PHC/CHC Problem", "Ayushman Bharat", "Health Camp Request", "Other"]},
        "patient_name": {"type": "text", "label_english": "Patient Name", "label_marathi": "रुग्णाचे नाव", "required": false},
        "urgency": {"type": "select", "label_english": "Urgency", "label_marathi": "तातडी", "required": true, "options": ["Emergency", "Urgent", "Normal"]},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    5,
    true
),
(
    'Education',
    'शिक्षण',
    'School infrastructure, teacher shortage, scholarships, mid-day meals',
    '{
        "school_name": {"type": "text", "label_english": "School Name", "label_marathi": "शाळेचे नाव", "required": true},
        "school_type": {"type": "select", "label_english": "School Type", "label_marathi": "शाळेचा प्रकार", "required": true, "options": ["Primary", "Secondary", "Higher Secondary", "College", "Anganwadi", "Other"]},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["Teacher Shortage", "Infrastructure", "Mid-Day Meal", "Scholarship", "Books/Supplies", "Transport", "Other"]},
        "affected_students": {"type": "number", "label_english": "Affected Students", "label_marathi": "प्रभावित विद्यार्थी", "required": false},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    6,
    true
),
(
    'Social Welfare',
    'समाज कल्याण',
    'Pension schemes, ration cards, caste certificates, welfare schemes',
    '{
        "beneficiary_name": {"type": "text", "label_english": "Beneficiary Name", "label_marathi": "लाभार्थीचे नाव", "required": true},
        "scheme_type": {"type": "select", "label_english": "Scheme Type", "label_marathi": "योजनेचा प्रकार", "required": true, "options": ["Old Age Pension", "Widow Pension", "Disability Pension", "Ration Card", "Caste Certificate", "Income Certificate", "BPL Card", "Housing (PMAY)", "Other"]},
        "application_number": {"type": "text", "label_english": "Application Number", "label_marathi": "अर्ज क्रमांक", "required": false},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["New Application", "Pending Application", "Payment Issue", "Document Issue", "Rejection Appeal", "Other"]},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    7,
    true
),
(
    'Law and Order',
    'कायदा आणि सुव्यवस्था',
    'Police complaints, safety issues, crime reporting, peace committee',
    '{
        "location": {"type": "text", "label_english": "Location", "label_marathi": "स्थान", "required": true},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["Safety Concern", "Dispute", "Theft/Crime", "Traffic Issue", "Illegal Activity", "Peace Committee", "Police Station Issue", "Other"]},
        "police_station": {"type": "text", "label_english": "Police Station", "label_marathi": "पोलीस स्टेशन", "required": false},
        "complaint_number": {"type": "text", "label_english": "Complaint Number", "label_marathi": "तक्रार क्रमांक", "required": false},
        "urgency": {"type": "select", "label_english": "Urgency", "label_marathi": "तातडी", "required": true, "options": ["Emergency", "Urgent", "Normal"]},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    8,
    true
),
(
    'Electricity',
    'वीज',
    'Power outages, new connections, billing issues, transformer problems',
    '{
        "consumer_number": {"type": "text", "label_english": "Consumer Number", "label_marathi": "ग्राहक क्रमांक", "required": false},
        "location": {"type": "text", "label_english": "Location", "label_marathi": "स्थान", "required": true},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["Power Outage", "Frequent Cuts", "Low Voltage", "Transformer Issue", "New Connection", "Billing Issue", "Meter Problem", "Wire/Pole Damage", "Other"]},
        "outage_duration_hours": {"type": "number", "label_english": "Outage Duration (Hours)", "label_marathi": "वीज खंडित कालावधी (तास)", "required": false},
        "affected_area": {"type": "text", "label_english": "Affected Area", "label_marathi": "प्रभावित क्षेत्र", "required": false},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    9,
    true
),
(
    'Employment and Skill Development',
    'रोजगार आणि कौशल्य विकास',
    'MNREGA, skill training, employment exchange, job fairs',
    '{
        "beneficiary_name": {"type": "text", "label_english": "Beneficiary Name", "label_marathi": "लाभार्थीचे नाव", "required": true},
        "issue_type": {"type": "select", "label_english": "Issue Type", "label_marathi": "समस्येचा प्रकार", "required": true, "options": ["MNREGA Job Card", "MNREGA Payment", "Skill Training", "Employment Exchange", "Job Fair", "Self Employment Loan", "Other"]},
        "job_card_number": {"type": "text", "label_english": "Job Card Number", "label_marathi": "जॉब कार्ड क्रमांक", "required": false},
        "days_worked": {"type": "number", "label_english": "Days Worked", "label_marathi": "काम केलेले दिवस", "required": false},
        "pending_amount": {"type": "number", "label_english": "Pending Amount (Rs)", "label_marathi": "प्रलंबित रक्कम (रु)", "required": false},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
    }',
    10,
    true
),
(
    'General/Other',
    'सामान्य/इतर',
    'General grievances, suggestions, feedback, miscellaneous issues',
    '{
        "subject": {"type": "text", "label_english": "Subject", "label_marathi": "विषय", "required": true},
        "related_department": {"type": "text", "label_english": "Related Department", "label_marathi": "संबंधित विभाग", "required": false},
        "location": {"type": "text", "label_english": "Location", "label_marathi": "स्थान", "required": false},
        "description": {"type": "text", "label_english": "Description", "label_marathi": "वर्णन", "required": true}
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
    '$2a$10$rQnM1rBxl7z.zVn8YH1Rn.KPrX5E5H5H5H5H5H5H5H5H5H5H5H5H5H',  -- Replace with actual bcrypt hash
    'admin',
    'english',
    true
);

-- Verify seed data
SELECT 'Categories inserted: ' || COUNT(*) FROM categories;
SELECT 'Users inserted: ' || COUNT(*) FROM users;
