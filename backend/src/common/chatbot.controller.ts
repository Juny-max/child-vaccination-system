import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { VaccinationSchedulerService } from './vaccination-scheduler.service';
import { SmsService } from './sms.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly vaccinationScheduler: VaccinationSchedulerService,
    private readonly smsService: SmsService,
  ) {}

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

  /**
   * POST /api/chatbot/test-vaccination-reminders
   * Manually trigger vaccination reminders (for testing)
   * This will send SMS to parents with vaccinations due today
   * 
   * Optional body:
   * { "testPhoneNumber": "0241234567" } - Override recipient phone number for testing
   */
  @Post('test-vaccination-reminders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hq-admin')
  async testVaccinationReminders(@Body() body: any = {}) {
    const testPhoneNumber = body.testPhoneNumber || null;
    return this.vaccinationScheduler.sendRemindersNow(testPhoneNumber);
  }

  /**
   * POST /api/chatbot/test-sms
   * Send a simple test SMS to verify Hubtel integration
   * 
   * Body: { "phoneNumber": "0545427393" }
   */
  @Post('test-sms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('hq-admin')
  async testSms(@Body() body: any) {
    if (!body.phoneNumber) {
      return {
        success: false,
        message: 'Phone number is required',
      };
    }

    const message = `TEST: This is a test SMS from CVCC Ghana Child Vaccination System. Your number: ${body.phoneNumber}. Time: ${new Date().toLocaleString()}`;

    const sent = await this.smsService.sendSms(body.phoneNumber, message);

    return {
      success: sent,
      message: sent 
        ? `Test SMS sent to ${body.phoneNumber}` 
        : `Failed to send SMS to ${body.phoneNumber}. Check Hubtel credentials.`,
      phone: body.phoneNumber,
    };
  }
}
