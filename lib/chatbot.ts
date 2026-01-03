/**
 * AI Chatbot for Parent Support
 * Uses Google Gemini API to provide intelligent responses
 * Can access parent's child data for personalized answers
 */

// Types for chat messages
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

export interface ChatContext {
  parentName: string
  children: ChildContext[]
  missedVaccinations: MissedVaccinationContext[]
  upcomingAppointments: AppointmentContext[]
}

export interface ChildContext {
  id: string
  name: string
  age: string
  dateOfBirth: string
  completedVaccinations: number
  totalVaccinations: number
  completionPercentage: number
  hasMissedVaccinations: boolean
  nextVaccination?: string
  nextVaccinationDate?: string
}

export interface MissedVaccinationContext {
  childName: string
  vaccine: string
  dueDate: string
  daysOverdue: number
}

export interface AppointmentContext {
  childName: string
  date: string
  time: string
  facility: string
  purpose: string
}

// System prompt for the AI
const SYSTEM_PROMPT = `You are a helpful, caring virtual nurse assistant for the Child Vaccination Command Center (CVCC). Your role is to assist parents and guardians with their children's vaccination needs.

## Your Capabilities:
1. Answer questions about child vaccinations, schedules, and post-vaccination care
2. Provide information about the National Immunization Programme vaccines
3. Help parents understand their children's vaccination status
4. Offer guidance on managing common post-vaccination symptoms
5. Explain the importance of timely vaccinations
6. Remind parents about upcoming appointments and missed doses

## National Immunization Schedule (Key Vaccines):
- BCG: At birth (protects against tuberculosis)
- OPV (Oral Polio): Birth, 6, 10, 14 weeks
- Pentavalent (DTP-HepB-Hib): 6, 10, 14 weeks
- PCV (Pneumococcal): 6, 10, 14 weeks
- Rotavirus: 6, 10 weeks
- Measles-Rubella: 9 months, 18 months
- Yellow Fever: 9 months
- Meningococcal A: 9 months
- Vitamin A: 6 months onwards

## Guidelines:
- Be warm, empathetic, and reassuring
- Use simple language that any parent can understand
- If asked about specific child data, use the provided context
- For medical emergencies, advise parents to visit the nearest health facility immediately
- Never diagnose conditions - only provide general guidance
- If unsure, recommend consulting with a healthcare professional
- Keep responses concise but informative
- Use bullet points for lists and steps
- When declining off-topic questions, simply say your expertise is in the "National Immunization Programme" and "CVCC" without adding country names

## Important Notes:
- You have access to the parent's dashboard data (children, vaccinations, appointments)
- When parents ask about their children, refer to the actual data provided
- Be specific when mentioning dates, names, and vaccine details from the context
- Encourage parents to complete missed vaccinations as soon as possible`;

/**
 * Format the parent's context into a readable string for the AI
 */
export function formatContext(context: ChatContext): string {
  let contextStr = `\n\n## Parent's Current Dashboard Data:\n`;
  contextStr += `Parent Name: ${context.parentName}\n\n`;
  
  if (context.children.length > 0) {
    contextStr += `### Children (${context.children.length}):\n`;
    context.children.forEach((child, idx) => {
      contextStr += `${idx + 1}. **${child.name}**\n`;
      contextStr += `   - Age: ${child.age}\n`;
      contextStr += `   - Date of Birth: ${child.dateOfBirth}\n`;
      contextStr += `   - Vaccination Progress: ${child.completedVaccinations}/${child.totalVaccinations} (${child.completionPercentage}%)\n`;
      contextStr += `   - Has Missed Vaccinations: ${child.hasMissedVaccinations ? 'Yes' : 'No'}\n`;
      if (child.nextVaccination) {
        contextStr += `   - Next Vaccination: ${child.nextVaccination} on ${child.nextVaccinationDate || 'TBD'}\n`;
      }
      contextStr += '\n';
    });
  }
  
  if (context.missedVaccinations.length > 0) {
    contextStr += `### Missed Vaccinations (${context.missedVaccinations.length}):\n`;
    context.missedVaccinations.forEach((missed) => {
      contextStr += `- ${missed.childName}: ${missed.vaccine} (due ${missed.dueDate}, ${missed.daysOverdue} days overdue)\n`;
    });
    contextStr += '\n';
  }
  
  if (context.upcomingAppointments.length > 0) {
    contextStr += `### Upcoming Appointments:\n`;
    context.upcomingAppointments.forEach((appt) => {
      contextStr += `- ${appt.childName}: ${appt.purpose} at ${appt.facility} on ${appt.date} at ${appt.time}\n`;
    });
    contextStr += '\n';
  }
  
  return contextStr;
}

/**
 * Build conversation history for the AI
 */
export function buildConversationHistory(
  messages: ChatMessage[],
  context: ChatContext
): { role: string; parts: { text: string }[] }[] {
  const history: { role: string; parts: { text: string }[] }[] = [];
  
  // Add system context as first user message (Gemini doesn't have system role)
  const systemWithContext = SYSTEM_PROMPT + formatContext(context);
  
  // For Gemini, we need to structure as user/model alternating
  // Start with system prompt as initial context
  history.push({
    role: 'user',
    parts: [{ text: `[System Instructions]\n${systemWithContext}\n\n[End System Instructions]\n\nPlease acknowledge you understand your role.` }]
  });
  
  history.push({
    role: 'model',
    parts: [{ text: `I understand. I'm your virtual nurse assistant for the Ghana Child Vaccination Command Center. I'm here to help you with ${context.children.length > 0 ? `information about ${context.children.map(c => c.name).join(', ')}` : 'your children\'s vaccination needs'}. How can I assist you today?` }]
  });
  
  // Add conversation history
  messages.forEach((msg) => {
    history.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  });
  
  return history;
}

/**
 * Call Google Gemini API
 */
export async function sendMessageToGemini(
  userMessage: string,
  conversationHistory: ChatMessage[],
  context: ChatContext
): Promise<string> {
  const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  if (!API_KEY) {
    throw new Error('Gemini API key not configured');
  }
  
  const history = buildConversationHistory(conversationHistory, context);
  
  // Add the new user message
  history.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: history,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        ],
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Gemini API error:', error);
    throw new Error(error.error?.message || 'Failed to get response from AI');
  }
  
  const data = await response.json();
  
  // Extract text from response
  const candidates = data.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No response generated');
  }
  
  const content = candidates[0].content;
  if (!content || !content.parts || content.parts.length === 0) {
    throw new Error('Empty response from AI');
  }
  
  return content.parts[0].text;
}

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Quick response suggestions based on context
 */
export function getQuickReplies(context: ChatContext): string[] {
  const replies: string[] = [];
  
  // Always include general questions
  replies.push("What vaccines are due next?");
  
  // Add child-specific questions
  if (context.children.length > 0) {
    const firstChild = context.children[0];
    replies.push(`Tell me about ${firstChild.name}'s vaccination status`);
  }
  
  // Add missed vaccination prompt if any
  if (context.missedVaccinations.length > 0) {
    replies.push("Why are missed vaccinations important?");
  }
  
  // Add appointment question if any
  if (context.upcomingAppointments.length > 0) {
    replies.push("When is my next appointment?");
  }
  
  // General health questions
  replies.push("What should I do if my child has a fever after vaccination?");
  replies.push("How do I prepare my child for vaccination?");
  
  return replies.slice(0, 4); // Return max 4 suggestions
}
