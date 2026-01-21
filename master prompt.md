# GIMS Task Management System - Master Project Prompt

## What We're Building

A WhatsApp-based AI-powered task management system for GIMS Pvt Ltd (facilities management company) that allows 4 supervisors to register daily maintenance tasks using voice or text messages in Marathi, Hindi, or English. The system automatically understands, categorizes, and organizes tasks with zero manual data entry.

---

## System Overview

**Problem:**
- Supervisors currently use paper registers to track daily maintenance activities
- Time-consuming manual writing and phone calls for updates
- Language barriers (supervisors prefer Marathi/Hindi but need to write in English)
- No real-time visibility for management
- Lost or damaged paper records
- Hours spent compiling daily reports manually

**Solution:**
- Supervisors send WhatsApp messages (voice or text) in their language
- AI automatically understands and classifies tasks into correct category
- Real-time dashboard for management
- Automated daily/weekly/monthly reports
- Complete digital audit trail

---

## Technical Architecture

### Tech Stack
- **Backend:** Node.js, Express.js, PostgreSQL, Redis
- **Frontend:** React.js, Tailwind CSS
- **AI Engine:** Google Gemini 2.5 Flash (speech-to-text + classification)
- **Messaging:** WhatsApp Cloud API (Meta)
- **Deployment:** Docker containers on client's PC server

### How It Works

```
1. Supervisor sends WhatsApp message
   └─> Voice: "आज पुणे साईट ला AC तपासणी करायची आहे"
   └─> Text: "Site visit Mumbai for electrical check"

2. System receives via WhatsApp webhook
   └─> Stores raw message
   └─> If voice: downloads audio file

3. Gemini AI processes message
   └─> Converts voice to text (if needed)
   └─> Detects language (Marathi/Hindi/English/Mixed)
   └─> Extracts information:
       - Task description
       - Location
       - Person names
       - Date/time
       - Priority level
   └─> Classifies into 1 of 11 categories

4. System validates data
   └─> If complete: saves to database
   └─> If missing info: asks clarifying question in user's language

5. Confirmation sent via WhatsApp
   └─> "✅ नोंद पूर्ण झाली! साईट व्हिज़िट टीम - Pune Site AC तपासणी"

6. Real-time dashboard updates
   └─> Management sees task immediately
   └─> Can search, filter, track progress

7. Automated reports generated
   └─> Daily PDF/Excel reports
   └─> Category-wise statistics
   └─> Completion rates
```

---

## 11 Task Categories (Auto-Classification)

The AI automatically classifies tasks into these categories:

1. **Work Description** (कामाचे सविस्तर वर्णन)
   - Detailed maintenance work descriptions

2. **Site Updates** (साईट वरुन आपडेट घेणे)
   - Updates received from various sites

3. **Supervisor Watch** (सुपरवायझर/टेलिकॉलर वॉच)
   - Supervisor and telecaller activity tracking

4. **Worker Updates** (करस्तगण साईट आपडेट)
   - Updates about workers at sites

5. **Email Responses** (ई-मेल रिस्पाव)
   - Email correspondence and responses

6. **SOS/Consultant** (सल्लागार व घेर सेफिंग SOS)
   - Emergency situations and consultant interactions

7. **Site Visits** (साईट व्हिज़िट टीम)
   - Team site visit records

8. **Travel Records** (रेन रिकॉर्ड जाणे/येणे)
   - Travel and transportation logs

9. **Customer Communication** (कस्टमर बोलणे)
   - New and existing customer interactions

10. **Yesterday's Remaining Calls** (काल चे राहिलेले कॉल)
    - Follow-up calls pending from previous day

11. **Today's Remaining Calls** (आज चे राहिलेले कॉल)
    - Calls pending for today that need follow-up

---

## Key Features

### For Supervisors
- ✅ Send voice messages in Marathi/Hindi
- ✅ Send text messages in any language
- ✅ Get instant confirmation in their language
- ✅ No forms to fill, no apps to download
- ✅ Works on basic phones via WhatsApp
- ✅ Receive automated reminders for pending tasks

### For Management
- ✅ Real-time dashboard showing all activities
- ✅ View by category, date, person, location
- ✅ Search functionality across all tasks
- ✅ Listen to original voice recordings
- ✅ Automated daily/weekly/monthly reports (PDF/Excel)
- ✅ Analytics (completion rates, trends, bottlenecks)
- ✅ No more phone calls chasing updates

### System Intelligence
- ✅ Multi-language support (Marathi/Hindi/English + mixed)
- ✅ Automatic speech-to-text conversion
- ✅ Smart entity extraction (location, person, date, priority)
- ✅ Context-aware clarifying questions
- ✅ 11-category automatic classification
- ✅ Error handling and retry mechanisms

