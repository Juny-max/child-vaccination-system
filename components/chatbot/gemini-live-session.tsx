"use client"

import React from "react"

type Props = {
  chatContext?: any
  onTranscriptUpdate?: (userText?: string, botText?: string) => void
  enabled?: boolean
}

export default function GeminiLiveSession({ chatContext, onTranscriptUpdate, enabled = false }: Props) {
  // This is a lightweight shim used during development when the full
  // Gemini integration is not available. It intentionally renders
  // nothing unless `enabled` is true so it won't affect layouts.
  if (!enabled) return null

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-md px-3 py-2 text-xs bg-muted"
        onClick={() => onTranscriptUpdate?.("", "")}
        aria-label="Start live session"
      >
        Start live session
      </button>
    </div>
  )
}
