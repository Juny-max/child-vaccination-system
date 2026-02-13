import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly apiKey: string;
  private lastRequestTime = 0;
  private requestCount = 0;
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_REQUESTS_PER_WINDOW = 12;
  private readonly MIN_REQUEST_INTERVAL = 5000; // 5 seconds

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
  }

  /**
   * Check rate limit before making request
   */
  private checkRateLimit(): { allowed: boolean; waitTime: number } {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    // Reset counter if window has passed
    if (timeSinceLastRequest > this.RATE_LIMIT_WINDOW) {
      this.requestCount = 0;
    }

    // Check if we've hit the limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_WINDOW) {
      const waitTime = this.RATE_LIMIT_WINDOW - timeSinceLastRequest;
      return { allowed: false, waitTime };
    }

    // Enforce minimum interval between requests
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      return { allowed: false, waitTime };
    }

    return { allowed: true, waitTime: 0 };
  }

  /**
   * Wait with exponential backoff
   */
  private async waitWithBackoff(attempt: number): Promise<void> {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Generate fallback response when API is unavailable
   */
  private generateFallbackResponse(userMessage: string): string {
    const msg = userMessage.toLowerCase();

    if (msg.includes('vaccination') || msg.includes('vaccine')) {
      return "I'm having trouble connecting to my AI service right now. Please check your dashboard for vaccination information, or contact your health facility for assistance.";
    }

    if (msg.includes('missed') || msg.includes('overdue')) {
      return "Please check your dashboard for any missed vaccinations. If you see any overdue vaccines, schedule an appointment as soon as possible.";
    }

    if (msg.includes('appointment')) {
      return "Please check your dashboard for upcoming appointments. You can also contact your health facility directly to schedule or modify appointments.";
    }

    return "I'm having trouble connecting right now. Please check your dashboard for information, or try again in a moment. If this continues, please contact your health facility.";
  }

  /**
   * Send message to Gemini API
   */
  async sendMessage(
    conversationHistory: any[],
    maxRetries: number = 2,
  ): Promise<string> {
    // Check for API key
    if (!this.apiKey) {
      this.logger.warn('Gemini API key not configured');
      return this.generateFallbackResponse('help');
    }

    // Check rate limit
    const rateCheck = this.checkRateLimit();
    if (!rateCheck.allowed) {
      this.logger.warn(`Rate limit hit, waiting ${rateCheck.waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, rateCheck.waitTime));
    }

    // Update rate limit tracking
    this.lastRequestTime = Date.now();
    this.requestCount++;

    // Try multiple models
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    for (const modelName of models) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: conversationHistory,
                generationConfig: {
                  temperature: 0.9,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 512,
                },
                safetySettings: [
                  {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                  },
                  {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                  },
                  {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                  },
                  {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE',
                  },
                ],
              }),
            },
          );

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));

            // Handle rate limits
            if (response.status === 429) {
              this.logger.warn(
                `Rate limited on ${modelName}, attempt ${attempt + 1}`,
              );
              if (attempt < maxRetries) {
                await this.waitWithBackoff(attempt);
                continue;
              }
              break; // Try next model
            }

            // Handle auth/config errors
            if (response.status === 400 || response.status === 401) {
              this.logger.error('API configuration error:', error);
              return this.generateFallbackResponse('help');
            }

            // Retry other errors
            if (attempt < maxRetries) {
              this.logger.warn(
                `API error (${response.status}), retrying attempt ${attempt + 1}`,
              );
              await this.waitWithBackoff(attempt);
              continue;
            }

            this.logger.error('Gemini API error after retries:', error);
            return this.generateFallbackResponse('help');
          }

          const data = await response.json();

          // Extract response
          const candidates = data.candidates;
          if (!candidates || candidates.length === 0) {
            throw new Error('No response generated');
          }

          const content = candidates[0].content;
          if (!content || !content.parts || content.parts.length === 0) {
            throw new Error('Empty response from AI');
          }

          const text = content.parts
            .map((part: any) => part.text || '')
            .join('');

          this.logger.log(`Response received from ${modelName}`);
          return text;
        } catch (error) {
          this.logger.error(
            `Error with ${modelName} (attempt ${attempt + 1}):`,
            error,
          );

          if (attempt >= maxRetries) {
            break; // Try next model
          }

          await this.waitWithBackoff(attempt);
        }
      }
    }

    // All models failed
    this.logger.error('All Gemini models failed');
    return this.generateFallbackResponse('help');
  }
}