---

## Database Schema

### Core Tables

**users**
- user_id (UUID)
- name, phone, email
- role (admin, supervisor)
- preferred_language
- is_active

**task_registry**
- registry_id (UUID)
- category_id (1-11)
- registered_by (user_id)
- registration_date, registration_time
- task_data (JSONB - flexible data per category)
- input_mode (voice, text)
- input_language
- original_input
- transcription (for voice)
- status (pending, completed)
- attachments

**voice_messages**
- voice_id (UUID)
- registry_id
- audio_url (local file path)
- duration_seconds
- detected_language
- transcription
- confidence_score

**categories**
- category_id (1-11)
- name_marathi
- name_english
- field_templates (JSONB)

**reminders**
- reminder_id (UUID)
- user_id
- registry_id
- reminder_type (morning, eod, overdue)
- scheduled_time
- is_sent

---

## API Endpoints

### WhatsApp Webhook
- `POST /api/webhook/whatsapp` - Receive messages
- `GET /api/webhook/whatsapp` - Webhook verification

### Task Management
- `POST /api/tasks/process` - Process message with Gemini
- `POST /api/tasks/register` - Save task to database
- `GET /api/tasks/registry/:date` - Get tasks by date
- `GET /api/tasks/category/:category_id` - Get tasks by category
- `GET /api/tasks/search?q=keyword` - Search tasks

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/tasks` - Filtered task list
- `GET /api/voice/:voice_id/playback` - Audio playback URL

### Reports
- `GET /api/reports/daily/:date` - Generate daily report
- `GET /api/reports/weekly/:week` - Generate weekly report
- `GET /api/reports/monthly/:month` - Generate monthly report
- `POST /api/reports/custom` - Custom date range report

### Reminders
- `POST /api/reminders/schedule` - Schedule reminder
- `GET /api/reminders/pending` - Get pending reminders

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

---

## Environment Variables

```bash
# WhatsApp
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_access_token
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gims

# Redis
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=development
PORT=3000
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# File Storage
UPLOAD_DIR=/var/gims/uploads
MAX_FILE_SIZE=10485760

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/gims/app.log
```

---

## Gemini AI Prompt Template

This is how we instruct Gemini to process messages:

```
You are a multilingual task registry assistant for GIMS maintenance company.
Analyze messages in Marathi, Hindi, English, or mixed languages.

