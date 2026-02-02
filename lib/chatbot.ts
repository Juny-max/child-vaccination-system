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
}

// System prompt for the AI
const SYSTEM_PROMPT = `Role: You are "Sarah," a warm, empathetic, and highly efficient pediatric nurse.
Tone: Friendly, reassuring, and professional. Speak like a real human, not an AI.

Speech Guidelines:
1. USE CONTRACTIONS: Always use contractions ("don't", "it's", "we'll").
2. BE CONCISE: Keep responses short — aim for under 2 sentences unless the question requires detail.
3. USE FILLERS: Occasionally include natural transitions like "Okay," "I see," "Right," or "Great." Keep them subtle.
4. NO LISTS: Prefer flowing, conversational sentences instead of bullet lists when speaking.
5. EMPATHY FIRST: If a parent sounds worried, acknowledge their feeling before giving guidance.

Task: Help parents track vaccination schedules and answer concerns with clinical accuracy and motherly warmth. Use the child's dashboard context when relevant. For emergencies, advise immediate clinical care.

Why: These instructions produce faster, more natural responses and make text-to-speech feel conversational. Keep responses concise to reduce latency and improve perceived responsiveness.`;

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
    if (context.upcomingAppointments.length > 0) {
      const appt = context.upcomingAppointments[0]
      return `Your next appointment is for ${appt.childName} on ${appt.date} at ${appt.time} at ${appt.facility} for ${appt.purpose}.`
    }
    return "You don't have any upcoming appointments scheduled. Check your dashboard for vaccination schedules."
  }
  
  // Default fallback
  return "I'm having trouble connecting to my AI service right now. Please check your dashboard for vaccination information, or try asking again in a moment. If this continues, please contact your health facility."
}

/**
 * Call Google Gemini API with retry logic and fallbacks
 */
export async function sendMessageToGemini(
  userMessage: string,
  conversationHistory: ChatMessage[],
  context: ChatContext,
  maxRetries: number = 2
): Promise<string> {
  const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  
  // Check for API key
  if (!API_KEY || API_KEY === 'your-api-key-here') {
    console.warn('Gemini API key not configured, using fallback responses')
    return generateFallbackResponse(userMessage, context)
  }
  
  // Enforce rate limiting
  const rateCheck = checkRateLimit()
  if (!rateCheck.allowed) {
    console.warn(`Rate limit hit, waiting ${rateCheck.waitTime}ms`)
    await new Promise(resolve => setTimeout(resolve, rateCheck.waitTime))
  }
  
  // Update rate limit tracking
  lastRequestTime = Date.now()
  requestCount++
  
  const history = buildConversationHistory(conversationHistory, context);
  
  // Add the new user message
  history.push({
    role: 'user',
    parts: [{ text: userMessage }]
  });
  
  // Try native audio model first for speech-to-speech, then stable model
  const models = [
    'gemini-2.0-flash-exp',       // Native audio support for speech
    'gemini-1.5-flash',           // Stable fallback
  ]
  
  let lastError: any = null
  
  // Try each model
  for (const modelName of models) {
    // Retry logic with exponential backoff per model
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`,
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
              maxOutputTokens: 150, // Reduced for faster responses
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
        
        // Handle specific error codes
        if (response.status === 429) {
          // Rate limit error - try next model or use fallback
          lastError = error
          if (attempt < maxRetries) {
            console.warn(`Rate limited on ${modelName}, retrying (attempt ${attempt + 1}/${maxRetries + 1})...`)
            await waitWithBackoff(attempt)
            continue
          }
          // Try next model
          break // Exit retry loop to try next model
        }
        
        if (response.status === 400 || response.status === 401) {
          // Bad request or auth error - don't retry
          console.error('API configuration error:', error)
          return generateFallbackResponse(userMessage, context)
        }
        
        // Other errors - retry
        if (attempt < maxRetries) {
          console.warn(`API error (${response.status}), retrying... (attempt ${attempt + 1}/${maxRetries + 1})`)
          await waitWithBackoff(attempt)
          continue
        }
        
        // Max retries reached
        console.error('Gemini API error after retries:', error);
        return generateFallbackResponse(userMessage, context)
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
      
      // Success! Return the response
      console.log(`✓ Response received from ${modelName}`)
      return content.parts[0].text;
      
      } catch (err) {
        lastError = err
        if (attempt < maxRetries) {
          console.warn(`Network error on ${modelName}, retrying... (attempt ${attempt + 1}/${maxRetries + 1})`, err)
          await waitWithBackoff(attempt)
          continue
        }
        
        // Max retries reached for this model, try next
        console.warn(`Failed with ${modelName} after retries, trying next model...`)
        break // Exit retry loop to try next model
      }
    }
  }
  
  // All models failed, use intelligent fallback
  console.log('Using smart fallback response based on dashboard data')
  return generateFallbackResponse(userMessage, context)
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
