import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

type LiveAudioMessage =
  | { type: 'start'; context?: any }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'stop' };

type LiveAudioServerMessage =
  | { type: 'ready' }
  | { type: 'audio'; data: string; mimeType: string }
  | { type: 'input_transcript'; text: string }
  | { type: 'output_transcript'; text: string }
  | { type: 'turn_complete' }
  | { type: 'error'; message: string };

function buildSystemInstruction(context?: any): string {
  const parentName = context?.parentName || 'the parent';
  const children = Array.isArray(context?.children) ? context.children : [];
  const missed = Array.isArray(context?.missedVaccinations)
    ? context.missedVaccinations
    : [];

  const childrenInfo = children.length
    ? children
        .map(
          (c: any) =>
            `${c.name || 'Child'} (${c.age || 'age'}): ${c.completedVaccinations || 0}/${c.totalVaccinations || 0} vaccinations completed (${c.completionPercentage || 0}%)`,
        )
        .join(', ')
    : 'No children registered yet';

  const missedInfo = missed.length
    ? `Missed: ${missed
        .map(
          (m: any) =>
            `${m.childName || 'Child'} - ${m.vaccine || 'Vaccine'} (${m.daysOverdue || 0} days overdue)`,
        )
        .join(', ')}`
    : 'No missed vaccinations';

  return `You are Sarah, a warm and empathetic pediatric nurse assistant for the Ghana Child Vaccination Command Center. You are helping ${parentName}.

PARENT'S CHILDREN: ${childrenInfo}
${missedInfo}

GUIDELINES:
- Be concise and conversational (1-2 sentences max)
- Use contractions naturally ("don't", "it's", "we'll")
- Sound calm, caring, and human (not robotic)
- Provide specific, actionable advice
- For emergencies, advise immediate clinical care
- Keep responses SHORT for real-time speech

Remember: This is a live voice conversation. Be brief, warm, and helpful.`;
}

export class LiveAudioWsServer {
  private wss: WebSocketServer;

  constructor(httpServer: any) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws/live-audio' });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
  }

  private handleConnection(ws: WebSocket) {
    const apiKey = process.env.GEMINI_API_KEY || '';

    if (!apiKey) {
      const msg: LiveAudioServerMessage = {
        type: 'error',
        message: 'Gemini API key not configured on server.',
      };
      ws.send(JSON.stringify(msg));
      ws.close();
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    let sessionPromise: Promise<any> | null = null;
    let sessionClosed = false;

    ws.on('message', async (raw) => {
      let parsed: LiveAudioMessage | null = null;

      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        const msg: LiveAudioServerMessage = {
          type: 'error',
          message: 'Invalid JSON message.',
        };
        ws.send(JSON.stringify(msg));
        return;
      }

      if (!parsed) return;

      if (parsed.type === 'start') {
        if (sessionPromise) return;

        const systemInstruction = buildSystemInstruction(parsed.context);

        sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction,
          },
          callbacks: {
            onopen: () => {
              const msg: LiveAudioServerMessage = { type: 'ready' };
              ws.send(JSON.stringify(msg));
            },
            onmessage: (message: LiveServerMessage) => {
              if (sessionClosed) return;

              if (message.serverContent?.inputTranscription?.text) {
                const msg: LiveAudioServerMessage = {
                  type: 'input_transcript',
                  text: message.serverContent.inputTranscription.text,
                };
                ws.send(JSON.stringify(msg));
              }

              if (message.serverContent?.outputTranscription?.text) {
                const msg: LiveAudioServerMessage = {
                  type: 'output_transcript',
                  text: message.serverContent.outputTranscription.text,
                };
                ws.send(JSON.stringify(msg));
              }

              const part = message.serverContent?.modelTurn?.parts?.[0];
              const inlineData = part?.inlineData;

              if (inlineData?.data && inlineData?.mimeType) {
                const msg: LiveAudioServerMessage = {
                  type: 'audio',
                  data: inlineData.data,
                  mimeType: inlineData.mimeType,
                };
                ws.send(JSON.stringify(msg));
              }

              if (message.serverContent?.turnComplete) {
                const msg: LiveAudioServerMessage = { type: 'turn_complete' };
                ws.send(JSON.stringify(msg));
              }
            },
            onerror: (err: any) => {
              if (sessionClosed) return;
              const msg: LiveAudioServerMessage = {
                type: 'error',
                message: err?.message || 'Live session error',
              };
              ws.send(JSON.stringify(msg));
            },
            onclose: () => {
              sessionClosed = true;
            },
          },
        });

        return;
      }

      if (parsed.type === 'audio') {
        if (!sessionPromise) return;
        const media = { data: (parsed as any).data, mimeType: (parsed as any).mimeType };
        sessionPromise.then((session) => {
          if (sessionClosed) return;
          session.sendRealtimeInput({ media });
        });
        return;
      }

      if (parsed.type === 'stop') {
        if (!sessionPromise) return;
        sessionPromise.then((session) => {
          sessionClosed = true;
          session.close();
        });
      }
    });

    ws.on('close', () => {
      if (!sessionPromise) return;
      sessionPromise.then((session) => {
        sessionClosed = true;
        session.close();
      });
    });
  }
}