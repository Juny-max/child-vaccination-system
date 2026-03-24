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

type BookingField = 'childId' | 'date' | 'time' | 'contactPhone' | 'preferredFacility' | 'notes' | 'confirm'

type BookingDraft = {
  childId: string
  childName: string
  date: string
  time: string
  contactPhone: string
  preferredFacility: string
  notes: string
}

const EMPTY_BOOKING_DRAFT: BookingDraft = {
  childId: '',
  childName: '',
  date: '',
  time: '',
  contactPhone: '',
  preferredFacility: 'Any participating clinic',
  notes: '',
}

function toDateInputString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInput(text: string): string | null {
  const normalized = text.trim().toLowerCase()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (normalized === 'today') return toDateInputString(today)
  if (normalized === 'tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    return toDateInputString(tomorrow)
  }

  const isoMatch = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`)
    if (!Number.isNaN(parsed.getTime())) return toDateInputString(parsed)
  }

  const slashMatch = normalized.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (slashMatch) {
    const day = Number(slashMatch[1])
    const month = Number(slashMatch[2])
    const year = Number(slashMatch[3])
    const parsed = new Date(year, month - 1, day)
    if (!Number.isNaN(parsed.getTime())) return toDateInputString(parsed)
  }

  const naturalParsed = new Date(text)
  if (!Number.isNaN(naturalParsed.getTime())) {
    naturalParsed.setHours(0, 0, 0, 0)
    return toDateInputString(naturalParsed)
  }

  return null
}

function parseTimeInput(text: string): string | null {
  const normalized = text.trim().toLowerCase()
  const twentyFourHour = normalized.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
  if (twentyFourHour) {
    return `${twentyFourHour[1].padStart(2, '0')}:${twentyFourHour[2]}`
  }

  const amPm = normalized.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/)
  if (amPm) {
    let hour = Number(amPm[1])
    const minute = amPm[2] || '00'
    const period = amPm[3]
    if (period === 'pm' && hour !== 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${minute}`
  }

  return null
}

function extractPhoneInput(text: string): string | null {
  const match = text.match(/\+?[\d\s-]{10,}/)
  if (!match) return null
  return match[0].trim()
}

function isAffirmative(text: string): boolean {
  return /^(yes|y|confirm|go ahead|book it|okay|ok)$/i.test(text.trim())
}

function isNegative(text: string): boolean {
  return /^(no|n|cancel|stop|not now)$/i.test(text.trim())
}

function isBookingIntent(text: string): boolean {
  const normalized = text.toLowerCase()
  return (
    /\bbook\b/.test(normalized) ||
    /\bschedule\b/.test(normalized) ||
    /\breschedule\b/.test(normalized) ||
    /\bset\s*up\b/.test(normalized) ||
    /\barrange\b/.test(normalized) ||
    /\bmake\b.*\bappointment\b/.test(normalized) ||
    /\bappointment\b.*\bplease\b/.test(normalized) ||
    /\bneed\b.*\bappointment\b/.test(normalized) ||
    /\bwant\b.*\bappointment\b/.test(normalized) ||
    /\bclinic\s*visit\b/.test(normalized)
  )
}

function hasAssistantBookingSignal(text: string): boolean {
  const normalized = text.toLowerCase()
  return (
    /\blet'?s\s+book\b/.test(normalized) ||
    /\bi can book\b/.test(normalized) ||
    /\bbook (an )?appointment\b/.test(normalized) ||
    /\bconfirm (the )?appointment\b/.test(normalized) ||
    /\breply\s+'?yes'?\s+to\s+confirm\b/.test(normalized) ||
    /\bappointment\s+booked\b/.test(normalized)
  )
}

