/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Specchio dell'Anima - Ispirato da Stefano Rossi
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Mic, MicOff, RotateCcw, Heart, Lightbulb, Save, Key } from 'lucide-react';
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

// ── Storingsondervanging: retry met exponentiële backoff ──────────────────
const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(fn: () => Promise<any>, maxAttempts = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
    } catch (err: any) {
      const isLast = attempt === maxAttempts;
      const isRetryable = err?.message?.includes('timeout') ||
                          err?.message?.includes('503') ||
                          err?.message?.includes('overloaded') ||
                          err?.message?.includes('network');
      if (isLast || !isRetryable) throw err;
      await sleep(attempt * 1500);
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [focus, setFocus] = useState('sogni');
  const [mood, setMood] = useState('riflessivo');
  const [score, setScore] = useState(0);
  const [status, setStatus] = useState('Pronto per illuminare · Klaar om te verlichten');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKey, setCustomKey] = useState(localStorage.getItem('rossi_mirror_api_key') || '');
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // ── Camera: automatisch aan bij laden ────────────────────────────────────
  useEffect(() => {
    startCamera();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setStatus('Camera niet beschikbaar · Fotocamera non disponibile');
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const getAI = () => new GoogleGenAI({ apiKey: customKey || process.env.GEMINI_API_KEY || "" });

  const saveCustomKey = (key: string) => {
    localStorage.setItem('rossi_mirror_api_key', key);
    setCustomKey(key);
    setShowKeyModal(false);
    setStatus('Chiave salvata! · Sleutel opgeslagen!');
  };

  // ── TTS: Gemini eerst, browser als fallback ───────────────────────────────
  const speakIt = async (text: string) => {
    if (!text) return;
    setIsSpeaking(true);
    try {
      const aiInstance = getAI();
      const response = await fetchWithRetry(() =>
        aiInstance.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }
          },
        })
      );
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = Uint8Array.from(atob(base64Audio), (c: string) => c.charCodeAt(0)).buffer;
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
        return;
      }
    } catch {
      // stil falen → browser TTS
    }
    // Browser TTS fallback
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const itVoice = voices.find(v => v.lang.startsWith('it')) || voices[0];
    if (itVoice) utt.voice = itVoice;
    utt.lang = 'it-IT';
    utt.rate = 0.88;
    utt.pitch = 1.05;
    utt.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utt);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setStatus('Microfoon niet ondersteund · Microfono non supportato'); return; }
    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => { setIsRecording(true); setStatus('Ti ascolto... · Ik luister...'); };
    recognition.onresult = (e: any) => { processHeard(e.results[0][0].transcript); };
    recognition.onerror = () => { setIsRecording(false); setStatus('Microfoon fout · Errore microfono'); };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  const processHeard = async (heard: string) => {
    const userMsg: Message = { role: 'user', it: heard, nl: '', insight: 'riflessione' };
    setMessages(prev => [...prev, userMsg]);
    setScore(prev => prev + 1);
    generateAIResponse([...messages, userMsg]);
  };

  // ── AI response met retry en statusberichten ──────────────────────────────
  const generateAIResponse = useCallback(async (history: Message[]) => {
    setIsThinking(true);
    setRetryCount(0);
    const systemInstruction = `${SYSTEM_PROMPT}\nFocus attuale: ${focus}. Mood: ${mood}.`;

    try {
      const aiInstance = getAI();
      const contents = history
        .filter(m => m.role === 'user' || m.role === 'model')
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.role === 'user' ? m.it : JSON.stringify({ it: m.it, nl: m.nl }) }]
        }));

      let attempt = 0;
      const result = await fetchWithRetry(async () => {
        attempt++;
        if (attempt > 1) setStatus(`Nuovo tentativo ${attempt}/3... · Poging ${attempt}/3...`);
        return aiInstance.models.generateContent({
          model: "gemini-2.0-flash",
          contents: contents.length ? contents : [{ role: 'user', parts: [{ text: 'Inizia il dialogo con una frase ispiratrice.' }] }],
          config: { systemInstruction, responseMimeType: "application/json" },
        });
      });

      const raw = result.text || "{}";
      const data = JSON.parse(raw.replace(/```json|```/g, '').trim());
      const aiMsg: Message = {
        role: 'model',
        it: data.it || '...',
        nl: data.nl || '...',
        insight: data.insight || ''
      };
      setMessages(prev => [...prev, aiMsg]);
      setStatus('Pronto · Klaar');
      speakIt(aiMsg.it);
    } catch (err: any) {
      setIsThinking(false);
      const isOverload = err?.message?.includes('overloaded') || err?.message?.includes('503');
      const errMsg = isOverload
        ? 'Lo specchio è occupato, riprova tra poco · Spiegel bezet, probeer straks'
        : 'Connessione persa · Verbinding verbroken';
      setStatus(errMsg);
      setMessages(prev => [...prev, {
        role: 'error',
        it: '⚠️ ' + (isOverload ? 'Lo specchio è momentaneamente occupato...' : 'Connessione persa'),
        nl: isOverload ? 'De spiegel is even bezet, probeer opnieuw.' : 'Verbinding verbroken.',
        insight: 'pausa'
      }]);
      return;
    }
    setIsThinking(false);
  }, [focus, mood, customKey]);
  // ─────────────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setMessages([]);
    setScore(0);
    setStatus('Nuovo cammino · Nieuw pad');
    setTimeout(() => generateAIResponse([]), 300);
  };

  const saveTranscript = () => {
    if (!messages.length) return;
    const content = messages
      .filter(m => m.role !== 'error')
      .map(m => `${m.role === 'model' ? '🪞 Specchio' : '🧑 Io'}: ${m.it}\n   [${m.nl}]`)
      .join('\n\n');
    const blob = new Blob([`Specchio dell'Anima — Percorso\n\n${content}\n\n"Se oggi ti prenderai cura dei tuoi Sogni, domani saranno Loro a prendersi cura di te." — Stefano Rossi`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'specchio-anima-percorso.txt';
    a.click();
  };

  return (
    <div style={styles.app}>
      {/* Achtergrond gloed */}
      <div style={styles.bgGlow} />

      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Specchio dell'Anima</h1>
          <p style={styles.subtitle}>Ispirato da Stefano Rossi</p>
        </div>
        <div style={styles.scoreBox}>
          <span style={styles.scoreNum}>✨ {score}</span>
          <span style={styles.scoreLabel}>luce interiore</span>
        </div>
      </header>

      {/* ── SPIEGEL — zelfde vorm als taalspiegels ── */}
      <div style={styles.mirrorSection}>
        <div style={styles.mirrorOuter}>
          <div style={styles.mirrorFrame}>
            <div style={styles.mirrorInner}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={styles.video}
              />
              {/* Zacht overlay als camera niet actief */}
              <div style={styles.mirrorOverlay}>
                {!streamRef.current && (
                  <div style={styles.noCamMsg}>
                    <Heart size={28} color="#70a1ff" />
                    <span style={styles.noCamText}>Guarda dentro di te</span>
                  </div>
                )}
              </div>
              {/* Spreekanimatie */}
              {isSpeaking && (
                <div style={styles.speakingRing} />
              )}
            </div>
          </div>
          <div style={styles.personaBadge}>
            ✨ Specchio dell'Anima
          </div>
        </div>
      </div>

      {/* Quote — mooi zichtbaar */}
      <div style={styles.quoteBlock}>
        <p style={styles.quoteText}>
          "Se oggi ti prenderai cura dei tuoi Sogni,<br />
          domani saranno Loro a prendersi cura di te."
        </p>
        <p style={styles.quoteAuthor}>— Stefano Rossi —</p>
      </div>

      {/* Focus & Mood selectors */}
      <div style={styles.selectRow}>
        <div style={styles.selectGroup}>
          <label style={styles.selectLabel}>
            <Lightbulb size={10} style={{ marginRight: 4 }} /> Focus
          </label>
          <select value={focus} onChange={e => setFocus(e.target.value)} style={styles.select}>
            <option value="sogni">I tuoi Sogni</option>
            <option value="talento">Il tuo Talento</option>
            <option value="paure">Le tue Paure</option>
            <option value="futuro">Il tuo Futuro</option>
          </select>
        </div>
        <div style={styles.selectGroup}>
          <label style={styles.selectLabel}>
            <Heart size={10} style={{ marginRight: 4 }} /> Mood
          </label>
          <select value={mood} onChange={e => setMood(e.target.value)} style={styles.select}>
            <option value="riflessivo">Riflessivo</option>
            <option value="coraggioso">Coraggioso</option>
            <option value="gentile">Gentile</option>
          </select>
        </div>
      </div>

      {/* Chatvenster */}
      <div style={styles.chatBox}>
        {messages.length === 0 && (
          <div style={styles.chatEmpty}>
            <p style={styles.chatEmptyText}>Parla allo specchio... · Spreek tot de spiegel...</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}
          >
            <div style={msg.role === 'user' ? styles.bubbleUser : msg.role === 'error' ? styles.bubbleError : styles.bubbleModel}>
              {msg.role === 'model' ? (
                <>
                  <span style={styles.bubbleIt}>{msg.it}</span>
                  {msg.insight && <span style={styles.bubbleInsight}>· {msg.insight} ·</span>}
                  <span style={styles.bubbleNl}>{msg.nl}</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 14 }}>{msg.it}</span>
                  {msg.nl && <span style={styles.bubbleNl}>{msg.nl}</span>}
                </>
              )}
            </div>
          </motion.div>
        ))}
        {isThinking && (
          <div style={styles.thinkingRow}>
            {[0, 200, 400].map((d, i) => (
              <div key={i} style={{ ...styles.thinkingDot, animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Status */}
      <p style={styles.statusText}>{status}</p>

      {/* Microfoon knop — zelfde stijl als taalspiegels */}
      <div style={styles.controls}>
        <button onClick={handleReset} style={styles.btnSec} title="Opnieuw beginnen">
          <RotateCcw size={18} />
        </button>
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          style={{ ...styles.btnMic, ...(isRecording ? styles.btnMicActive : {}) }}
        >
          {isRecording ? <MicOff size={28} color="#fff" /> : <Mic size={28} color="#05050a" />}
        </button>
        <button onClick={saveTranscript} style={styles.btnSec} title="Sla percorso op">
          <Save size={18} />
        </button>
      </div>

      {/* API key knop */}
      <button onClick={() => setShowKeyModal(true)} style={styles.btnKey}>
        <Key size={10} style={{ marginRight: 4 }} /> Configura API Key
      </button>

      {/* API Key modal */}
      <AnimatePresence>
        {showKeyModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={styles.modal}
          >
            <div style={styles.modalBox}>
              <h2 style={styles.modalTitle}>Gemini API Key</h2>
              <input
                type="password"
                defaultValue={customKey}
                id="keyInput"
                style={styles.modalInput}
                placeholder="Inserisci la tua chiave..."
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowKeyModal(false)} style={styles.modalBtnCancel}>
                  Annulla
                </button>
                <button
                  onClick={() => saveCustomKey((document.getElementById('keyInput') as HTMLInputElement).value)}
                  style={styles.modalBtnSave}
                >
                  Salva
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Styles — zelfde patroon als taalspiegels ──────────────────────────────
const C = {
  bg: '#05050a',
  blue: '#70a1ff',
  blueDim: 'rgba(112,161,255,0.15)',
  blueBorder: 'rgba(112,161,255,0.25)',
  text: '#e0e0f0',
  dim: 'rgba(255,255,255,0.45)',
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: "'Georgia', serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 0 30px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'fixed', inset: 0,
    background: 'radial-gradient(ellipse at 50% 30%, rgba(30,55,153,0.25) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  header: {
    width: '100%', maxWidth: 480,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', zIndex: 1,
  },
  title: {
    margin: 0, fontSize: 20, fontWeight: 300,
    color: C.blue, letterSpacing: '0.15em',
  },
  subtitle: {
    margin: 0, fontSize: 10,
    color: 'rgba(112,161,255,0.5)',
    letterSpacing: '0.2em', textTransform: 'uppercase',
  },
  scoreBox: {
    textAlign: 'center',
    background: C.blueDim,
    borderRadius: 10, padding: '6px 12px',
    border: `1px solid ${C.blueBorder}`,
  },
  scoreNum: { display: 'block', fontSize: 18, fontWeight: 700, color: C.blue },
  scoreLabel: { fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em' },

  // ── Spiegel — identiek aan taalspiegels ──
  mirrorSection: { margin: '6px 0', zIndex: 1 },
  mirrorOuter: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  mirrorFrame: {
    width: 200, height: 250,
    borderRadius: '50% 50% 48% 48%',
    border: `6px solid ${C.blue}`,
    boxShadow: `0 0 40px rgba(112,161,255,0.4), inset 0 0 20px rgba(0,0,0,0.4)`,
    overflow: 'hidden',
    background: '#060620',
    position: 'relative',
  },
  mirrorInner: { width: '100%', height: '100%', position: 'relative' },
  video: {
    width: '100%', height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
  },
  mirrorOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  noCamMsg: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  },
  noCamText: {
    fontSize: 10, color: 'rgba(112,161,255,0.4)',
    textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: 'center',
  },
  speakingRing: {
    position: 'absolute', inset: -6,
    borderRadius: '50%',
    border: `3px solid ${C.blue}`,
    animation: 'pulse 1.2s ease-in-out infinite',
    pointerEvents: 'none',
  },
  personaBadge: {
    marginTop: 10,
    background: C.blueDim,
    border: `1px solid ${C.blueBorder}`,
    borderRadius: 20, padding: '4px 18px',
    fontSize: 12, color: C.blue,
    letterSpacing: '0.1em',
  },

  // ── Quote ──
  quoteBlock: {
    width: '100%', maxWidth: 480,
    padding: '12px 24px',
    margin: '8px 0 4px',
    borderTop: `1px solid ${C.blueBorder}`,
    borderBottom: `1px solid ${C.blueBorder}`,
    background: 'rgba(112,161,255,0.04)',
    textAlign: 'center',
    zIndex: 1,
  },
  quoteText: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.7,
    color: 'rgba(112,161,255,0.75)',
    fontStyle: 'italic',
    letterSpacing: '0.02em',
  },
  quoteAuthor: {
    margin: '6px 0 0',
    fontSize: 10,
    color: 'rgba(112,161,255,0.4)',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
  },

  // ── Selectors ──
  selectRow: {
    width: '100%', maxWidth: 480,
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 10, padding: '10px 16px', zIndex: 1,
  },
  selectGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  selectLabel: {
    fontSize: 9, textTransform: 'uppercase',
    letterSpacing: '0.2em', color: 'rgba(112,161,255,0.6)',
    display: 'flex', alignItems: 'center',
  },
  select: {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${C.blueBorder}`,
    borderRadius: 8, padding: '7px 10px',
    fontSize: 12, color: C.blue,
    outline: 'none',
  },

  // ── Chat ──
  chatBox: {
    width: '100%', maxWidth: 480,
    maxHeight: 190, overflowY: 'auto',
    padding: '0 12px', zIndex: 1,
  },
  chatEmpty: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: 60,
  },
  chatEmptyText: {
    fontSize: 11, color: 'rgba(112,161,255,0.3)',
    fontStyle: 'italic', letterSpacing: '0.05em',
  },
  bubbleModel: {
    background: C.blueDim,
    border: `1px solid ${C.blueBorder}`,
    borderRadius: '18px 18px 18px 4px',
    padding: '10px 14px', maxWidth: '82%',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  bubbleUser: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '18px 18px 4px 18px',
    padding: '10px 14px', maxWidth: '82%',
    fontSize: 14, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic',
  },
  bubbleError: {
    background: 'rgba(200,50,50,0.15)',
    border: '1px solid rgba(200,50,50,0.3)',
    borderRadius: '18px 18px 18px 4px',
    padding: '10px 14px', maxWidth: '82%',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  bubbleIt: { fontSize: 15, color: C.blue, fontStyle: 'normal', lineHeight: 1.5 },
  bubbleInsight: { fontSize: 10, color: 'rgba(112,161,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' },
  bubbleNl: { fontSize: 11, color: C.dim, fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4, marginTop: 2 },

  thinkingRow: { display: 'flex', gap: 6, padding: '8px 14px' },
  thinkingDot: {
    width: 6, height: 6,
    borderRadius: '50%',
    background: C.blue,
    animation: 'bounce 1s infinite',
  },

  // ── Status ──
  statusText: {
    fontSize: 11, color: 'rgba(112,161,255,0.6)',
    fontStyle: 'italic', margin: '4px 0', zIndex: 1,
    textAlign: 'center',
  },

  // ── Controls — identiek aan taalspiegels ──
  controls: {
    display: 'flex', alignItems: 'center', gap: 22,
    marginTop: 8, zIndex: 1,
  },
  btnMic: {
    width: 68, height: 68, borderRadius: '50%',
    border: `3px solid ${C.blue}`,
    background: C.blue,
    fontSize: 28, cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `0 0 20px rgba(112,161,255,0.4)`,
  },
  btnMicActive: {
    background: 'rgba(200,50,50,0.8)',
    border: '3px solid #e74c3c',
    transform: 'scale(1.1)',
    boxShadow: '0 0 20px rgba(231,76,60,0.5)',
  },
  btnSec: {
    width: 46, height: 46, borderRadius: '50%',
    border: `2px solid ${C.blueBorder}`,
    background: 'rgba(0,0,0,0.4)',
    cursor: 'pointer', color: C.blue,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  btnKey: {
    marginTop: 12,
    padding: '6px 16px',
    background: 'transparent',
    border: `1px solid rgba(112,161,255,0.15)`,
    borderRadius: 20,
    fontSize: 10, color: 'rgba(112,161,255,0.35)',
    textTransform: 'uppercase', letterSpacing: '0.15em',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    zIndex: 1,
  },

  // ── Modal ──
  modal: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  modalBox: {
    background: '#0c1a3a',
    border: `2px solid ${C.blue}`,
    borderRadius: 20, padding: 28,
    maxWidth: 300, width: '90%',
  },
  modalTitle: {
    margin: '0 0 16px',
    fontWeight: 300, fontSize: 20,
    color: C.blue, textAlign: 'center',
    letterSpacing: '0.1em',
  },
  modalInput: {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.4)',
    border: `1px solid ${C.blueBorder}`,
    borderRadius: 10, padding: '10px 14px',
    fontSize: 14, color: 'white',
    outline: 'none', textAlign: 'center',
  },
  modalBtnCancel: {
    flex: 1, padding: '10px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer', fontSize: 12,
  },
  modalBtnSave: {
    flex: 1, padding: '10px',
    background: C.blue,
    border: 'none',
    borderRadius: 10,
    color: C.bg,
    fontWeight: 700, cursor: 'pointer', fontSize: 12,
    letterSpacing: '0.1em',
  },
};
