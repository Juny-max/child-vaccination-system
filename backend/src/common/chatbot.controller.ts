import { Controller, Post, Body } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /**
   * POST /api/chatbot/message
   * Send a message to the Gemini chatbot
   * Expects: { conversationHistory: Array<{role: string, parts: {text: string}[]}> }
   */
  @Post('message')
  async sendMessage(@Body() body: any) {
    if (!body.conversationHistory || !Array.isArray(body.conversationHistory)) {
      return { 
        error: 'conversationHistory array is required',
        response: "I'm having trouble processing your message. Please try again." 
      };
    }

    const response = await this.chatbotService.sendMessage(
      body.conversationHistory,
    );
    return { response };
  }
}
