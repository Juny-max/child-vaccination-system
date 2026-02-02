"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
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
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const lastTranscriptRef = useRef<{text: string; ts: number} | null>(null)
  const bestVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  // Select the best available voice for natural speech
  const selectBestVoice = () => {
    if (!('speechSynthesis' in window)) return null
    
    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null

    // Priority order: Google/Microsoft natural voices > Neural voices > Local English voices
    const priorities = [
      'Google UK English Female',
      'Google US English',
      'Microsoft Zira - English (United States)',
      'Microsoft David - English (United States)',
      'Samantha',
      'Karen',
      'Daniel',
      'Google UK English Male',
      'Microsoft Mark - English (United States)',
    ]

    // First try exact matches
    for (const priorityName of priorities) {
      const match = voices.find(v => v.name === priorityName && v.lang.startsWith('en'))
      if (match) return match
    }

    // Then try partial matches for high-quality voices
    const qualityKeywords = ['Google', 'Microsoft', 'Samantha', 'Karen', 'neural', 'premium']
    for (const keyword of qualityKeywords) {
      const match = voices.find(v => 
        v.name.toLowerCase().includes(keyword.toLowerCase()) && 
        v.lang.startsWith('en')
      )
      if (match) return match
    }

    // Fall back to any English voice
    return voices.find(v => v.lang.startsWith('en')) || voices[0]
  }

  // Load and cache voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return

    const loadVoices = () => {
      const voice = selectBestVoice()
      if (voice) {
        bestVoiceRef.current = voice
        setVoicesLoaded(true)
      }
    }

    // Voices might load asynchronously
    if (window.speechSynthesis.getVoices().length > 0) {
      loadVoices()
    }

    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recog: SpeechRecognition = new SpeechRecognition()
    recog.lang = 'en-US'
    recog.interimResults = false
    recog.maxAlternatives = 1
    recog.continuous = true  // Keep listening continuously

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

      // Stop recognition to avoid capturing responses or extra audio
      try { recog.stop() } catch (e) {}
      setIsActive(false)

      try {
        const aiResp = await sendMessageToGemini(transcript, messages, chatContext)
        onAssistantReply(aiResp)

        // Speak the response with enhanced voice quality
        if ('speechSynthesis' in window && voicesLoaded) {
          speakText(aiResp)
        }
      } catch (err) {
        console.error('LiveAudio session error:', err)
        // Provide fallback response
        const fallbackMsg = "I'm having trouble processing that right now. Please try again in a moment, or check your dashboard for information."
        onAssistantReply(fallbackMsg)
        if ('speechSynthesis' in window && voicesLoaded) {
          speakText(fallbackMsg)
        }
      } finally {
        setIsProcessing(false)
      }
    }

    recog.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      
      // Don't stop on "no-speech" or "audio-capture" - these are temporary
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        // Auto-restart if still active
        if (isActive && recognitionRef.current) {
          try {
            setTimeout(() => {
              if (isActive && recognitionRef.current) {
                recognitionRef.current.start()
              }
            }, 100)
          } catch (e) {}
        }
        return
      }
      
      // For other errors, stop
      setIsActive(false)
      setIsProcessing(false)
    }

    recog.onend = () => {
      // Auto-restart if user hasn't manually stopped and not processing
      if (isActive && !isProcessing && recognitionRef.current) {
        try {
          setTimeout(() => {
            if (isActive && !isProcessing && recognitionRef.current) {
              recognitionRef.current.start()
            }
          }, 100)
        } catch (e) {
          setIsActive(false)
        }
      } else {
        setIsActive(false)
      }
    }

    recognitionRef.current = recog

    return () => {
      try { recognitionRef.current?.stop() } catch (e) {}
      try { window.speechSynthesis.cancel() } catch (e) {}
      recognitionRef.current = null
    }
  }, [messages, chatContext, onAssistantReply, voicesLoaded, isProcessing, isActive])

  // Enhanced text-to-speech function
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return

    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel()
      
      setIsSpeaking(true)

      const utterance = new SpeechSynthesisUtterance(text)
      
      // Use the best available voice
      if (bestVoiceRef.current) {
        utterance.voice = bestVoiceRef.current
      }

      // Enhanced speech parameters for natural sound
      utterance.rate = 0.95          // Slightly slower for clarity (0.9-1.0 is natural)
      utterance.pitch = 1.0          // Normal pitch
      utterance.volume = 1.0         // Full volume

      // Add pauses at punctuation for natural flow
      utterance.text = text
        .replace(/\./g, '.\u200B ')  // Zero-width space for micro-pause
        .replace(/,/g, ',\u200B ')
        .replace(/;/g, ';\u200B ')

      utterance.onend = () => {
        setIsSpeaking(false)
      }

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event)
        setIsSpeaking(false)
      }

      window.speechSynthesis.speak(utterance)
    } catch (e) {
      console.error('Error in speakText:', e)
      setIsSpeaking(false)
    }
  }

  const start = async () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.')
      return
    }
    
    if (!voicesLoaded) {
      alert('Voice system is still loading. Please try again in a moment.')
      return
    }

    try {
      // Cancel any playing speech and ensure not processing
      try { window.speechSynthesis.cancel() } catch(e) {}
      setIsSpeaking(false)
      setIsProcessing(false)
      setIsActive(true)
      recognitionRef.current.start()
    } catch (e) {
      console.error('Failed to start recognition:', e)
      setIsActive(false)
      alert('Could not start voice input. Please check your microphone permissions.')
    }
  }

  const stop = () => {
    setIsActive(false)  // Set this first to prevent auto-restart
    try { recognitionRef.current?.stop() } catch (e) {}
    try { window.speechSynthesis.cancel() } catch (e) {}
    setIsProcessing(false)
    setIsSpeaking(false)
  }

  if (!enabled) return null

  const isWorking = isActive || isProcessing || isSpeaking
  const buttonColor = isSpeaking 
    ? 'bg-blue-600 ring-4 ring-blue-300/30' 
    : isActive 
      ? 'bg-red-600 ring-4 ring-red-300/30 pulse' 
      : 'bg-green-600 hover:bg-green-700'
  
  const Icon = isSpeaking ? Volume2 : isActive ? MicOff : Mic
  const buttonTitle = isSpeaking 
    ? 'AI is speaking...' 
    : isActive 
      ? 'Listening... (Click to stop)' 
      : 'Start voice chat'

  return (
    <div className="relative">
      <button
        onClick={isWorking ? stop : start}
        disabled={isProcessing && !isActive && !isSpeaking}
        aria-pressed={isActive}
        title={buttonTitle}
        className={`size-11 shrink-0 rounded-xl flex items-center justify-center transition-all duration-150 shadow-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${buttonColor}`}>
        <Icon size={18} className="text-white" />
      </button>
      {isProcessing && (
        <div className="absolute -top-1 -right-1 size-3 bg-yellow-400 rounded-full animate-pulse" />
      )}
      <style jsx>{`
        @keyframes pulse-ring {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        .pulse {
          animation: pulse-ring 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

export default LiveAudioSession
