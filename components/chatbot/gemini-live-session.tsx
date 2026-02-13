"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { type ChatContext } from '@/lib/chatbot'

// Constants
const SAMPLE_RATE_IN = 16000
const SAMPLE_RATE_OUT = 24000

enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
}

interface Props {
  chatContext: ChatContext
  onTranscriptUpdate: (userText: string, botText: string) => void
  enabled?: boolean
}

// Audio utility functions
function encode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
}

function decode(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

async function decodeAudioData(
  pcmData: Uint8Array,
  context: AudioContext,
  sampleRate: number,
  numChannels: number
): Promise<AudioBuffer> {
  const samples = new Int16Array(pcmData.buffer)
  const audioBuffer = context.createBuffer(numChannels, samples.length, sampleRate)
  const channelData = audioBuffer.getChannelData(0)
  
  for (let i = 0; i < samples.length; i++) {
    channelData[i] = samples[i] / 32768
  }
  
  return audioBuffer
}

const GeminiLiveSession: React.FC<Props> = ({ chatContext, onTranscriptUpdate, enabled = true }) => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Refs for audio processing
  const audioContexts = useRef<{ in: AudioContext; out: AudioContext } | null>(null)
  const nextStartTime = useRef(0)
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set())
  const sessionRef = useRef<any>(null)
  const currentInputTranscription = useRef('')
  const currentOutputTranscription = useRef('')
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)

  const cleanupAudio = useCallback(() => {
    sources.current.forEach(s => s.stop())
    sources.current.clear()

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect()
      scriptProcessorRef.current = null
    }

    nextStartTime.current = 0
    setIsSpeaking(false)
  }, [])

  const stopConversation = useCallback(() => {
    isStoppingRef.current = true
    if (sessionRef.current) {
      sessionRef.current.close()
      sessionRef.current = null
    }
    cleanupAudio()
    setStatus(ConnectionStatus.DISCONNECTED)
  }, [])

  const startConversation = async () => {
    try {
      if (isStartingRef.current || status === ConnectionStatus.CONNECTED) return
      isStartingRef.current = true
      isStoppingRef.current = false
      setStatus(ConnectionStatus.CONNECTING)
      setError(null)

      // Audio feature temporarily disabled for security
      // TODO: Implement backend WebSocket proxy for secure audio streaming
      throw new Error('Audio chat is temporarily unavailable. Please use the text chat feature.')

      /* Audio feature code disabled - API key moved to backend for security
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY
      if (!apiKey || apiKey === 'your-gemini-api-key-here') {
        throw new Error('Gemini API key not configured')
      }
      */

      // Initialize API
      const ai = new GoogleGenAI({ apiKey })

      // Initialize Audio Contexts
      if (!audioContexts.current) {
        audioContexts.current = {
          in: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_IN }),
          out: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_OUT })
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      // Build context for system instruction
      const childrenInfo = chatContext.children.map(c => 
        `${c.name} (${c.age}): ${c.completedVaccinations}/${c.totalVaccinations} vaccinations completed (${c.completionPercentage}%)`
      ).join(', ')
      
      const missedInfo = chatContext.missedVaccinations.length > 0
        ? `Missed: ${chatContext.missedVaccinations.map(m => `${m.childName} - ${m.vaccine} (${m.daysOverdue} days overdue)`).join(', ')}`
        : 'No missed vaccinations'

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are Sarah, a warm and empathetic pediatric nurse assistant for the Ghana Child Vaccination Command Center. You're helping ${chatContext.parentName}.

PARENT'S CHILDREN: ${childrenInfo || 'No children registered yet'}
${missedInfo}

GUIDELINES:
- Be concise and conversational (1-2 sentences max)
- Use contractions naturally ("don't", "it's", "we'll")
- Show empathy and warmth
- Provide specific, actionable advice
- For emergencies, advise immediate clinical care
- Keep responses SHORT for real-time speech

