import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { AIProcessingResult } from '../types';

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

      // Step 1: Analyze context (WHY they're making this request)
      const context = await this.analyzeMessageContext(originalMessage);

      // Step 2: Filter the message
      const filteredMessage = await this.filterMessage(originalMessage);
      
      // Step 3: Classify message type
      const messageType = await this.classifyMessage(filteredMessage);
      
      // Step 4: Generate response options using enhanced analysis
      const responseOptions = await this.generateResponseOptions(filteredMessage, messageType);

      return {
        filteredMessage,
        messageType,
        responseOptions,
        confidence: 0.85,
        reasoning: `Processed message of type: ${messageType}`,
        context: context // Add context to the result
      };

    } catch (error) {
      logger.error('Error processing message with AI:', error);
      
      // Fallback to basic filtering
      return this.getFallbackResponse(originalMessage);
    }
  }

  private async filterMessage(message: string): Promise<string> {
    const prompt = `
You are a professional co-parenting communication filter trained in conflict resolution and handling difficult personalities, including narcissistic behavior patterns.

Your job is to:
1. Remove all personal attacks, insults, accusations, and emotional manipulation
2. Convert hostile/emotional language to neutral, business-like communication
3. Preserve ONLY factual, child-related information (schedules, health, activities, logistics)
4. Apply the BIFF method: Brief, Informative, Friendly, Firm
5. Focus on children's best interests and well-being

Special handling for high-conflict situations:
- Remove "you always/never" statements and generalizations
- Strip out guilt trips, threats, or emotional manipulation
- Convert demands into neutral information sharing
- Eliminate blame and focus on solutions
- If message contains no child-relevant facts, return "Message regarding co-parenting matters"

Rules for filtering:
- Keep: dates, times, locations, child needs, health info, school matters
- Remove: personal attacks, relationship complaints, financial disputes not directly affecting children
- Convert: emotional outbursts → factual statements
- Neutralize: accusations → observations when relevant to children

Original message: "${message}"

Filtered message (keep brief and professional):`;

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

  private async analyzeMessageContext(message: string): Promise<string | null> {
    const prompt = `
Analyze this co-parenting message to identify WHY the person is making this request. Look for context clues that explain their reasoning.

Common contexts to detect:
- Work obligations ("meeting", "work late", "business trip")
- Travel ("flight", "trip", "vacation", "travel") 
- Medical/Health ("doctor", "appointment", "sick", "hospital", "emergency")
- Family events ("birthday", "graduation", "funeral", "family")
- School activities ("school event", "game", "recital", "conference")
- Scheduling conflicts ("other plans", "conflict", "double booked")
- Emergencies ("emergency", "urgent", "crisis")
- Transportation issues ("car trouble", "no ride")

If you detect context, respond with a brief explanation (under 10 words):
- "he has a work meeting"  
- "there's a family emergency"
- "she has a doctor appointment"
- "he's traveling for work"
- "there's a school event"

If no clear context is found, respond with: "NO_CONTEXT"

Message: "${message}"

Context:`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.1, // Low temperature for consistent detection
      });

      const context = response.choices[0]?.message?.content?.trim();
      
      if (!context || context === 'NO_CONTEXT') {
        return null;
      }

      return context;
    } catch (error) {
      logger.error('Error analyzing message context:', error);
      return this.basicContextDetection(message);
    }
  }

  private basicContextDetection(message: string): string | null {
    const lowerMessage = message.toLowerCase();
    
    // Basic pattern matching for context
    if (lowerMessage.includes('work') || lowerMessage.includes('meeting') || lowerMessage.includes('job')) {
      return 'he has work obligations';
    } else if (lowerMessage.includes('doctor') || lowerMessage.includes('appointment') || lowerMessage.includes('sick')) {
      return 'there\'s a medical appointment';
    } else if (lowerMessage.includes('flight') || lowerMessage.includes('trip') || lowerMessage.includes('travel')) {
      return 'he\'s traveling';
    } else if (lowerMessage.includes('emergency') || lowerMessage.includes('urgent') || lowerMessage.includes('hospital')) {
      return 'there\'s an emergency';
    } else if (lowerMessage.includes('school') || lowerMessage.includes('event') || lowerMessage.includes('game')) {
      return 'there\'s a school event';
    }
    
    return null;
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

  private async analyzeConflict(message: string): Promise<{isExAction: boolean, clientCanFix: boolean, conflictType: string}> {
    const analysisPrompt = `
Analyze this co-parenting conflict message to determine:
1. Is the problem primarily caused by the ex-partner's direct actions? (vs external circumstances)
2. Can the client reasonably influence or fix this issue? (vs outside their control)
3. What type of conflict is this? (scheduling, communication, responsibility, behavioral, logistical)

Message: "${message}"

Respond in this exact format:
EX_ACTION: yes/no
CLIENT_CAN_FIX: yes/no
CONFLICT_TYPE: [type]`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: analysisPrompt }],
        max_tokens: 100,
        temperature: 0.1
      });

      const analysis = response.choices[0]?.message?.content?.trim() || '';
      const isExAction = analysis.includes('EX_ACTION: yes');
      const clientCanFix = analysis.includes('CLIENT_CAN_FIX: yes');
      const conflictMatch = analysis.match(/CONFLICT_TYPE: (.+)/);
      const conflictType = conflictMatch ? conflictMatch[1].trim() : 'general';

      return { isExAction, clientCanFix, conflictType };
    } catch (error) {
      logger.error('Error analyzing conflict:', error);
      return { isExAction: true, clientCanFix: true, conflictType: 'general' };
    }
  }

  private async generateResponseOptions(message: string, type: 'informational' | 'decision_making'): Promise<[string, string, string]> {
    // Analyze the conflict first
    const analysis = await this.analyzeConflict(message);
    
    let prompt: string;

    if (type === 'informational') {
      prompt = `
Generate 3 DISTINCTLY DIFFERENT response approaches to this informational co-parenting message. Based on research in co-parenting with difficult personalities and conflict resolution, create responses using the BIFF method (Brief, Informative, Friendly, Firm).

Each response must use a completely different strategy:

OPTION 1 - ACKNOWLEDGMENT APPROACH:
- Brief acknowledgment without emotional engagement
- Gray rock technique if dealing with high-conflict personality
- Professional and neutral

OPTION 2 - STRUCTURED APPROACH:
- Create systems, schedules, or documentation
- Business-like boundaries
- Focus on processes and organization

OPTION 3 - CHILD-FOCUSED REDIRECT:
- Redirect conversation to children's needs and well-being
- Collaborative language about shared parenting goals
- Solution-oriented for kids' benefit

Message: "${message}"

Generate exactly 3 DIFFERENT response strategies (keep each under 15 words):
1.
2.
3.`;
    } else {
      prompt = `
Generate 3 DISTINCTLY DIFFERENT solution approaches to this co-parenting decision-making message. Use conflict resolution research and strategies for handling difficult co-parents.

Conflict Analysis:
- Ex-partner's action: ${analysis.isExAction ? 'yes' : 'no'}
- Client can influence: ${analysis.clientCanFix ? 'yes' : 'no'}
- Conflict type: ${analysis.conflictType}

Each response must offer a FUNDAMENTALLY DIFFERENT solution strategy:

OPTION 1 - DIRECT ACTION APPROACH:
- Client takes specific action to address the issue
- Personal responsibility and immediate steps
- What the client can directly control or change

OPTION 2 - SYSTEM/STRUCTURE APPROACH:
- Create new processes, schedules, or boundaries
- Use tools, apps, or documentation
- Establish frameworks to prevent future issues

OPTION 3 - COMMUNICATION/BOUNDARY APPROACH:
- Focus on information sharing and expectations
- Professional boundaries and parallel parenting principles
- Child-centered communication strategies

Message: "${message}"

Generate exactly 3 DIFFERENT solution strategies (keep each under 20 words):
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
        "Understood.",
        "I'll make note of this for my records.",
        "This is helpful for coordinating the children's schedule."
      ];
    } else {
      return [
        "I'll handle this on my end and update you.",
        "Let's set up a system to track this going forward.",
        "I'll focus on what works best for the children."
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

  // Filter user's custom responses to ensure they're professional and appropriate
  async filterUserResponse(userResponse: string): Promise<{filteredResponse: string, isAppropriate: boolean}> {
    try {
      if (!this.openai) {
        return {
          filteredResponse: this.basicFilterUserResponse(userResponse),
          isAppropriate: true
        };
      }

      const prompt = `
You are filtering a co-parent's response to ensure it's professional and appropriate for their ex-partner.

Your job is to:
1. Remove ALL profanity, insults, personal attacks, and hostile language
2. Remove emotional manipulation, guilt trips, or inflammatory content
3. Convert aggressive language to neutral, business-like communication
4. Keep the core message if it's child-related and constructive
5. Apply BIFF method: Brief, Informative, Friendly, Firm
6. Focus ONLY on children's needs, schedules, or logistics

If the message is too hostile or inappropriate to salvage:
- Return "MESSAGE_TOO_HOSTILE" 
- This will prompt the user to select from pre-generated options instead

Rules:
- Remove: "you always/never", blame, accusations, relationship complaints
- Convert: emotional outbursts → factual statements
- Keep: child-related concerns, schedule requests, legitimate logistics
- Maximum 25 words in filtered response

User's response: "${userResponse}"

Filtered response (or MESSAGE_TOO_HOSTILE):`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.2, // Low temperature for consistent filtering
      });

      const filtered = response.choices[0]?.message?.content?.trim() || '';
      
      if (filtered === 'MESSAGE_TOO_HOSTILE') {
        return {
          filteredResponse: '',
          isAppropriate: false
        };
      }

      return {
        filteredResponse: filtered || this.basicFilterUserResponse(userResponse),
        isAppropriate: true
      };

    } catch (error) {
      logger.error('Error filtering user response:', error);
      return {
        filteredResponse: this.basicFilterUserResponse(userResponse),
        isAppropriate: true
      };
    }
  }

  // Basic fallback filtering without AI
  basicFilterUserResponse(response: string): string {
    let filtered = response;
    
    // Remove common profanity and hostile words
    const hostileWords = [
      'stupid', 'idiot', 'hate', 'terrible', 'awful', 'worst', 'useless',
      'damn', 'hell', 'crazy', 'ridiculous', 'pathetic', 'loser', 'jerk'
    ];
    
    hostileWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      filtered = filtered.replace(regex, '[removed]');
    });

    // Remove excessive punctuation and caps
    filtered = filtered.replace(/[!]{2,}/g, '.');
    filtered = filtered.replace(/[?]{2,}/g, '?');
    filtered = filtered.replace(/[A-Z]{3,}/g, (match) => 
      match.charAt(0) + match.slice(1).toLowerCase()
    );

    // Limit length
    if (filtered.length > 150) {
      filtered = filtered.substring(0, 147) + '...';
    }

    return filtered.trim() || "I'd like to discuss this matter regarding our child.";
  }

  // Generate 3 professional options for client's outgoing message
  async generateOutgoingMessageOptions(clientMessage: string): Promise<{messageOptions: [string, string, string], messageType: 'informational' | 'decision_making'}> {
    try {
      if (!this.openai) {
        return this.getMockOutgoingOptions(clientMessage);
      }

      // First classify the message type
      const messageType = await this.classifyMessage(clientMessage);

      // Generate 3 distinct professional versions
      const messageOptions = await this.generateProfessionalVersions(clientMessage, messageType);

      return {
        messageOptions,
        messageType
      };

    } catch (error) {
      logger.error('Error generating outgoing message options:', error);
      return this.getMockOutgoingOptions(clientMessage);
    }
  }

  private async generateProfessionalVersions(message: string, type: 'informational' | 'decision_making'): Promise<[string, string, string]> {
    const prompt = `
You are helping a co-parent send professional, effective messages to their ex-partner. Generate 3 DISTINCTLY DIFFERENT professional versions of their message.

Apply research-based co-parenting communication principles:
- BIFF method: Brief, Informative, Friendly, Firm
- Child-centered focus
- Neutral, business-like tone
- Solution-oriented approach

Generate 3 different strategic approaches:

OPTION 1 - DIRECT APPROACH:
- Straightforward and clear
- Gets straight to the point
- Professional but not overly diplomatic

OPTION 2 - DIPLOMATIC APPROACH:  
- Collaborative language
- Emphasizes working together
- Uses "we" and partnership language

OPTION 3 - CHILD-FOCUSED APPROACH:
- Centers the children's needs
- Emphasizes what's best for kids
- Solution-oriented for family benefit

Rules:
- Each option must be under 25 words
- Remove any blame, accusation, or emotional language
- Keep the core request/information intact
- Make each approach genuinely different in strategy

Client's original message: "${message}"

Generate exactly 3 different professional versions:
1.
2. 
3.`;

    try {
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.maxTokens,
        temperature: 0.7, // Higher temperature for creative options
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        return this.getDefaultOutgoingOptions(type);
      }

      // Parse the numbered responses
      const lines = content.split('\n').filter(line => line.trim());
      const options: string[] = [];

      for (const line of lines) {
        const match = line.match(/^\d+\.?\s*(.+)/);
        if (match && match[1]) {
          options.push(match[1].trim());
        }
      }

      // Ensure we have exactly 3 options
      while (options.length < 3) {
        const defaults = this.getDefaultOutgoingOptions(type);
        options.push(defaults[options.length]);
      }

      return [options[0], options[1], options[2]];
    } catch (error) {
      logger.error('Error generating professional versions:', error);
      return this.getDefaultOutgoingOptions(type);
    }
  }

  private getDefaultOutgoingOptions(type: 'informational' | 'decision_making'): [string, string, string] {
    if (type === 'informational') {
      return [
        "I wanted to update you about our child's schedule.",
        "I'd like to share some information about our child with you.",
        "Here's an update that affects our child's routine."
      ];
    } else {
      return [
        "I need to discuss a scheduling matter with you.",
        "Could we work together to solve this scheduling issue?", 
        "I'd like to find a solution that works best for our child."
      ];
    }
  }

  private getMockOutgoingOptions(clientMessage: string): {messageOptions: [string, string, string], messageType: 'informational' | 'decision_making'} {
    const messageType = this.basicClassification(clientMessage);
    const messageOptions = this.getDefaultOutgoingOptions(messageType);

    return {
      messageOptions,
      messageType
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