Extract task information and classify into 11 categories:
1. कामाचे सविस्तर वर्णन (Work Description)
2. साईट आपडेट (Site Update)
3. सुपरवायझर वॉच (Supervisor Watch)
4. करस्तगण साईट आपडेट (Worker Update)
5. ई-मेल रिस्पाव (Email Response)
6. सल्लागार/SOS (Consultant/Safety)
7. साईट व्हिज़िट टीम (Site Visit)
8. रेन रिकॉर्ड (Travel Record)
9. कस्टमर बोलणे (Customer Communication)
10. काल चे राहिलेले कॉल (Yesterday's Remaining Calls)
11. आज चे राहिलेले कॉल (Today's Remaining Calls)

Return ONLY valid JSON:
{
  "detected_language": "marathi|hindi|english|mixed",
  "category_id": 1-11,
  "category_confidence": 0-1,
  "task_data": {
    "description": "",
    "location": "",
    "person_name": "",
    "priority": "high|medium|low",
    "date": "YYYY-MM-DD",
    "time": "HH:MM"
  },
  "missing_fields": [],
  "confirmation_message_mr": "",
  "confirmation_message_hi": "",
  "confirmation_message_en": ""
}

Current Date: 2026-01-15
User Message: [USER_MESSAGE_HERE]
```

---

## User Flows

### Flow 1: Voice Message Registration (Marathi)

```
1. Supervisor: Sends WhatsApp voice message
   "आज पुणे टेक पार्क ला जाऊन AC ची तपासणी करायची आहे, urgent आहे"

2. System: 
   - Receives webhook
   - Downloads audio
   - Sends to Gemini for transcription
   - Gets text: "आज पुणे टेक पार्क ला जाऊन AC ची तपासणी करायची आहे, urgent आहे"

3. Gemini Processes:
   - Language: Marathi
   - Category: 7 (Site Visit Team)
   - Description: "AC तपासणी"
   - Location: "Pune Tech Park"
   - Date: "2026-01-15"
   - Priority: "urgent"

4. System Saves:
   - Creates task_registry entry
   - Links voice_messages record
   - Assigns registry_id: RT1234

5. System Responds:
   "✅ समजले! 
   📋 काम: AC तपासणी
   📍 ठिकाण: Pune Tech Park
   ⚡ प्राथमिकता: Urgent
   🗂️ कॅटेगरी: साईट व्हिज़िट टीम
   नोंद पूर्ण झाली! #RT1234"

6. Dashboard Updates:
   - Real-time WebSocket push
   - Task appears under "Site Visits" category
   - Management sees it instantly
```

### Flow 2: Text Message with Missing Info (Hindi)

```
1. Supervisor: Sends text
   "Client ke saath meeting hai"

2. Gemini Processes:
   - Language: Hindi
   - Category: 9 (Customer Communication)
   - Missing: client_name, date, time, location

3. System Asks:
   "मीटिंग के बारे में थोड़ी और जानकारी चाहिए:
   1️⃣ Client का नाम?
   2️⃣ कब है meeting? (date/time)
   3️⃣ कहाँ है? (location)"

4. Supervisor: Responds
   "ABC Corp, aaj 3 PM, Mumbai office"

5. Gemini Re-processes:
   - Complete information now
   - Saves to database

6. System Confirms:
   "✅ रजिस्टर हो गया!
   👤 Client: ABC Corp
   📅 Date: Today 3 PM
   📍 Location: Mumbai Office
   📂 Category: Customer Communication
   Entry #RT1235"
```

### Flow 3: Automated Reminder

```
Morning 8:00 AM:
System sends to all supervisors:
"🌅 सुप्रभात!
आज के pending tasks:
1. Pune site visit (urgent)
2. ABC Corp meeting (3 PM)
3. Email response - Invoice #123

Update के लिए message भेजें!"

Evening 6:00 PM:
"⏰ Day ending reminder!
आज कितने tasks complete हुए?
Pending tasks की update दें।

Reply with status update."
```

---

## Project Deliverables

### Code Deliverables
1. **Backend Service**
   - Node.js/Express API
   - PostgreSQL database with migrations
   - Gemini AI integration
   - WhatsApp webhook handlers
   - Queue processing (Bull + Redis)
   - Cron jobs for reminders
   - Unit and integration tests

2. **Frontend Dashboard**
   - React.js web application
   - Authentication system
   - Category-wise task views
   - Search and filters
   - Voice playback
   - Real-time updates (WebSocket)
   - Report generation UI

3. **Docker Configuration**
   - Multi-container setup
   - Environment configuration
   - Volume mounts for data persistence
   - Health checks

### Documentation Deliverables
1. User Manual (Marathi & English)
2. Admin Guide
3. Technical Documentation
4. API Documentation
5. Deployment Guide
6. Training Materials

---

## Success Criteria

The system is successful when:
- ✅ Supervisors can register tasks via WhatsApp in <30 seconds
- ✅ Voice transcription accuracy >90% for Marathi/Hindi
- ✅ Automatic classification accuracy >85%
- ✅ Dashboard loads in <2 seconds
- ✅ Reports generate in <5 seconds
- ✅ System handles 4 concurrent users smoothly
- ✅ Zero data loss
- ✅ 99% uptime
- ✅ Reminders sent on schedule
- ✅ Management saves 2-3 hours daily

---

## Cost Structure

### Development Cost
**INR 50,000 - 65,000** (One-time)
- Complete system development
- Testing & QA
- Deployment support
- Training & documentation

### Monthly Recurring Cost
**INR 420 - 850/month** (~INR 500 average)
- WhatsApp Cloud API: INR 400-800/month
- Google Gemini AI: INR 20-50/month
- Server: INR 0 (using client's PC)
- Database: INR 0 (PostgreSQL self-hosted)
- Storage: INR 0 (local disk)

### Annual Cost
**INR 5,000 - 10,000/year** for API usage

---

## Technical Constraints

### Must Have
- TypeScript for all code
- Unit test coverage >80%
- API response time <500ms
- Voice file processing <3 seconds
- Mobile-responsive dashboard
- Docker containerization

### Must Not Have
- No vendor lock-in (portable architecture)
- No hardcoded credentials
- No synchronous blocking operations
- No unhandled promise rejections
- No SQL injection vulnerabilities

---

## Implementation Order

1. **Backend Foundation** (Database + Express API)
2. **WhatsApp Integration** (Webhook + Message handling)
3. **Gemini AI Integration** (Speech-to-text + Classification)
4. **Complete Flow** (End-to-end message processing)
5. **Frontend Dashboard** (React UI)
6. **Reports** (PDF/Excel generation)
7. **Reminders** (Cron jobs)
8. **Docker** (Containerization)
9. **Testing** (Comprehensive testing)
10. **Deployment** (Production setup)
11. **Training** (User training & handoff)

---

## Current Status

**Phase:** Planning & Setup
**Next Action:** Start Claude Code and begin with project initialization

---

This is the complete picture of what we're building. Use this as reference throughout development.