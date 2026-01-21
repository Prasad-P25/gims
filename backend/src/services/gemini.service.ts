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
  private model: GenerativeModel;
  private visionModel: GenerativeModel;

  constructor() {
    this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.visionModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Transcribe audio to text (supports Marathi, Hindi, English)
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
    try {
      const base64Audio = audioBuffer.toString('base64');

      const prompt = `You are an expert transcriber for Indian languages. Transcribe the following audio accurately.

The audio may be in Marathi, Hindi, or English.

Instructions:
1. Transcribe the audio word-for-word
2. Detect the primary language used
3. If mixed languages, note the primary one
4. Provide a confidence score (0-1) for your transcription

Respond in JSON format:
{
  "text": "transcribed text here",
  "language": "marathi|hindi|english",
  "confidence": 0.95
}`;

      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio,
          },
        },
      ]);

      const response = result.response.text();
      const parsed = this.parseJsonResponse<TranscriptionResult>(response);

      logger.info('Audio transcribed', {
        language: parsed.language,
        confidence: parsed.confidence,
        textLength: parsed.text.length,
      });

      return parsed;
    } catch (error) {
      logger.error('Failed to transcribe audio', { error });
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

      const prompt = `You are an AI assistant for a Government Information Management System (GIMS) in Maharashtra, India.

Analyze the following user input (in ${language}) and extract task information for government work registration.

User Input: "${text}"

Available Categories:
${categoryList}

Instructions:
1. Identify which category this task belongs to (or null if unclear)
2. Extract all relevant details mentioned (names, locations, amounts, dates, etc.)
3. Create a brief summary in the same language as input
4. Assess priority based on urgency indicators (emergency = high, regular = medium, low-priority = low)
5. Provide confidence score for your extraction

Common Marathi urgency indicators:
- High: तातडीने, लगेच, आपत्कालीन, महत्त्वाचे
- Medium: शक्य तितक्या लवकर, साधारण
- Low: वेळ मिळेल तेव्हा, काही घाई नाही

Respond in JSON format:
{
  "category_id": <number or null>,
  "task_data": {
    "location": "extracted location if any",
    "person_name": "extracted name if any",
    "issue_description": "main issue/request",
    "additional_details": "any other details"
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
