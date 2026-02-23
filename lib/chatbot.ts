/**
 * AI Chatbot for Parent Support
 * Uses Google Gemini API to provide intelligent responses
 * Can access parent's child data for personalized answers
 */

// Rate limiting state (optimized for Gemini free tier: 15 RPM)
let lastRequestTime = 0
let requestCount = 0
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 12 // Conservative limit (free tier allows 15)
const MIN_REQUEST_INTERVAL = 5000 // 5 seconds between requests (safer for free tier)

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
  status?: string
}

// System prompt for the AI
const SYSTEM_PROMPT = `Role: You are "Sarah," a warm, empathetic pediatric nurse assistant for the Ghana Child Vaccination Command Center.
Tone: Friendly, natural, and conversational - like talking to a trusted friend who happens to be a healthcare professional.

Conversational Guidelines:
1. BE NATURAL: Use contractions ("don't", "it's", "we'll"), respond like a real person in a chat
2. STAY ON TOPIC: Focus on vaccination, child health, and appointments - gently redirect off-topic questions
3. BE COMPLETE: When listing children or information, include ALL items in your response, never cut off mid-sentence
4. SHOW EMPATHY: Acknowledge feelings, celebrate milestones, show concern when appropriate
5. BE HELPFUL: Provide specific, actionable guidance based on the dashboard data provided

Boundaries:
- Stay focused on vaccination and child health topics
- For off-topic questions (like "what is photosynthesis"), politely say: "I'm here specifically to help with vaccination questions. Is there anything about your children's vaccination schedule I can help with?"
- For emergencies or serious symptoms, always advise immediate clinical care

Task: Have natural, helpful conversations about vaccination schedules, child health, appointments, and related concerns. Use the parent's dashboard data to give personalized, accurate answers.`;

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
    contextStr += `### Appointments (${context.upcomingAppointments.length}):\n`;
    context.upcomingAppointments.forEach((appt) => {
      const status = appt.status ? ` [${appt.status}]` : ''
      contextStr += `- ${appt.childName}: ${appt.purpose} at ${appt.facility} on ${appt.date} at ${appt.time}${status}\n`;
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
 * Wait with exponential backoff
 */
async function waitWithBackoff(attempt: number): Promise<void> {
  const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // Max 10s
  await new Promise(resolve => setTimeout(resolve, delay))
}

/**
 * Check and enforce rate limiting
 */
function checkRateLimit(): { allowed: boolean; waitTime: number } {
  const now = Date.now()
  
  // Reset counter if outside window
  if (now - lastRequestTime > RATE_LIMIT_WINDOW) {
    requestCount = 0
  }
  
  // Check minimum interval between requests
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    return { 
      allowed: false, 
      waitTime: MIN_REQUEST_INTERVAL - timeSinceLastRequest 
    }
  }
  
  // Check requests per window
  if (requestCount >= MAX_REQUESTS_PER_WINDOW) {
    return { 
      allowed: false, 
      waitTime: RATE_LIMIT_WINDOW - (now - lastRequestTime) 
    }
  }
  
  return { allowed: true, waitTime: 0 }
}

/**
 * Generate fallback response based on context
 */
function generateFallbackResponse(userMessage: string, context: ChatContext): string {
  const msg = userMessage.toLowerCase()
  
  // Vaccination status questions
  if (msg.includes('status') || msg.includes('progress') || msg.includes('complete')) {
    if (context.children.length > 0) {
      const child = context.children[0]
      return `${child.name} has completed ${child.completedVaccinations} out of ${child.totalVaccinations} vaccinations (${child.completionPercentage}%). ${child.nextVaccination ? `The next vaccine due is ${child.nextVaccination}.` : ''}`
    }
  }
  
  // Missed vaccinations
  if (msg.includes('missed') || msg.includes('overdue') || msg.includes('late')) {
    if (context.missedVaccinations.length > 0) {
      const missed = context.missedVaccinations[0]
      return `${missed.childName} has a missed vaccination: ${missed.vaccine} was due on ${missed.dueDate}. That's ${missed.daysOverdue} days overdue. Please schedule an appointment as soon as possible.`
    }
    return "Great news! You don't have any missed vaccinations right now. Keep up the good work!"
  }
  
  // Appointments
  if (msg.includes('appointment') || msg.includes('next visit') || msg.includes('when')) {
    const activeAppointments = context.upcomingAppointments.filter(
      (appt) => !appt.status || appt.status === 'scheduled' || appt.status === 'confirmed'
    )

    if (activeAppointments.length > 0) {
      const appt = activeAppointments[0]
      const readableStatus = appt.status === 'scheduled' ? 'pending review' : appt.status || 'scheduled'
      return `Your next active appointment is for ${appt.childName} on ${appt.date} at ${appt.time} at ${appt.facility} for ${appt.purpose}. Status: ${readableStatus}.`
    }

    if (context.upcomingAppointments.length > 0) {
      const rejectedCount = context.upcomingAppointments.filter((a) => a.status === 'cancelled').length
      const completedCount = context.upcomingAppointments.filter((a) => a.status === 'completed').length
      return `You currently have no pending or confirmed appointments. Recent updates: ${rejectedCount} rejected/cancelled and ${completedCount} completed appointments.`
    }

    return "You don't have any appointments scheduled yet. You can book one from the Appointments page."
  }
  
  // Default fallback
  return "I'm having trouble connecting to my AI service right now. Please check your dashboard for vaccination information, or try asking again in a moment. If this continues, please contact your health facility."
}

/**
 * Call backend chatbot API (which securely calls Gemini)
 */
export async function sendMessageToGemini(
  userMessage: string,
  conversationHistory: ChatMessage[],
  context: ChatContext,
  maxRetries: number = 2
): Promise<string> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  
  const history = buildConversationHistory(conversationHistory, context);
  
  // Add the new user message
  history.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });

  try {
    const response = await fetch(`${API_URL}/chatbot/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationHistory: history,
      }),
    });

    if (!response.ok) {
      console.error('Backend chatbot API error:', response.status);
      return generateFallbackResponse(userMessage, context);
    }

    const data = await response.json();
    
    if (!data.response) {
      throw new Error('No response from backend');
    }

    return data.response;
  } catch (error) {
    console.error('Error calling backend chatbot:', error);
    return generateFallbackResponse(userMessage, context);
  }
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

  replies.push("Help me book an appointment");
  
  // General health questions
  replies.push("What should I do if my child has a fever after vaccination?");
  replies.push("How do I prepare my child for vaccination?");
  
  return replies.slice(0, 4); // Return max 4 suggestions
}
