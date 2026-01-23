import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { Category } from '../types';

interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
}

interface ExtractedTaskData {
  category_id: number | null;
  task_data: Record<string, unknown>;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
}

interface CategoryMatch {
  category_id: number;
  confidence: number;
  reasoning: string;
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private genAIVoice: GoogleGenerativeAI;
  private model: GenerativeModel;
  private voiceModel: GenerativeModel;

  constructor() {
    // Primary API for text processing
    this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // Secondary API for voice/audio processing (uses separate key if available)
    const voiceApiKey = env.GEMINI_API_KEY_VOICE || env.GEMINI_API_KEY;
    this.genAIVoice = new GoogleGenerativeAI(voiceApiKey);
    this.voiceModel = this.genAIVoice.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  }

  /**
   * Normalize mime type for Gemini API compatibility
   */
  private normalizeMimeType(mimeType: string): string {
    // Telegram sends various formats, normalize them for Gemini
    const mimeMap: Record<string, string> = {
      'audio/ogg': 'audio/ogg',
      'audio/ogg; codecs=opus': 'audio/ogg',
      'audio/oga': 'audio/ogg',
      'audio/opus': 'audio/ogg',
      'audio/webm': 'audio/webm',
      'audio/webm; codecs=opus': 'audio/webm',
      'audio/mp4': 'audio/mp4',
      'audio/mpeg': 'audio/mpeg',
      'audio/mp3': 'audio/mpeg',
      'audio/wav': 'audio/wav',
      'audio/x-wav': 'audio/wav',
    };

    const normalized = mimeMap[mimeType.toLowerCase()] || mimeType;
    logger.debug('Normalized mime type', { original: mimeType, normalized });
    return normalized;
  }

  /**
   * Transcribe audio to text (supports Marathi, Hindi, English)
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    try {
      logger.info('Starting audio transcription', {
        bufferSize: audioBuffer.length,
        mimeType,
      });

      if (audioBuffer.length < 100) {
        throw new Error('Audio buffer too small - possibly empty or corrupted');
      }

      const base64Audio = audioBuffer.toString('base64');
      const normalizedMimeType = this.normalizeMimeType(mimeType);

      const prompt = `You are an expert transcriber for Indian languages. Transcribe the following audio accurately.

The audio may be in Marathi, Hindi, or English.

Instructions:
1. Transcribe the audio word-for-word
2. Detect the primary language used
3. If mixed languages, note the primary one
4. Provide a confidence score (0-1) for your transcription
5. If you cannot hear any speech or the audio is unclear, set text to empty and confidence to 0

Respond in JSON format:
{
  "text": "transcribed text here",
  "language": "marathi|hindi|english",
  "confidence": 0.95
}`;

      logger.info('Sending audio to Gemini for transcription', {
        base64Length: base64Audio.length,
        normalizedMimeType,
      });

      // Use voice model (separate API key if configured)
      const result = await this.voiceModel.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: normalizedMimeType,
            data: base64Audio,
          },
        },
      ]);

      const response = result.response.text();
      logger.debug('Gemini response', { response: response.substring(0, 200) });

      const parsed = this.parseJsonResponse<TranscriptionResult>(response);

      logger.info('Audio transcribed successfully', {
        language: parsed.language,
        confidence: parsed.confidence,
        textLength: parsed.text.length,
        textPreview: parsed.text.substring(0, 50),
      });

      return parsed;
    } catch (error: any) {
      logger.error('Failed to transcribe audio', {
        error: error.message,
        stack: error.stack,
        mimeType,
        bufferSize: audioBuffer.length,
      });
      throw error;
    }
  }

  /**
   * Extract task information from natural language input
   */
  async extractTaskData(
    text: string,
    categories: Category[],
    language: string = 'marathi'
  ): Promise<ExtractedTaskData> {
    try {
      const categoryList = categories
        .map((c) => `${c.category_id}: ${c.name_english} (${c.name_marathi})`)
        .join('\n');

      // Get today's date for relative date calculations
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const prompt = `You are an AI assistant for a Government Information Management System (GIMS) in Maharashtra, India.

Analyze the following user input (in ${language}) and extract task information for government work registration.

User Input: "${text}"

TODAY'S DATE: ${todayStr}
TOMORROW'S DATE: ${tomorrowStr}

Available Categories:
${categoryList}

Instructions:
1. Identify which category this task belongs to (or null if unclear)
2. Create a clear, concise TITLE (max 50 chars) that describes the task - this is the most important field
3. Create a detailed DESCRIPTION of the task/issue
4. Extract all relevant details mentioned (names, locations, amounts, dates, etc.)
5. Create a brief summary in the same language as input
6. Assess priority based on urgency indicators (emergency = high, regular = medium, low-priority = low)
7. Provide confidence score for your extraction

IMPORTANT DATE EXTRACTION:
- Convert ALL relative dates to YYYY-MM-DD format using today's date (${todayStr})
- Common date phrases to convert:
  - Marathi: आज (today), उद्या (tomorrow), परवा (day after tomorrow), पुढच्या आठवड्यात (next week), या महिन्यात (this month)
  - Hindi: आज (today), कल (tomorrow), परसों (day after tomorrow), अगले हफ्ते (next week)
  - English: today, tomorrow, next week, this week, next month, in 2 days, etc.
- If a specific date is mentioned (e.g., "25 January", "15 तारीख"), convert to YYYY-MM-DD
- If NO date is mentioned, leave due_date empty

IMPORTANT: The "title" field MUST be a short, clear title like:
- "Road repair needed at Main Street"
- "Water supply complaint - Ward 5"
- "Submit monthly report"
- "Electricity pole fallen"

Common Marathi urgency indicators:
- High: तातडीने, लगेच, आपत्कालीन, महत्त्वाचे, urgent, emergency, asap
- Medium: शक्य तितक्या लवकर, साधारण, normal
- Low: वेळ मिळेल तेव्हा, काही घाई नाही, whenever possible

Respond in JSON format:
{
  "category_id": <number or null>,
  "task_data": {
    "title": "SHORT CLEAR TITLE HERE (max 50 chars) - REQUIRED",
    "description": "detailed description of the task/issue",
    "location": "extracted location if any",
    "applicant_name": "extracted person name if any",
    "applicant_phone": "extracted phone number if any",
    "due_date": "YYYY-MM-DD format - convert relative dates like 'tomorrow' to actual date",
    "additional_details": "any other relevant details"
  },
  "summary": "brief summary in original language",
  "priority": "high|medium|low",
  "confidence": 0.85
}`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      const parsed = this.parseJsonResponse<ExtractedTaskData>(response);

      logger.info('Task data extracted', {
        categoryId: parsed.category_id,
        priority: parsed.priority,
        confidence: parsed.confidence,
      });

      return parsed;
    } catch (error) {
      logger.error('Failed to extract task data', { error });
      throw error;
    }
  }

