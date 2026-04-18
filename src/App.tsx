/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Specchio dell'Anima - Ispirato da Stefano Rossi
 */
import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Mic, MicOff, Volume2, Sparkles, Camera, CameraOff, ChevronRight, RotateCcw, Settings, Heart, Lightbulb, Save, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Message {
  role: 'user' | 'model' | 'error';
  it: string;
  nl: string;
  insight?: string;
}

const SYSTEM_PROMPT = `Sei lo "Specchio dell'Anima", un mentore empatico ispirato alla psicologia di Stefano Rossi.
Il tuo obiettivo è aiutare l'utente a "illuminare i propri sogni" e navigare nel proprio mondo interiore.
REGOLE: 
1. Rispondi con UNA frase breve e profonda (max 15 parole).
2. Usa metafore legate alla luce, ai semi, ai labirinti o al coraggio.
3. Termina sempre con una domanda che invita alla riflessione personale.
4. Se l'utente commette errori grammaticali, correggili con estrema dolcezza usando ✏️.
Rispondi SOLO in formato JSON: {"it":"frase in italiano","nl":"traduzione olandese","insight":"una piccola parola chiave sul sentimento"}`;

export default function App() {
  const [isCamOn, setIsCamOn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [focus, setFocus] = useState('sogni');
  const [mood, setMood] = useState('riflessivo');
  const [score, setScore] = useState(0); // Rappresenta i "momenti di luce"
  const [status, setStatus] = useState('Pronto per illuminare · Klaar om te verlichten');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKey, setCustomKey] = useState(localStorage.getItem('rossi_mirror_api_key') || '');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getAI = () => new GoogleGenAI({ apiKey: customKey || process.env.GEMINI_API_KEY || "" });

  const saveCustomKey = (key: string) => {
    localStorage.setItem('rossi_mirror_api_key', key);
    setCustomKey(key);
    setShowKeyModal(false);
    setStatus('Chiave salvata! · Sleutel opgeslagen!');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const toggleCam = async () => {
    if (isCamOn) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setIsCamOn(false);
      setStatus('Specchio spento · Spiegel uit');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCamOn(true);
        setStatus('Lo specchio ti vede ✨ · De spiegel ziet je');
      } catch {
        setStatus('Accesso negato · Geen toegang');
      }
    }
  };

  const speakIt = async (text: string) => {
    if (!text) return;
    setIsSpeaking(true);
    try {
      const aiInstance = getAI();
      const response = await aiInstance.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } // Puck is warm/italiaans-achtig
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0)).buffer;
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      }
    } catch {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'it-IT';
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = 'it-IT';
    recognition.onstart = () => { setIsRecording(true); setStatus("Ti ascolto... · Ik luister..."); };
    recognition.onresult = (e: any) => { processHeard(e.results[0][0].transcript); };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const processHeard = async (heard: string) => {
    const userMsg: Message = { role: 'user', it: heard, nl: '', insight: 'riflessione' };
    setMessages(prev => [...prev, userMsg]);
    setScore(prev => prev + 1);
    generateAIResponse([...messages, userMsg]);
  };

  const generateAIResponse = async (history: Message[]) => {
    setIsThinking(true);
    const systemInstruction = `${SYSTEM_PROMPT}\nFocus attuale: ${focus}. Mood: ${mood}.`;
    
    try {
      const aiInstance = getAI();
      const contents = history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.role === 'user' ? m.it : JSON.stringify({ it: m.it, nl: m.nl }) }]
      }));

      const result = await aiInstance.models.generateContent({
        model: "gemini-2.0-flash",
        contents: contents.length ? contents : [{ role: 'user', parts: [{ text: 'Inizia il dialogo.' }] }],
        config: { systemInstruction, responseMimeType: "application/json" },
      });

      const data = JSON.parse(result.text || "{}");
      const aiMsg: Message = { role: 'model', it: data.it, nl: data.nl, insight: data.insight };
      setMessages(prev => [...prev, aiMsg]);
      setIsThinking(false);
      speakIt(aiMsg.it);
    } catch {
      setIsThinking(false);
      setStatus('Errore di connessione · Verbindingsfout');
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#05050a] text-[#e0e0f0] font-sans flex flex-col pb-8">
      <div className="flex flex-col max-w-md mx-auto w-full px-4 pt-4 relative z-10">

        <header className="text-center pb-6">
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="font-serif text-3xl font-light tracking-[0.2em] text-[#70a1ff] drop-shadow-[0_0_15px_rgba(112,161,255,0.4)]">
            Specchio Rossi
          </motion.h1>
          <p className="text-[0.6rem] tracking-[0.3em] uppercase text-[#70a1ff]/50 mt-2">
            Illumina i tuoi sogni
          </p>
        </header>

        <div className="relative flex items-center justify-center mb-8">
          <div className="relative w-full max-w-[220px] aspect-[4/5]">
            <div className="absolute inset-0 bg-gradient-to-b from-[#1e3799] to-[#0c2461] rounded-t-full rounded-b-lg p-1 shadow-[0_0_40px_rgba(30,55,153,0.3)]">
              <div className="w-full h-full bg-black rounded-t-full rounded-b-lg overflow-hidden relative border border-white/10">
                <video ref={videoRef} autoPlay playsInline muted
                  className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-1000 ${isCamOn ? 'opacity-60' : 'opacity-0'}`} />
                {!isCamOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                    <Heart className="w-10 h-10 text-[#70a1ff] mb-3 animate-pulse" />
                    <span className="text-[0.6rem] uppercase tracking-widest text-[#70a1ff]/40 leading-relaxed">Guarda dentro di te<br/>Kijk in jezelf</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {[0, 0.2, 0.4].map((d, i) => (
                      <div key={i} className="w-1.5 h-1.5 bg-[#70a1ff] rounded-full animate-ping" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button onClick={toggleCam}
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-[#0c2461] border border-[#70a1ff]/30 px-5 py-2 rounded-full text-[0.6rem] tracking-widest uppercase text-white shadow-lg flex items-center gap-2">
              {isCamOn ? <CameraOff size={12} /> : <Camera size={12} />}
              <span>{isCamOn ? 'Chiudi' : 'Apri'} Specchio</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="space-y-1">
            <label className="text-[0.5rem] uppercase tracking-[0.2em] text-[#70a1ff]/60 ml-1 flex items-center gap-1"><Lightbulb size={10} /> Focus</label>
            <select value={focus} onChange={(e) => setFocus(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[0.7rem] outline-none text-[#70a1ff]">
              <option value="sogni">I tuoi Sogni</option>
              <option value="talento">Il tuo Talento</option>
              <option value="paure">Le tue Paure</option>
              <option value="futuro">Il tuo Futuro</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[0.5rem] uppercase tracking-[0.2em] text-[#70a1ff]/60 ml-1 flex items-center gap-1"><Heart size={10} /> Mood</label>
            <select value={mood} onChange={(e) => setMood(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[0.7rem] outline-none text-[#70a1ff]">
              <option value="riflessivo">Riflessivo</option>
              <option value="coraggioso">Coraggioso</option>
              <option value="gentile">Gentile</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8 mb-4">
          <button onClick={isRecording ? () => {} : startRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500/20 border-2 border-red-500 animate-pulse' : 'bg-[#70a1ff] shadow-[0_0_20px_rgba(112,161,255,0.4)]'}`}>
            {isRecording ? <MicOff size={30} className="text-red-500" /> : <Mic size={30} className="text-[#05050a]" />}
          </button>
        </div>

        <div className="text-center mb-6">
          <p className="text-[0.65rem] text-[#70a1ff]/70 italic tracking-wide">{status}</p>
        </div>

        <div className="w-full h-[30vh] bg-white/5 border border-white/10 rounded-2xl overflow-y-auto p-4 space-y-4 mb-4 backdrop-blur-md">
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[0.85rem] ${msg.role === 'user' ? 'bg-white/10 border border-white/5 rounded-tr-none text-white/70 italic' : 'bg-[#1e3799]/20 border border-[#70a1ff]/20 rounded-tl-none'}`}>
                {msg.role === 'model' ? (
                  <>
                    <span className="font-serif text-[#70a1ff] block mb-1 text-base">{msg.it}</span>
                    <span className="text-[0.65rem] text-white/30 block border-t border-white/5 pt-1 mt-1">{msg.nl}</span>
                  </>
                ) : (
                  <span>{msg.it}</span>
                )}
              </div>
            </motion.div>
          ))}
          {isThinking && (
            <div className="flex gap-2 p-3 bg-white/5 rounded-full w-16 justify-center">
              <div className="w-1 h-1 bg-[#70a1ff] rounded-full animate-bounce" />
              <div className="w-1 h-1 bg-[#70a1ff] rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1 h-1 bg-[#70a1ff] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="flex flex-col gap-4">
          <button onClick={() => { setMessages([]); setScore(0); generateAIResponse([]); }}
            className="w-full py-4 border border-[#70a1ff]/20 bg-white/5 rounded-xl text-[0.7rem] tracking-[0.3em] uppercase text-[#70a1ff] hover:bg-[#70a1ff]/10 transition-all flex items-center justify-center gap-3">
            <RotateCcw size={16} /> Ricomincia il Cammino
          </button>
          
          <div className="flex items-center justify-between px-2 opacity-60">
            <div className="text-[0.6rem] uppercase tracking-widest flex items-center gap-2"><Heart size={10} /> Luce Interiore</div>
            <div className="text-[#70a1ff] font-bold">✨ {score}</div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowKeyModal(true)} className="flex-1 py-3 border border-white/5 rounded-lg text-[0.5rem] text-white/30 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
              <Key size={10} /> Configura API
            </button>
            <button onClick={() => {}} className="flex-1 py-3 border border-white/5 rounded-lg text-[0.5rem] text-white/30 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
              <Save size={10} /> Salva Percorso
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showKeyModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
            <div className="bg-[#0c2461] border border-[#70a1ff]/30 p-8 rounded-3xl w-full max-w-xs shadow-2xl">
              <h2 className="font-serif text-xl text-[#70a1ff] mb-4 text-center">Gemini API Key</h2>
              <input type="password" defaultValue={customKey} id="keyInput" className="w-full bg-black/40 border border-[#70a1ff]/20 rounded-xl px-4 py-3 text-sm mb-6 outline-none text-white text-center" placeholder="Inserisci chiave..." />
              <div className="flex gap-3">
                <button onClick={() => setShowKeyModal(false)} className="flex-1 py-3 text-[0.6rem] text-white/50 uppercase">Annulla</button>
                <button onClick={() => saveCustomKey((document.getElementById('keyInput') as HTMLInputElement).value)}
                  className="flex-1 py-3 bg-[#70a1ff] rounded-xl text-[#05050a] text-[0.6rem] font-bold uppercase tracking-widest">Salva</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <footer className="mt-12 text-center px-8 opacity-40">
        <p className="text-[0.55rem] leading-relaxed tracking-wider">
          "Se oggi ti prenderai cura dei tuoi Sogni, domani saranno Loro a prendersi cura di te."<br/>
          — Stefano Rossi —
        </p>
      </footer>
    </div>
  );
}
