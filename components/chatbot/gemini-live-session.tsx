"use client"

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Mic, MicOff, Volume2 } from 'lucide-react'
import { type ChatContext } from '@/lib/chatbot'

const SAMPLE_RATE_IN = 16000
const DEFAULT_SAMPLE_RATE_OUT = 24000

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

type ServerMessage =
  | { type: 'ready' }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'input_transcript'; text: string }
  | { type: 'output_transcript'; text: string }
  | { type: 'turn_complete' }
  | { type: 'error'; message: string }

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

function extractSampleRate(mimeType: string): number {
  const match = mimeType.match(/rate=(\d+)/)
  if (!match) return DEFAULT_SAMPLE_RATE_OUT
  const rate = Number(match[1])
  return Number.isFinite(rate) ? rate : DEFAULT_SAMPLE_RATE_OUT
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

  const wsRef = useRef<WebSocket | null>(null)
  const audioContexts = useRef<{ in: AudioContext; out: AudioContext } | null>(null)
  const nextStartTime = useRef(0)
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set())
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const isStartingRef = useRef(false)
  const isStoppingRef = useRef(false)
  const currentInputTranscription = useRef('')
  const currentOutputTranscription = useRef('')

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

    if (audioContexts.current) {
      audioContexts.current.in.close()
      audioContexts.current.out.close()
      audioContexts.current = null
    }

    nextStartTime.current = 0
    setIsSpeaking(false)
  }, [])

  const stopConversation = useCallback(() => {
    isStoppingRef.current = true

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    cleanupAudio()
    setStatus(ConnectionStatus.DISCONNECTED)
  }, [cleanupAudio])

  const handleServerMessage = useCallback(
    async (message: ServerMessage) => {
      if (message.type === 'error') {
        setError(message.message)
        stopConversation()
        return
      }

      if (message.type === 'input_transcript') {
        currentInputTranscription.current += message.text
        return
      }

      if (message.type === 'output_transcript') {
        currentOutputTranscription.current += message.text
        return
      }

      if (message.type === 'turn_complete') {
        const userText = currentInputTranscription.current
        const botText = currentOutputTranscription.current

        if (userText || botText) {
          onTranscriptUpdate(userText, botText)
        }

        currentInputTranscription.current = ''
        currentOutputTranscription.current = ''
        return
      }

      if (message.type === 'audio') {
        const outCtx = audioContexts.current?.out
        if (!outCtx) return

        setIsSpeaking(true)
        nextStartTime.current = Math.max(nextStartTime.current, outCtx.currentTime)

        const sampleRate = extractSampleRate(message.mimeType)
        const audioBuffer = await decodeAudioData(
          decode(message.data),
          outCtx,
          sampleRate,
          1
        )

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
    },
    [onTranscriptUpdate, stopConversation]
  )

  const startConversation = async () => {
    try {
      if (isStartingRef.current || status === ConnectionStatus.CONNECTED) return
      isStartingRef.current = true
      isStoppingRef.current = false
      setStatus(ConnectionStatus.CONNECTING)
      setError(null)

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
      const baseUrl = API_URL.replace(/\/api\/?$/, '')
      const wsUrl = baseUrl.replace(/^http/, 'ws')
      const socket = new WebSocket(`${wsUrl}/ws/live-audio`)
      wsRef.current = socket

      socket.onopen = async () => {
        if (isStoppingRef.current) return

        if (!audioContexts.current) {
          audioContexts.current = {
            in: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_IN }),
            out: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: DEFAULT_SAMPLE_RATE_OUT })
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaStreamRef.current = stream

        socket.send(JSON.stringify({ type: 'start', context: chatContext }))

        const source = audioContexts.current.in.createMediaStreamSource(stream)
        const scriptProcessor = audioContexts.current.in.createScriptProcessor(4096, 1, 1)
        scriptProcessorRef.current = scriptProcessor

        scriptProcessor.onaudioprocess = (e) => {
          if (socket.readyState !== WebSocket.OPEN) return
          const inputData = e.inputBuffer.getChannelData(0)
          const l = inputData.length
          const int16 = new Int16Array(l)
          for (let i = 0; i < l; i++) {
            int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32768
          }
          const pcmBlob = {
            type: 'audio',
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
          }
          socket.send(JSON.stringify(pcmBlob))
        }

        source.connect(scriptProcessor)
        scriptProcessor.connect(audioContexts.current.in.destination)

        setStatus(ConnectionStatus.CONNECTED)
      }

      socket.onmessage = async (event) => {
        let parsed: ServerMessage | null = null
        try {
          parsed = JSON.parse(event.data)
        } catch {
          return
        }

        if (!parsed) return
        await handleServerMessage(parsed)
      }

      socket.onerror = () => {
        setError('Connection error. Please try again.')
        stopConversation()
      }

      socket.onclose = () => {
        cleanupAudio()
        setStatus(ConnectionStatus.DISCONNECTED)
      }
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
          Connecting to live AI...
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
