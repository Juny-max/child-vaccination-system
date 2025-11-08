'use client'

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { chatbotPrompts } from "../data"
import { MessageCircle, PhoneCall, ShieldCheck, Sparkles } from "lucide-react"

export default function SupportPage() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages)
  const [draft, setDraft] = useState("")

  const helperMessage = useMemo(() => {
    return "I can guide you on upcoming vaccines, reminders, and post-care tips."
  }, [])

  const handleLaunchChatbot = () => {
    setIsChatOpen(true)
  }

  const handleSendMessage = () => {
    const trimmed = draft.trim()
    if (!trimmed) return

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: "parent", text: trimmed },
      {
        id: Date.now() + 1,
        sender: "assistant",
        text: "Thanks for reaching out! A public health nurse will review this conversation shortly.",
      },
    ])
    setDraft("")
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/10 via-secondary/10 to-muted">
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge variant="secondary" className="mb-2 inline-flex items-center gap-1">
              <Sparkles className="size-3" /> 24/7 assistance
            </Badge>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <MessageCircle className="size-6" /> Vaccination assistant
            </CardTitle>
            <CardDescription>
              Ask questions, request reminders, and get help planning Ama&apos;s vaccination journey.
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" className="gap-2" onClick={handleLaunchChatbot}>
            <MessageCircle className="size-4" /> Launch chatbot
          </Button>
        </CardHeader>
      </Card>

      {isChatOpen ? (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">Chat session</CardTitle>
              <CardDescription>{helperMessage}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsChatOpen(false)}>
              Close
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/40 p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    message.sender === "assistant"
                      ? "bg-background text-foreground"
                      : "ml-auto bg-primary text-primary-foreground",
                  )}
                >
                  {message.text}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask the assistant about Ama's care..."
                className="min-h-[60px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <Button className="gap-2" onClick={handleSendMessage}>
                <MessageCircle className="size-4" /> Send
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This is a guided preview. Real-time chat will connect to the clinic support team in the backend phase.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How the assistant helps</CardTitle>
            <CardDescription>Get tailored guidance for Ama&apos;s health needs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">Smart reminders</p>
              <p>Receive reminders before upcoming doses and follow-up calls after appointments.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">Post-vaccination care</p>
              <p>Get advice on managing fever, swelling, or allergic reactions within minutes.</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="font-semibold text-foreground">Profile updates</p>
              <p>Ask how to update Ama&apos;s allergy information, caregiver contacts, and facility preferences.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Suggested questions</CardTitle>
            <CardDescription>Try one of these to get started quickly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {chatbotPrompts.map((prompt) => (
              <div key={prompt} className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                {prompt}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-5" /> Need human support instead?
          </CardTitle>
          <CardDescription>Reach your primary care team directly.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">Accra Central Health Center</p>
            <p>Support line: +233 30 123 4567 (Mon – Fri, 8:00 AM – 5:00 PM)</p>
          </div>
          <Button variant="outline" className="gap-2">
            <PhoneCall className="size-4" /> Call the clinic
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

type ChatMessage = {
  id: number
  sender: "assistant" | "parent"
  text: string
}

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    sender: "assistant",
    text: "Hello Ama's caregiver! I'm here to help with vaccination schedules, reminders, and post-care guidance.",
  },
  {
    id: 2,
    sender: "assistant",
    text: "Tap \"Launch chatbot\" to ask questions or request reminders. In production this will connect to your clinic's support team.",
  },
]
