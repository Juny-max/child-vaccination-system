'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useParentDashboard } from "../dashboard-context"
import { 
  sendMessageToGemini, 
  generateMessageId, 
  getQuickReplies,
  type ChatMessage,
  type ChatContext
} from "@/lib/chatbot"
import GeminiLiveSession from '@/components/chatbot/gemini-live-session'
import { 
  Bot, 
  Loader2, 
  MessageCircle, 
  PhoneCall, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  Sparkles, 
  User,
  X
} from "lucide-react"

export default function SupportPage() {
  const { userName, dashboard, children, missedVaccinations, appointments } = useParentDashboard()
  
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Build context from dashboard data
  const chatContext: ChatContext = useMemo(() => {
    const childrenContext = dashboard?.children.map(child => ({
      id: child.id,
      name: child.name,
      age: child.age,
      dateOfBirth: '', // Not available in ChildSummary
      completedVaccinations: child.vaccinationProgress.completed,
      totalVaccinations: child.vaccinationProgress.total,
      completionPercentage: child.vaccinationProgress.percentage,
      hasMissedVaccinations: child.hasMissedVaccinations,
      nextVaccination: child.nextVaccination?.vaccine,
      nextVaccinationDate: child.nextVaccination?.dueDate,
    })) || children.map(child => ({
      id: child.id,
      name: child.name,
      age: child.age,
      dateOfBirth: child.dateOfBirth || '',
      completedVaccinations: 0,
      totalVaccinations: 0,
      completionPercentage: 0,
      hasMissedVaccinations: false,
    }))

    return {
      parentName: userName,
      children: childrenContext,
      missedVaccinations: missedVaccinations.map(m => ({
        childName: m.childName,
        vaccine: m.vaccine,
        dueDate: m.dueDate,
        daysOverdue: m.daysOverdue,
      })),
      upcomingAppointments: appointments.map(a => ({
        childName: a.childName,
        date: a.scheduledDate,
        time: a.scheduledTime,
        facility: a.facilityName,
        purpose: a.purpose,
      })),
    }
  }, [userName, dashboard, children, missedVaccinations, appointments])

  // Quick reply suggestions
  const quickReplies = useMemo(() => getQuickReplies(chatContext), [chatContext])

  // Scroll to bottom of messages container only (not the page)
  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current
      container.scrollTop = container.scrollHeight
    }
  }, [messages, isLoading])

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isChatOpen])

  // Initialize chat with welcome message
  const handleLaunchChatbot = useCallback(() => {
    setIsChatOpen(true)
    setError(null)
    
    // Add welcome message if no messages
    if (messages.length === 0) {
      const childNames = chatContext.children.map(c => c.name).join(', ')
      const welcomeMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: `Hello ${userName}! 👋 I'm your virtual nurse assistant for the Child Vaccination Command Center.\n\n${
          chatContext.children.length > 0 
            ? `I can see you have ${chatContext.children.length} ${chatContext.children.length === 1 ? 'child' : 'children'} registered: **${childNames}**.`
            : 'I can help you with vaccination information and guidance.'
        }\n\nHow can I assist you today? You can ask me about:\n• Your children's vaccination status\n• Upcoming or missed vaccinations\n• Post-vaccination care tips\n• Ghana's immunization schedule`,
        timestamp: new Date(),
      }
      setMessages([welcomeMessage])
    }
  }, [userName, chatContext, messages.length])

  // Send message to AI
  const handleSendMessage = useCallback(async (messageText?: string) => {
    const text = messageText || draft.trim()
    if (!text || isLoading) return

    setDraft("")
    setError(null)

    // Add user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      // Get AI response
      const response = await sendMessageToGemini(text, messages, chatContext)
      
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }
      
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get response. Please try again.')
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: "I apologize, but I'm having trouble responding right now. Please try again or contact the clinic directly for urgent matters.",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [draft, isLoading, messages, chatContext])

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Clear chat
  const handleClearChat = () => {
    setMessages([])
    setError(null)
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-secondary/10 to-muted">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-2 inline-flex items-center gap-1">
              <Sparkles className="size-3" /> AI-powered assistant
            </Badge>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Bot className="size-6" /> Vaccination Assistant
            </CardTitle>
            <CardDescription>
              Ask questions about your children&apos;s vaccinations, get personalized advice, and learn about post-care guidance.
            </CardDescription>
          </div>
          <Button 
            variant={isChatOpen ? "outline" : "secondary"} 
            size="sm" 
            className="gap-2" 
            onClick={isChatOpen ? () => setIsChatOpen(false) : handleLaunchChatbot}
          >
            <MessageCircle className="size-4" /> 
            {isChatOpen ? 'Minimize chat' : 'Launch chatbot'}
          </Button>
        </CardHeader>
      </Card>
      {/* Live audio session is rendered inside input area (see input) */}

      {/* Chat Interface */}
      {isChatOpen && (
        <Card className="border-primary/40 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                <Bot className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Virtual Nurse</CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <span className="size-2 rounded-full bg-green-500"></span>
                  Online • Powered by AI
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleClearChat} title="Clear chat">
                <RefreshCw className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {/* Messages Area */}
            <div ref={messagesContainerRef} className="h-[400px] space-y-4 overflow-y-auto p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <div className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    message.role === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}>
                    {message.role === 'user' ? (
                      <User className="size-4" />
                    ) : (
                      <Bot className="size-4" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div className={cn(
                      "mt-1 text-xs",
                      message.role === 'user' ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                    <Bot className="size-4" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              

            </div>

            {/* Quick Replies */}
            {messages.length <= 1 && !isLoading && (
              <div className="border-t px-4 py-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Suggested questions:</p>
                <div className="flex flex-wrap gap-2">
                  {quickReplies.map((reply, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal py-2 text-left text-xs"
                      onClick={() => handleSendMessage(reply)}
                    >
                      {reply}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="border-t bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about vaccinations, appointments, or child care..."
                  disabled={isLoading}
                  className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  rows={1}
                />
                <GeminiLiveSession
                  chatContext={chatContext}
                  onTranscriptUpdate={(userText, botText) => {
                    if (userText) {
                      const userMessage: ChatMessage = {
                        id: generateMessageId(),
                        role: 'user',
                        content: userText,
                        timestamp: new Date(),
                      }
                      setMessages(prev => [...prev, userMessage])
                    }
                    if (botText) {
                      const assistantMessage: ChatMessage = {
                        id: generateMessageId(),
                        role: 'assistant',
                        content: botText,
                        timestamp: new Date(),
                      }
                      setMessages(prev => [...prev, assistantMessage])
                    }
                  }}
                  enabled={isChatOpen}
                />

                <Button 
                  onClick={() => handleSendMessage()} 
                  disabled={!draft.trim() || isLoading}
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Press Enter to send • Shift+Enter for new line
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What the assistant can help with</CardTitle>
            <CardDescription>Get personalized guidance for your child&apos;s health needs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">📊 Vaccination status</p>
              <p>Check which vaccines your children have completed and what&apos;s coming next.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">💉 Post-vaccination care</p>
              <p>Get advice on managing fever, swelling, or other common side effects.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">📅 Appointments &amp; reminders</p>
              <p>Ask about upcoming appointments and what to bring to the clinic.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">📚 Vaccine information</p>
              <p>Learn about Ghana&apos;s immunization schedule and why each vaccine matters.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Your children&apos;s summary</CardTitle>
            <CardDescription>Quick overview of vaccination status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {chatContext.children.length > 0 ? (
              chatContext.children.map((child) => (
                <div key={child.id} className="rounded-lg border border-border bg-background p-3">
                  <p className="font-semibold text-foreground">{child.name}</p>
                  <p className="text-xs text-muted-foreground">{child.age}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted">
                      <div 
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${child.completionPercentage}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{child.completionPercentage}%</span>
                  </div>
                  {child.hasMissedVaccinations && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      Has missed doses
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No children registered yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Human Support Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-5" /> Need human support instead?
          </CardTitle>
          <CardDescription>Reach your primary care team directly for urgent matters.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">Accra Central Health Center</p>
            <p>Support line: +233 30 123 4567 (Mon – Fri, 8:00 AM – 5:00 PM)</p>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <a href="tel:+233301234567" aria-label="Call the clinic">
              <PhoneCall className="size-4" /> Call the clinic
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
