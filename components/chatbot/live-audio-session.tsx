"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { sendMessageToGemini, type ChatMessage, type ChatContext } from '@/lib/chatbot'

interface Props {
  messages: ChatMessage[]
  chatContext: ChatContext
  onAssistantReply: (text: string) => void
  enabled?: boolean
}

const LiveAudioSession: React.FC<Props> = ({ messages, chatContext, onAssistantReply, enabled = true }) => {
  const [isActive, setIsActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const lastTranscriptRef = useRef<{text: string; ts: number} | null>(null)

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recog: SpeechRecognition = new SpeechRecognition()
    recog.lang = 'en-US'
    recog.interimResults = false
    recog.maxAlternatives = 1

    recog.onresult = async (ev: SpeechRecognitionEvent) => {
      const transcript = ev.results[0][0].transcript?.trim()
      if (!transcript) return

      // Ignore repeated identical transcripts within short interval
      const now = Date.now()
      if (lastTranscriptRef.current && lastTranscriptRef.current.text === transcript && (now - lastTranscriptRef.current.ts) < 3000) {
        return
      }
      lastTranscriptRef.current = { text: transcript, ts: now }

      if (isProcessing) return

      setIsProcessing(true)

      // stop recognition to avoid capturing responses or extra audio
      try { recog.stop() } catch (e) {}
      setIsActive(false)

      try {
        const aiResp = await sendMessageToGemini(transcript, messages, chatContext)
        onAssistantReply(aiResp)

        if ('speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel()
            const utter = new SpeechSynthesisUtterance(aiResp)
            utter.onend = () => { /* ready for next input if user taps */ }
            window.speechSynthesis.speak(utter)
          } catch (e) {}
        }
      } catch (err) {
        console.error('LiveAudio session error:', err)
      } finally {
        setIsProcessing(false)
      }
    }

    recog.onend = () => {
      if (isActive) setIsActive(false)
    }

    recognitionRef.current = recog

    return () => {
      try { recognitionRef.current?.stop() } catch (e) {}
      recognitionRef.current = null
    }
  }, [])

  const start = async () => {
    if (!recognitionRef.current) return alert('Speech recognition not supported in this browser')
    try {
      // cancel any playing speech and ensure not processing
      try { window.speechSynthesis.cancel() } catch(e) {}
      setIsProcessing(false)
      setIsActive(true)
      recognitionRef.current.start()
    } catch (e) {
      console.error(e)
      setIsActive(false)
    }
  }

  const stop = () => {
    try { recognitionRef.current?.stop() } catch (e) {}
    try { window.speechSynthesis.cancel() } catch (e) {}
    setIsActive(false)
    setIsProcessing(false)
  }

  if (!enabled) return null

  return (
    <button
      onClick={isActive ? stop : start}
      aria-pressed={isActive}
      title={isActive ? 'Stop voice session' : 'Start voice session'}
      className={`size-11 shrink-0 rounded-xl flex items-center justify-center transition-all duration-150 shadow-sm focus:outline-none ${isActive ? 'bg-red-600 ring-4 ring-red-300/30' : 'bg-green-600 hover:bg-green-700'}`}>
      {isActive ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-white" />}
    </button>
  )
}

export default LiveAudioSession
