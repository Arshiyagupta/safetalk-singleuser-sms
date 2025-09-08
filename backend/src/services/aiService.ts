import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { AIProcessingResult } from '../shared/types';

class AIService {
  private openai: OpenAI | null = null;
  private model: string;
  private maxTokens: number;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '500');

    if (!apiKey) {
      logger.warn('OpenAI API key not configured. AI service will use mock responses.');
    } else {
      this.openai = new OpenAI({ apiKey });
      logger.info('OpenAI client initialized');
    }
  }

  async processMessage(originalMessage: string): Promise<AIProcessingResult> {
    try {
      // If no OpenAI key, return mock response
      if (!this.openai) {
        return this.getMockResponse(originalMessage);
      }

      // Step 1: Filter the message
      const filteredMessage = await this.filterMessage(originalMessage);
      
      // Step 2: Classify message type
      const messageType = await this.classifyMessage(filteredMessage);
      
      // Step 3: Generate response options
      const responseOptions = await this.generateResponseOptions(filteredMessage, messageType);

      return {
        filteredMessage,
        messageType,
        responseOptions,
        confidence: 0.85, // Mock confidence score
        reasoning: `Processed message of type: ${messageType}`
      };

    } catch (error) {
      logger.error('Error processing message with AI:', error);
      
      // Fallback to basic filtering
      return this.getFallbackResponse(originalMessage);
    }
  }

  private async filterMessage(message: string): Promise<string> {
    const prompt = `
You are a co-parenting communication filter. Your job is to:
1. Remove all personal attacks, insults, accusations, and emotional language
2. Keep only factual, child-related information
3. Convert hostile tone to neutral, professional language
4. Preserve essential details about children, schedules, or logistics
5. If the message contains no useful information, return a neutral summary

Rules:
- Remove "you" statements that are accusatory
- Convert emotional language to neutral facts
- Keep dates, times, locations, and child-related details
- If message is purely hostile with no facts, return "Message regarding co-parenting communication"

Original message: "${message}"

Filtered message:`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.maxTokens,
        temperature: 0.3, // Lower temperature for consistent filtering
      });

      const filtered = response.choices[0]?.message?.content?.trim();
      
      if (!filtered || filtered.length < 5) {
        return "Message regarding co-parenting communication";
      }

      return filtered;
    } catch (error) {
      logger.error('Error filtering message:', error);
      return this.basicFilter(message);
    }
  }

  private async classifyMessage(message: string): Promise<'informational' | 'decision_making'> {
    const prompt = `
Classify this co-parenting message as either:
- "informational": Simple updates, notifications, or statements that don't require decisions
- "decision_making": Messages that present problems needing solutions or require choices

Examples:
- "Soccer practice is at 3pm tomorrow" = informational
- "The kids need new winter coats" = decision_making  
- "I'll pick them up at 6pm" = informational
- "We need to discuss the vacation schedule" = decision_making

Message: "${message}"

Classification:`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.1,
      });

      const classification = response.choices[0]?.message?.content?.trim().toLowerCase();
      
      return classification?.includes('decision') ? 'decision_making' : 'informational';
    } catch (error) {
      logger.error('Error classifying message:', error);
      return this.basicClassification(message);
    }
  }

  private async generateResponseOptions(message: string, type: 'informational' | 'decision_making'): Promise<[string, string, string]> {
    let prompt: string;

    if (type === 'informational') {
      prompt = `
Generate 3 appropriate acknowledgment responses to this informational co-parenting message.
Responses should be:
- Brief and professional
- Acknowledge the information
- Maintain neutral, cooperative tone
- Suitable for co-parent communication

Message: "${message}"

Generate exactly 3 response options:
1.
2.
3.`;
    } else {
      prompt = `
Generate 3 solution-focused responses to this co-parenting message that requires decision-making.
Responses should:
- Offer constructive solutions
- Be collaborative, not confrontational  
- Focus on the children's needs
- Provide different approaches to the problem

Message: "${message}"

Generate exactly 3 response options:
1.
2.
3.`;
    }

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.maxTokens,
        temperature: 0.7, // Higher temperature for creative responses
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        return this.getDefaultResponses(type);
      }

      // Parse the numbered responses
      const lines = content.split('\n').filter(line => line.trim());
      const responses: string[] = [];

      for (const line of lines) {
        const match = line.match(/^\d+\.?\s*(.+)/);
        if (match && match[1]) {
          responses.push(match[1].trim());
        }
      }

      // Ensure we have exactly 3 responses
      while (responses.length < 3) {
        const defaults = this.getDefaultResponses(type);
        responses.push(defaults[responses.length]);
      }

      return [responses[0], responses[1], responses[2]];
    } catch (error) {
      logger.error('Error generating response options:', error);
      return this.getDefaultResponses(type);
    }
  }

  private basicFilter(message: string): string {
    // Simple filtering without AI
    let filtered = message;
    
    // Remove common hostile words
    const hostileWords = ['stupid', 'idiot', 'hate', 'terrible', 'awful', 'worst', 'useless'];
    hostileWords.forEach(word => {
      const regex = new RegExp(word, 'gi');
      filtered = filtered.replace(regex, '[removed]');
    });

    // Remove excessive punctuation
    filtered = filtered.replace(/[!]{2,}/g, '.');
    filtered = filtered.replace(/[?]{2,}/g, '?');

    return filtered.trim() || "Message regarding co-parenting communication";
  }

  private basicClassification(message: string): 'informational' | 'decision_making' {
    const decisionKeywords = ['need', 'should', 'could', 'decide', 'discuss', 'plan', 'schedule', 'problem', 'issue'];
    const lowerMessage = message.toLowerCase();
    
    return decisionKeywords.some(keyword => lowerMessage.includes(keyword)) 
      ? 'decision_making' 
      : 'informational';
  }

  private getDefaultResponses(type: 'informational' | 'decision_making'): [string, string, string] {
    if (type === 'informational') {
      return [
        "Thank you for letting me know.",
        "I understand.",
        "Got it, thanks."
      ];
    } else {
      return [
        "Let me think about this and get back to you.",
        "I can help with that. What works best for you?",
        "We can discuss this further to find a solution."
      ];
    }
  }

  private getMockResponse(originalMessage: string): AIProcessingResult {
    const filtered = this.basicFilter(originalMessage);
    const messageType = this.basicClassification(originalMessage);
    const responseOptions = this.getDefaultResponses(messageType);

    return {
      filteredMessage: filtered,
      messageType,
      responseOptions,
      confidence: 0.70,
      reasoning: 'Mock AI processing (OpenAI key not configured)'
    };
  }

  private getFallbackResponse(originalMessage: string): AIProcessingResult {
    return {
      filteredMessage: this.basicFilter(originalMessage),
      messageType: 'informational',
      responseOptions: [
        "Thank you for your message.",
        "I understand.",
        "I'll get back to you soon."
      ],
      confidence: 0.50,
      reasoning: 'Fallback processing due to AI service error'
    };
  }

  // Test AI service connectivity
  async testConnection(): Promise<boolean> {
    try {
      if (!this.openai) {
        logger.info('AI service test: Using mock mode (no API key)');
        return true;
      }

      await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Test message' }],
        max_tokens: 10,
      });

      logger.info('AI service test: Connected successfully');
      return true;
    } catch (error) {
      logger.error('AI service test failed:', error);
      return false;
    }
  }
}

export default new AIService();