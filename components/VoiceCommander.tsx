import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from "@google/genai";
import { Vulnerability, StrategicInsight } from '../types';

interface VoiceCommanderProps {
  apiKey: string | undefined;
  vulnerabilities: Vulnerability[];
  latestInsight: StrategicInsight | null;
  onExecuteRemediation: () => void;
}

const VoiceCommander: React.FC<VoiceCommanderProps> = ({ 
  apiKey, 
  vulnerabilities, 
  latestInsight, 
  onExecuteRemediation 
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for audio context and processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Audio playback queue management
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Define the tool for remediation
  const tools: FunctionDeclaration[] = [
    {
      name: 'execute_remediation',
      description: 'Executes the remediation protocol to fix the identified vulnerability or risk. Call this when the user says "fix it", "execute", "remediate", or "approve".',
      parameters: {
        type: Type.OBJECT,
        properties: {
          confirmation: {
            type: Type.STRING,
            description: "Confirmation message"
          }
        }
      }
    }
  ];

  const stopSession = () => {
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
        outputAudioContextRef.current.close();
        outputAudioContextRef.current = null;
    }
    // Note: There is no explicit .close() method on the session object in the current SDK types shown in prompt,
    // but closing the AudioContext and setting active to false effectively stops the flow.
    // Ideally we would call session.close() if available.
    setIsActive(false);
    setIsSpeaking(false);
    sessionPromiseRef.current = null;
  };

  const startSession = async () => {
    if (!apiKey) {
      setError("No API Key");
      return;
    }
    
    try {
      setIsActive(true);
      setError(null);

      const ai = new GoogleGenAI({ apiKey });
      
      // Audio Setup
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const inputContext = audioContextRef.current;
      inputSourceRef.current = inputContext.createMediaStreamSource(stream);
      processorRef.current = inputContext.createScriptProcessor(4096, 1, 1);
      
      nextStartTimeRef.current = 0;

      // Prepare Initial Context
      let systemContext = `You are "AI Sentinel", an elite security operations AI. 
      You are concise, professional, and authoritative.
      Speak in Chinese (Mandarin).
      
      Current System Status:
      ${vulnerabilities.length} active vulnerabilities.`;
      
      if (latestInsight) {
        systemContext += `\nCritical Alert: ${latestInsight.title}. \nSummary: ${latestInsight.content}.\nRecommendation: ${latestInsight.recommendation}`;
      } else {
        systemContext += `\nNo critical strategic insights at the moment.`;
      }

      systemContext += `\n\nIf the user asks "What is happening?" or "What should I do?", summarize the Critical Alert above.
      If the user says "Fix it" or "Remediate", call the 'execute_remediation' function.`;

      // Connect
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: tools }],
          systemInstruction: systemContext,
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connected");
            // Setup Input Streaming
            if (processorRef.current && inputSourceRef.current && audioContextRef.current) {
                processorRef.current.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    // Convert Float32 to PCM 16-bit
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        pcmData[i] = inputData[i] * 32768;
                    }
                    const uint8Data = new Uint8Array(pcmData.buffer);
                    const base64Data = btoa(String.fromCharCode.apply(null, Array.from(uint8Data)));
                    
                    sessionPromise.then(session => {
                        session.sendRealtimeInput({
                            media: {
                                mimeType: 'audio/pcm;rate=16000',
                                data: base64Data
                            }
                        });
                    });
                };
                inputSourceRef.current.connect(processorRef.current);
                processorRef.current.connect(audioContextRef.current.destination);
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
             // Handle Function Calls
             if (msg.toolCall) {
                console.log("Tool Call Received:", msg.toolCall);
                for (const fc of msg.toolCall.functionCalls) {
                    if (fc.name === 'execute_remediation') {
                        onExecuteRemediation();
                        
                        // Send response back
                        sessionPromise.then(session => {
                            session.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: "Remediation protocol initiated." }
                                }
                            });
                        });
                    }
                }
             }

             // Handle Audio Output
             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData && outputAudioContextRef.current) {
                 setIsSpeaking(true);
                 const ctx = outputAudioContextRef.current;
                 const binaryString = atob(audioData);
                 const bytes = new Uint8Array(binaryString.length);
                 for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                 }
                 
                 // Decode PCM 16-bit 24kHz
                 const dataInt16 = new Int16Array(bytes.buffer);
                 const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
                 const channelData = buffer.getChannelData(0);
                 for (let i = 0; i < dataInt16.length; i++) {
                     channelData[i] = dataInt16[i] / 32768.0;
                 }

                 const source = ctx.createBufferSource();
                 source.buffer = buffer;
                 source.connect(ctx.destination);
                 
                 // Schedule playback
                 const currentTime = ctx.currentTime;
                 const startTime = Math.max(currentTime, nextStartTimeRef.current);
                 source.start(startTime);
                 nextStartTimeRef.current = startTime + buffer.duration;
                 
                 audioSourcesRef.current.add(source);
                 source.onended = () => {
                     audioSourcesRef.current.delete(source);
                     if (audioSourcesRef.current.size === 0) {
                         setIsSpeaking(false);
                     }
                 };
             }
          },
          onclose: () => {
             console.log("Gemini Live Closed");
             setIsActive(false);
          },
          onerror: (err) => {
             console.error("Gemini Live Error", err);
             setError("Connection Error");
             setIsActive(false);
          }
        }
      });
      
      sessionPromiseRef.current = sessionPromise;

    } catch (e: any) {
        console.error(e);
        setError(e.message);
        setIsActive(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {error && (
        <div className="bg-red-500/90 text-white text-xs px-3 py-1 rounded shadow-lg animate-in fade-in slide-in-from-bottom-2">
            {error}
        </div>
      )}
      
      <button
        onClick={isActive ? stopSession : startSession}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
            isActive 
            ? 'bg-rose-500 hover:bg-rose-600 scale-110' 
            : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105'
        } border-2 border-slate-700/50`}
      >
        {isActive && (
            <span className="absolute inset-0 rounded-full animate-ping bg-rose-500 opacity-20"></span>
        )}
        
        {isActive ? (
             <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
        ) : (
             <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
             </svg>
        )}
        
        {/* Active Indicator Ring */}
        {isActive && isSpeaking && (
            <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 opacity-70 animate-pulse"></span>
        )}
      </button>
      
      {isActive && (
          <div className="bg-slate-900/90 backdrop-blur text-slate-200 text-xs px-3 py-1 rounded-full border border-slate-700 shadow-lg">
             {isSpeaking ? "AI Sentinel Speaking..." : "Listening..."}
          </div>
      )}
    </div>
  );
};

export default VoiceCommander;