  /**
   * Match user input to the most relevant category
   */
  async matchCategory(
    text: string,
    categories: Category[]
  ): Promise<CategoryMatch> {
    try {
      const categoryDetails = categories.map((c) => ({
        id: c.category_id,
        english: c.name_english,
        marathi: c.name_marathi,
        description: c.description,
      }));

      const prompt = `Analyze the following text and determine which government service category it belongs to.

Text: "${text}"

Categories:
${JSON.stringify(categoryDetails, null, 2)}

Instructions:
1. Consider keywords, context, and intent
2. Match to the most relevant category
3. If no clear match, suggest the closest one
4. Provide reasoning for your choice

Respond in JSON:
{
  "category_id": <number>,
  "confidence": <0-1>,
  "reasoning": "brief explanation"
}`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      return this.parseJsonResponse<CategoryMatch>(response);
    } catch (error) {
      logger.error('Failed to match category', { error });
      throw error;
    }
  }

  /**
   * Generate a response message in Marathi/Hindi based on context
   */
  async generateResponse(
    context: {
      userMessage: string;
      action: 'greeting' | 'confirmation' | 'clarification' | 'error' | 'summary';
      data?: Record<string, unknown>;
    },
    language: 'marathi' | 'hindi' | 'english' = 'marathi'
  ): Promise<string> {
    try {
      const languageInstructions = {
        marathi: 'Respond in Marathi (मराठी). Use Devanagari script.',
        hindi: 'Respond in Hindi (हिंदी). Use Devanagari script.',
        english: 'Respond in English.',
      };

      const actionInstructions = {
        greeting: 'Generate a warm, professional greeting for a government service chatbot.',
        confirmation: 'Generate a confirmation message acknowledging the task has been registered.',
        clarification: 'Ask for clarification about missing or unclear information.',
        error: 'Generate a polite error message explaining the issue.',
        summary: 'Generate a summary of the provided task data.',
      };

      const prompt = `${languageInstructions[language]}
${actionInstructions[context.action]}

User's message: "${context.userMessage}"
${context.data ? `Additional data: ${JSON.stringify(context.data)}` : ''}

Keep the response concise, friendly, and professional. Use simple language.`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      logger.error('Failed to generate response', { error });
      // Return fallback messages
      const fallbacks = {
        marathi: 'क्षमस्व, तांत्रिक अडचण आली आहे. कृपया पुन्हा प्रयत्न करा.',
        hindi: 'क्षमा करें, तकनीकी समस्या आई है। कृपया पुनः प्रयास करें।',
        english: 'Sorry, there was a technical issue. Please try again.',
      };
      return fallbacks[language];
    }
  }

  /**
   * Summarize tasks for daily/evening reports
   */
  async generateTaskSummary(
    tasks: Array<{
      category: string;
      task_data: Record<string, unknown>;
      status: string;
      registration_date: string;
    }>,
    language: 'marathi' | 'hindi' | 'english' = 'marathi'
  ): Promise<string> {
    try {
      const prompt = `Generate a concise summary report of the following government tasks.

Tasks:
${JSON.stringify(tasks, null, 2)}

Language: ${language}

Instructions:
1. Group tasks by category
2. Highlight pending/urgent items
3. Provide counts and key details
4. Keep it brief but informative
5. Use bullet points for clarity

Format as a WhatsApp-friendly message (use emojis sparingly).`;

      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      logger.error('Failed to generate task summary', { error });
      throw error;
    }
  }

  /**
   * Parse JSON from AI response, handling markdown code blocks
   */
  private parseJsonResponse<T>(response: string): T {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch (error) {
      logger.error('Failed to parse JSON response', { response: cleaned, error });
      throw new Error('Invalid JSON response from AI');
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