Remember: This is a live voice conversation. Be brief, warm, and helpful.`,
        },
        callbacks: {
          onopen: () => {
            if (isStoppingRef.current) return
            setStatus(ConnectionStatus.CONNECTED)
            
            // Microphone stream to model
            const source = audioContexts.current!.in.createMediaStreamSource(stream)
            const scriptProcessor = audioContexts.current!.in.createScriptProcessor(4096, 1, 1)
            scriptProcessorRef.current = scriptProcessor
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0)
              const l = inputData.length
              const int16 = new Int16Array(l)
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              }
              
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob })
              })
            }

            source.connect(scriptProcessor)
            scriptProcessor.connect(audioContexts.current!.in.destination)
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcriptions
            if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text
            }
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text
            }
            
            if (message.serverContent?.turnComplete) {
              const userText = currentInputTranscription.current
              const botText = currentOutputTranscription.current
              
              if (userText || botText) {
                onTranscriptUpdate(userText, botText)
              }
              
              currentInputTranscription.current = ''
              currentOutputTranscription.current = ''
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data
            if (base64Audio) {
              setIsSpeaking(true)
              const outCtx = audioContexts.current!.out
              nextStartTime.current = Math.max(nextStartTime.current, outCtx.currentTime)
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, SAMPLE_RATE_OUT, 1)
              const sourceNode = outCtx.createBufferSource()
              sourceNode.buffer = audioBuffer
              sourceNode.connect(outCtx.destination)
              
              sourceNode.addEventListener('ended', () => {
                sources.current.delete(sourceNode)
                if (sources.current.size === 0) setIsSpeaking(false)
              })

              sourceNode.start(nextStartTime.current)
              nextStartTime.current += audioBuffer.duration
              sources.current.add(sourceNode)
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              sources.current.forEach(s => s.stop())
              sources.current.clear()
              setIsSpeaking(false)
              nextStartTime.current = 0
            }
          },
          onerror: (e) => {
            console.warn('Gemini Live API Error:', e)
            setError('Connection lost. Please try again.')
            stopConversation()
          },
          onclose: () => {
            cleanupAudio()
            setStatus(ConnectionStatus.DISCONNECTED)
          }
        }
      })

      sessionRef.current = await sessionPromise
    } catch (err: any) {
      console.error('Failed to start Gemini Live:', err)
      setError(err.message || 'Failed to start microphone or connection.')
      setStatus(ConnectionStatus.DISCONNECTED)
      cleanupAudio()
    } finally {
      isStartingRef.current = false
    }
  }

  useEffect(() => {
    if (!enabled && status !== ConnectionStatus.DISCONNECTED) {
      stopConversation()
    }
  }, [enabled, status, stopConversation])

  useEffect(() => {
    return () => {
      stopConversation()
    }
  }, [stopConversation])

  if (!enabled) return null

  const isConnected = status === ConnectionStatus.CONNECTED
  const isConnecting = status === ConnectionStatus.CONNECTING
  const buttonColor = isSpeaking 
    ? 'bg-blue-600 ring-4 ring-blue-300/30' 
    : isConnected 
      ? 'bg-red-600 ring-4 ring-red-300/30 animate-pulse' 
      : 'bg-green-600 hover:bg-green-700'
  
  const Icon = isSpeaking ? Volume2 : isConnected ? MicOff : Mic
  const buttonTitle = isSpeaking 
    ? 'AI is speaking...' 
    : isConnected 
      ? 'Listening... (Click to stop)' 
      : 'Click to start voice conversation'

  return (
    <div className="flex flex-col items-center gap-4">
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}
      
      <button
        onClick={isConnected ? stopConversation : startConversation}
        disabled={isConnecting}
        className={`relative w-16 h-16 rounded-full ${buttonColor} text-white shadow-2xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
        title={buttonTitle}
      >
        {isConnecting ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <Icon className="w-7 h-7 mx-auto" />
        )}
        
        {isConnected && !isSpeaking && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        )}
      </button>

      {isConnecting && (
        <div className="absolute top-20 bg-white/5 backdrop-blur px-3 py-1.5 rounded-full text-xs text-white/70">
          Connecting to AI...
        </div>
      )}
      
      {isSpeaking && (
        <div className="absolute top-20 bg-blue-500/10 backdrop-blur px-3 py-1.5 rounded-full text-xs text-blue-400 animate-pulse">
          AI speaking...
        </div>
      )}
    </div>
  )
}

export default GeminiLiveSession