export default function SupportPage() {
  const { userName, dashboard, children, missedVaccinations, appointments, createAppointment } = useParentDashboard()
  
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isBookingInProgress, setIsBookingInProgress] = useState(false)
  const [bookingActive, setBookingActive] = useState(false)
  const [bookingAwaiting, setBookingAwaiting] = useState<BookingField | null>(null)
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>(EMPTY_BOOKING_DRAFT)
  
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
      upcomingAppointments: [...appointments].map(a => ({
        childName: a.childName,
        date: a.scheduledDate,
        time: a.scheduledTime,
        facility: a.facilityName,
        purpose: a.purpose,
        status: a.status,
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

  const addAssistantMessage = useCallback((content: string) => {
    const assistantMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'assistant',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMessage])
  }, [])

  const findChildFromInput = useCallback((text: string) => {
    const normalized = text.toLowerCase()
    return children.find((child) => normalized.includes(child.name.toLowerCase())) || null
  }, [children])

  const getNextBookingField = useCallback((draft: BookingDraft): BookingField => {
    if (!draft.childId) return 'childId'
    if (!draft.date) return 'date'
    if (!draft.time) return 'time'
    if (!draft.contactPhone) return 'contactPhone'
    if (!draft.preferredFacility) return 'preferredFacility'
    if (!draft.notes) return 'notes'
    return 'confirm'
  }, [])

  const getBookingPrompt = useCallback((field: BookingField, draft: BookingDraft): string => {
    if (field === 'childId') {
      if (children.length === 0) return "I couldn't find any registered child to book for."
      const options = children.map((child, idx) => `${idx + 1}. ${child.name}`).join('\n')
      return `Sure — let's book an appointment. Which child is this for?\n${options}`
    }
    if (field === 'date') return 'Great. What date do you want? (Example: 2026-03-10, tomorrow, or 10/03/2026)'
    if (field === 'time') return 'What time should I set? (Example: 09:30 or 2:00 pm)'
    if (field === 'contactPhone') return 'Please share the reachable phone number for this appointment.'
    if (field === 'preferredFacility') return "Any preferred facility? You can type a name or say 'skip'."
    if (field === 'notes') return "Any notes for the nurse? Type your note, or say 'skip'."

    return `Please confirm this booking:\n• Child: ${draft.childName}\n• Date: ${draft.date}\n• Time: ${draft.time}\n• Contact: ${draft.contactPhone}\n• Preferred facility: ${draft.preferredFacility || 'Any participating clinic'}\n• Notes: ${draft.notes || 'None'}\n\nReply 'yes' to confirm or 'no' to cancel.`
  }, [children])

  const processBookingInput = useCallback(async (rawInput: string): Promise<boolean> => {
    const text = rawInput.trim()
    if (!text) return true

    if (!bookingActive) {
      if (!isBookingIntent(text)) return false

      let draftState: BookingDraft = { ...EMPTY_BOOKING_DRAFT }
      const inferredChild = findChildFromInput(text)
      if (inferredChild) {
        draftState.childId = inferredChild.id
        draftState.childName = inferredChild.name
      } else if (children.length === 1) {
        draftState.childId = children[0].id
        draftState.childName = children[0].name
      }

      const inferredDate = parseDateInput(text)
      if (inferredDate) draftState.date = inferredDate

      const inferredTime = parseTimeInput(text)
      if (inferredTime) draftState.time = inferredTime

      const inferredPhone = extractPhoneInput(text)
      if (inferredPhone) draftState.contactPhone = inferredPhone

      if (/preferred facility:/i.test(text)) {
        draftState.preferredFacility = text.split(/preferred facility:/i)[1]?.trim() || draftState.preferredFacility
      }

      setBookingDraft(draftState)
      setBookingActive(true)

      const nextField = getNextBookingField(draftState)
      setBookingAwaiting(nextField)
      addAssistantMessage(getBookingPrompt(nextField, draftState))
      return true
    }

    if (/^cancel booking$/i.test(text)) {
      setBookingActive(false)
      setBookingAwaiting(null)
      setBookingDraft(EMPTY_BOOKING_DRAFT)
      addAssistantMessage('Appointment booking cancelled. You can start again anytime by saying "book appointment".')
      return true
    }

    if (!bookingAwaiting) {
      const nextField = getNextBookingField(bookingDraft)
      setBookingAwaiting(nextField)
      addAssistantMessage(getBookingPrompt(nextField, bookingDraft))
      return true
    }

    const nextDraft = { ...bookingDraft }

    if (bookingAwaiting === 'childId') {
      const selectedByIndex = Number.parseInt(text, 10)
      if (!Number.isNaN(selectedByIndex) && children[selectedByIndex - 1]) {
        nextDraft.childId = children[selectedByIndex - 1].id
        nextDraft.childName = children[selectedByIndex - 1].name
      } else {
        const selectedByName = findChildFromInput(text)
        if (selectedByName) {
          nextDraft.childId = selectedByName.id
          nextDraft.childName = selectedByName.name
        }
      }

      if (!nextDraft.childId) {
        addAssistantMessage('I could not match that child. Please type the child name or number from the list.')
        return true
      }
    }

    if (bookingAwaiting === 'date') {
      const parsed = parseDateInput(text)
      if (!parsed) {
        addAssistantMessage('I could not understand that date. Please use YYYY-MM-DD or say tomorrow.')
        return true
      }

      const selectedDate = new Date(`${parsed}T00:00:00`)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (selectedDate < today) {
        addAssistantMessage('Please choose today or a future date for appointment booking.')
        return true
      }

      nextDraft.date = parsed
    }

    if (bookingAwaiting === 'time') {
      const parsed = parseTimeInput(text)
      if (!parsed) {
        addAssistantMessage('I could not understand that time. Please use HH:mm or 2:00 pm format.')
        return true
      }
      nextDraft.time = parsed
    }

    if (bookingAwaiting === 'contactPhone') {
      const parsed = extractPhoneInput(text)
      if (!parsed) {
        addAssistantMessage('Please enter a valid phone number (at least 10 digits).')
        return true
      }
      nextDraft.contactPhone = parsed
    }

    if (bookingAwaiting === 'preferredFacility') {
      nextDraft.preferredFacility = /^skip$/i.test(text) ? 'Any participating clinic' : text
    }

    if (bookingAwaiting === 'notes') {
      nextDraft.notes = /^skip$/i.test(text) ? 'No additional notes' : text
    }

    if (bookingAwaiting === 'confirm') {
      if (isNegative(text)) {
        setBookingActive(false)
        setBookingAwaiting(null)
        setBookingDraft(EMPTY_BOOKING_DRAFT)
        addAssistantMessage('No problem — booking cancelled.')
        return true
      }

      if (!isAffirmative(text)) {
        addAssistantMessage("Please reply 'yes' to confirm or 'no' to cancel.")
        return true
      }

      const selectedChild = children.find((child) => child.id === bookingDraft.childId)
      if (!selectedChild?.facilityId) {
        setBookingActive(false)
        setBookingAwaiting(null)
        setBookingDraft(EMPTY_BOOKING_DRAFT)
        addAssistantMessage("I couldn't complete the booking because the child's facility is missing. Please use the appointment form.")
        return true
      }

      try {
        setIsBookingInProgress(true)
        await createAppointment({
          childId: bookingDraft.childId,
          facilityId: selectedChild.facilityId,
          scheduledDate: bookingDraft.date,
          scheduledTime: bookingDraft.time,
          purpose: 'Vaccination appointment request',
          contactPhone: bookingDraft.contactPhone,
          notes: [
            bookingDraft.preferredFacility ? `Preferred facility: ${bookingDraft.preferredFacility}` : '',
            bookingDraft.notes && bookingDraft.notes !== 'No additional notes' ? `Parent notes: ${bookingDraft.notes}` : '',
          ].filter(Boolean).join('. '),
        })

        addAssistantMessage(`✅ Appointment booked successfully for ${bookingDraft.childName} on ${bookingDraft.date} at ${bookingDraft.time}. The nurse will review and confirm shortly.`)
      } catch (submitError) {
        console.error('Chatbot booking error:', submitError)
        addAssistantMessage('I could not submit the appointment right now. Please try again, or use the appointment form directly.')
      } finally {
        setIsBookingInProgress(false)
        setBookingActive(false)
        setBookingAwaiting(null)
        setBookingDraft(EMPTY_BOOKING_DRAFT)
      }

      return true
    }

    setBookingDraft(nextDraft)
    const nextField = getNextBookingField(nextDraft)
    setBookingAwaiting(nextField)
    addAssistantMessage(getBookingPrompt(nextField, nextDraft))
    return true
  }, [
    bookingActive,
    bookingAwaiting,
    bookingDraft,
    children,
    findChildFromInput,
    getNextBookingField,
    getBookingPrompt,
    addAssistantMessage,
    createAppointment,
  ])

  const handleSendMessage = useCallback(async (messageText?: string, voiceAssistantReply?: string) => {
    const text = (messageText || draft).trim()
    if (!text || isLoading || isBookingInProgress) return

    setDraft("")
    setError(null)

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    const bookingHandled = await processBookingInput(text)
    if (bookingHandled) return

    if (voiceAssistantReply?.trim()) {
      const cleanedVoiceReply = voiceAssistantReply.trim()

      if (hasAssistantBookingSignal(cleanedVoiceReply)) {
        addAssistantMessage("I can help you book this safely. I'll collect the details and ask for your final confirmation before submitting.")
        await processBookingInput('book appointment')
        return
      }

      addAssistantMessage(cleanedVoiceReply)
      return
    }

    setIsLoading(true)
    try {
      const response = await sendMessageToGemini(text, messages, chatContext)

      if (hasAssistantBookingSignal(response)) {
        addAssistantMessage("I can help you book this safely. I'll collect the details and ask for your final confirmation before submitting.")
        await processBookingInput('book appointment')
      } else {
        addAssistantMessage(response)
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError(err instanceof Error ? err.message : 'Failed to get response. Please try again.')
      addAssistantMessage("I apologize, but I'm having trouble responding right now. Please try again or contact the clinic directly for urgent matters.")
    } finally {
      setIsLoading(false)
    }
  }, [draft, isLoading, isBookingInProgress, processBookingInput, addAssistantMessage, messages, chatContext])

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
    setBookingActive(false)
    setBookingAwaiting(null)
    setBookingDraft(EMPTY_BOOKING_DRAFT)
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
              <Bot className="size-6" /> Virtual Assistant
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
              {bookingActive && bookingAwaiting === 'confirm' && (
                <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-semibold text-foreground">Confirm appointment details</p>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground">Child:</span> {bookingDraft.childName}</p>
                    <p><span className="font-medium text-foreground">Date:</span> {bookingDraft.date}</p>
                    <p><span className="font-medium text-foreground">Time:</span> {bookingDraft.time}</p>
                    <p><span className="font-medium text-foreground">Contact:</span> {bookingDraft.contactPhone}</p>
                    <p><span className="font-medium text-foreground">Preferred facility:</span> {bookingDraft.preferredFacility || 'Any participating clinic'}</p>
                    <p><span className="font-medium text-foreground">Notes:</span> {bookingDraft.notes || 'None'}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={isLoading || isBookingInProgress}
                      onClick={() => handleSendMessage('yes')}
                    >
                      {isBookingInProgress ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isLoading || isBookingInProgress}
                      onClick={() => handleSendMessage('no')}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about vaccinations, appointments, or child care..."
                  disabled={isLoading || isBookingInProgress}
                  className="min-h-[44px] max-h-[120px] flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                  rows={1}
                />
                <GeminiLiveSession
                  chatContext={chatContext}
                  onTranscriptUpdate={(userText, botText) => {
                    if (userText) {
                      handleSendMessage(userText, botText)
                    } else if (botText) {
                      addAssistantMessage(botText)
                    }
                  }}
                  enabled={isChatOpen}
                />

                <Button 
                  onClick={() => handleSendMessage()} 
                  disabled={!draft.trim() || isLoading || isBookingInProgress}
                  size="icon"
                  className="size-11 shrink-0 rounded-xl"
                >
                  {isLoading || isBookingInProgress ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Press Enter to send • Shift+Enter for new line
              </p>
              {bookingActive && (
                <p className="mt-1 text-xs text-primary">
                  Appointment booking in progress • type "cancel booking" to stop.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
          <Button asChild variant="secondary" className="gap-2">
            <a href="tel:+233301234567" aria-label="Call the clinic">
              <PhoneCall className="size-4" /> Call nurse
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
