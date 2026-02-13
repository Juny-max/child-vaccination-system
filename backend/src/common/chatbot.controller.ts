import { Controller, Post, Body } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

export class SendMessageDto {
  conversationHistory: any[];
}

@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  /**
   * POST /api/chatbot/message
   * Send a message to the Gemini chatbot
   */
  @Post('message')
  async sendMessage(@Body() dto: SendMessageDto) {
    const response = await this.chatbotService.sendMessage(
      dto.conversationHistory,
    );
    return { response };
  }
}
