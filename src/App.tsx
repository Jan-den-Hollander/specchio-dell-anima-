/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Specchio dell'Anima - Ispirato da Stefano Rossi
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { Mic, MicOff, RotateCcw, Heart, Lightbulb, Save, Key, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface Message {
  role: 'user' | 'model' | 'error';
  it: string;
  nl: string;
  insight?: string;
}

const SYSTEM_PROMPT = "Sei lo \"Specchio dell'Anima\", un mentore empatico ispirato alla psicologia di Stefano Rossi.\n" +
"Il tuo obiettivo è aiutare l'utente a \"illuminare i propri sogni\" e navigare nel proprio mondo interiore.\n" +
"REGOLE:\n" +
"1. Rispondi con UNA frase breve e profonda (max 15 parole).\n" +
"2. Usa metafore legate alla luce, ai semi, ai labirinti o al coraggio.\n" +
"3. Termina sempre con una domanda che invita alla riflessione personale.\n" +
"4. Se l'utente commette errori grammaticali, correggili con estrema dolcezza (usa la parola: matita).\n" +
"Rispondi SOLO in formato JSON: {\"it\":\"frase in italiano\",\"nl\":\"traduzione olandese\",\"insight\":\"una piccola parola chiave sul sentimento\"}";

// ── Retry met exponentiële backoff ────────────────────────────────────────
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

// ── Gouden sterren (slanke vierzijdige ster zoals foto) ───────────────────
const STARS_DATA = [
  { size: 26, x: 18, y: 22, delay: 0,   dur: 3.2 },
  { size: 14, x: 74, y: 14, delay: 0.5, dur: 2.8 },
  { size: 11, x: 86, y: 42, delay: 1.0, dur: 3.5 },
  { size: 9,  x: 52, y: 58, delay: 0.7, dur: 2.6 },
  { size: 8,  x: 32, y: 72, delay: 1.3, dur: 3.0 },
  { size: 13, x: 66, y: 74, delay: 0.3, dur: 2.9 },
  { size: 8,  x: 8,  y: 52, delay: 1.6, dur: 3.3 },
];

function StarSVG({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="starGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff8c0" />
          <stop offset="40%" stopColor="#f0c020" />
          <stop offset="100%" stopColor="#c07800" stopOpacity="0.3" />
        </radialGradient>
      </defs>
      <path
        d="M50 0 L53 44 L100 50 L53 56 L50 100 L47 56 L0 50 L47 44 Z"
        fill="url(#starGrad)"
        style={{ filter: 'drop-shadow(0 0 5px rgba(240,192,32,0.8))' }}
      />
    </svg>
  );
}

function FloatingStars() {
  return (
    <div style={{ position: 'relative', width: 150, height: 140 }}>
      {STARS_DATA.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${s.x}%`,
          top: `${s.y}%`,
          transform: 'translate(-50%, -50%)',
          animation: `starFloat ${s.dur}s ease-in-out ${s.delay}s infinite alternate`,
        }}>
          <StarSVG size={s.size} />
        </div>
      ))}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────

// ── Meertalige gebruiksaanwijzing ─────────────────────────────────────────
const INSTRUCTIONS = {
  it: {
    flag: '🇮🇹',
    label: 'Italiano',
    title: 'Come usare lo Specchio',
    steps: [
      { icon: '🔑', text: 'Inserisci la tua chiave Gemini API tramite il pulsante "Configura API Key" in basso.', highlight: false },
      { icon: '📷', text: 'Consenti l\'accesso alla fotocamera: vedrai il tuo volto nello specchio.', highlight: false },
      { icon: '🔄', text: 'Importante: se torni dalla pagina Istruzioni allo Specchio, aggiorna la pagina del browser per riattivare la fotocamera.', highlight: true },
      { icon: '🎤', text: 'Tieni premuto il pulsante microfono e parla in italiano. Racconta un sogno, una paura, un desiderio.', highlight: false },
      { icon: '🪞', text: 'Lo Specchio risponde con una frase profonda ispirata a Stefano Rossi, con traduzione in olandese.', highlight: false },
      { icon: '🔊', text: 'La risposta viene letta ad alta voce (Gemini TTS o voce del browser come riserva).', highlight: false },
      { icon: '💡', text: 'Usa i selettori Focus e Mood per orientare il dialogo verso sogni, talenti, paure o futuro.', highlight: false },
      { icon: '💾', text: 'Salva il tuo percorso con il pulsante Salva. Ricomincia con il pulsante Riavvia.', highlight: false },
      { icon: '🆓', text: 'Chiave API gratuita su: aistudio.google.com — scegli "Get API Key".', highlight: false },
    ],
  },
  nl: {
    flag: '🇳🇱',
    label: 'Nederlands',
    title: 'Hoe gebruik je de Spiegel',
    steps: [
      { icon: '🔑', text: 'Voer je Gemini API-sleutel in via de knop "Configura API Key" onderaan.', highlight: false },
      { icon: '📷', text: 'Geef toegang tot de camera: je ziet je eigen gezicht in de spiegel.', highlight: false },
      { icon: '🔄', text: 'Let op: keer je terug van de Instructies naar de Spiegel, ververs dan de pagina (herladen) om de camera opnieuw te activeren.', highlight: true },
      { icon: '🎤', text: 'Houd de microfoonknop ingedrukt en spreek Italiaans. Vertel een droom, een angst, een wens.', highlight: false },
      { icon: '🪞', text: 'De Spiegel antwoordt met een diepe zin geïnspireerd op Stefano Rossi, met Nederlandse vertaling.', highlight: false },
      { icon: '🔊', text: 'Het antwoord wordt hardop voorgelezen (Gemini TTS of browserstem als reserveoptie).', highlight: false },
      { icon: '💡', text: 'Gebruik de Focus- en Mood-knoppen om het gesprek te richten op dromen, talenten, angsten of toekomst.', highlight: false },
      { icon: '💾', text: 'Sla je pad op met de Opslaan-knop. Begin opnieuw met de Herstart-knop.', highlight: false },
      { icon: '🆓', text: 'Gratis API-sleutel via: aistudio.google.com — kies "Get API Key".', highlight: false },
    ],
  },
  en: {
    flag: '🇬🇧',
    label: 'English',
    title: 'How to use the Mirror',
    steps: [
      { icon: '🔑', text: 'Enter your Gemini API key using the "Configura API Key" button at the bottom.', highlight: false },
      { icon: '📷', text: 'Allow camera access: you will see your face in the mirror.', highlight: false },
      { icon: '🔄', text: 'Important: when returning from the Instructions page to the Mirror, refresh the browser page to reactivate the camera.', highlight: true },
      { icon: '🎤', text: 'Hold the microphone button and speak Italian. Share a dream, a fear, a wish.', highlight: false },
      { icon: '🪞', text: 'The Mirror responds with a deep phrase inspired by Stefano Rossi, with a Dutch translation.', highlight: false },
      { icon: '🔊', text: 'The response is read aloud (Gemini TTS or browser voice as fallback).', highlight: false },
      { icon: '💡', text: 'Use the Focus and Mood selectors to guide the dialogue toward dreams, talents, fears or the future.', highlight: false },
      { icon: '💾', text: 'Save your journey with the Save button. Start over with the Restart button.', highlight: false },
      { icon: '🆓', text: 'Free API key at: aistudio.google.com — choose "Get API Key".', highlight: false },
    ],
  },
};

type LangKey = 'it' | 'nl' | 'en';

function InstructionsPage({ onBack }: { onBack: () => void }) {
  const [lang, setLang] = useState<LangKey>('nl');
  const content = INSTRUCTIONS[lang];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={styles.instrPage}
    >
      <div style={styles.instrLangRow}>
        {(Object.keys(INSTRUCTIONS) as LangKey[]).map(l => (
          <button key={l} onClick={() => setLang(l)}
            style={{ ...styles.instrLangBtn, ...(lang === l ? styles.instrLangBtnActive : {}) }}>
            {INSTRUCTIONS[l].flag} {INSTRUCTIONS[l].label}
          </button>
        ))}
      </div>

      <h2 style={styles.instrTitle}>🪞 {content.title}</h2>

      <div style={styles.instrSteps}>
        {content.steps.map((step, i) => (
          <div key={i} style={{ ...styles.instrStep, ...(step.highlight ? styles.instrStepHighlight : {}) }}>
            <span style={styles.instrStepIcon}>{step.icon}</span>
            <span style={{ ...styles.instrStepText, ...(step.highlight ? styles.instrStepTextHighlight : {}) }}>
              {step.text}
            </span>
          </div>
        ))}
      </div>

      <div style={styles.instrFreeKey}>
        <span style={{ fontSize: 14 }}>🆓</span>
        <span style={styles.instrLinkText}>aistudio.google.com &rarr; Get API Key</span>
      </div>
    </motion.div>
  );
}
// ─────────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<'mirror' | 'instructions'>('mirror');
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

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
      // stil falen -> browser TTS
    }
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

  const generateAIResponse = useCallback(async (history: Message[]) => {
    setIsThinking(true);
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
      const isTimeout = err?.message?.includes('timeout');

      let errIt: string;
      let errNl: string;
      let errStatus: string;

      if (isOverload) {
        errIt = "Lo specchio e' momentaneamente occupato. I server Gemini sono affollati — in questo momento si sveglia l'America. Riprova tra qualche minuto in un momento piu' tranquillo.";
        errNl = "De spiegel is even bezet. De Gemini-servers zijn druk bezet — Amerika wordt nu wakker. Probeer het over enkele minuten opnieuw op een rustiger moment.";
        errStatus = "Server bezet · Server occupato — probeer later";
      } else if (isTimeout) {
        errIt = "La connessione ha impiegato troppo tempo. Il server risponde lentamente. Riprova tra poco.";
        errNl = "De verbinding duurde te lang. De server reageert traag. Probeer het straks opnieuw.";
        errStatus = "Verbinding verlopen · Connessione scaduta";
      } else {
        errIt = "Connessione persa. Controlla la tua rete o riprova tra un momento.";
        errNl = "Verbinding verbroken. Controleer je netwerk of probeer het zo opnieuw.";
        errStatus = "Verbinding verbroken · Connessione persa";
      }

      setStatus(errStatus);
      setMessages(prev => [...prev, { role: 'error', it: errIt, nl: errNl, insight: 'pausa' }]);
      return;
    }
    setIsThinking(false);
  }, [focus, mood, customKey]);

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
    const blob = new Blob(
      [`Specchio dell'Anima — Percorso\n\n${content}\n\n"Se oggi ti prenderai cura dei tuoi Sogni, domani saranno Loro a prendersi cura di te." — Stefano Rossi`],
      { type: 'text/plain' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'specchio-anima-percorso.txt';
    a.click();
  };

  return (
    <div style={styles.app}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes starFloat {
          0%   { transform: translate(-50%,-50%) scale(1);    opacity: 0.65; }
          50%  { opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1.18); opacity: 0.9; }
        }
      `}</style>

      <div style={styles.bgGlow} />

      {/* ── Paginawijzer ── */}
      <div style={styles.pageNav}>
        <button
          onClick={() => setPage('mirror')}
          style={{ ...styles.pageNavBtn, ...(page === 'mirror' ? styles.pageNavBtnActive : {}) }}
        >
          🪞 Spiegel
        </button>
        <button
          onClick={() => setPage('instructions')}
          style={{ ...styles.pageNavBtn, ...(page === 'instructions' ? styles.pageNavBtnActive : {}) }}
        >
          <BookOpen size={11} style={{ marginRight: 4 }} /> Istruzioni
        </button>
      </div>

      {/* ════ PAGINA: INSTRUCTIES ════ */}
      {page === 'instructions' && (
        <InstructionsPage onBack={() => setPage('mirror')} />
      )}

      {/* ════ PAGINA: SPIEGEL ════ */}
      {page === 'mirror' && (
        <>
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

          <div style={styles.mirrorSection}>
            <div style={styles.mirrorOuter}>
              <div style={styles.mirrorFrame}>
                <div style={styles.mirrorInner}>
                  <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
                  <div style={styles.mirrorOverlay}>
                    {!streamRef.current && (
                      <div style={styles.noCamMsg}>
                        <FloatingStars />
                        <span style={styles.noCamText}>Guarda dentro di te</span>
                      </div>
                    )}
                  </div>
                  {isSpeaking && <div style={styles.speakingRing} />}
                </div>
              </div>
              <div style={styles.personaBadge}>✨ Specchio dell'Anima</div>
            </div>
          </div>

          <div style={styles.quoteBlock}>
            <p style={styles.quoteText}>
              "Se oggi ti prenderai cura dei tuoi Sogni,<br />
              domani saranno Loro a prendersi cura di te."
            </p>
            <p style={styles.quoteAuthor}>— Stefano Rossi —</p>
          </div>

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

          <div style={styles.chatBox}>
            {messages.length === 0 && (
              <div style={styles.chatEmpty}>
                <p style={styles.chatEmptyText}>Parla allo specchio... · Spreek tot de spiegel...</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}
              >
                <div style={msg.role === 'user' ? styles.bubbleUser : msg.role === 'error' ? styles.bubbleError : styles.bubbleModel}>
                  {msg.role === 'model' ? (
                    <>
                      <span style={styles.bubbleIt}>{msg.it}</span>
                      {msg.insight && <span style={styles.bubbleInsight}>· {msg.insight} ·</span>}
                      <span style={styles.bubbleNl}>{msg.nl}</span>
                    </>
                  ) : msg.role === 'error' ? (
                    <>
                      <span style={styles.bubbleErrorIt}>⚠️ {msg.it}</span>
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

          <p style={styles.statusText}>{status}</p>

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

          <button onClick={() => setShowKeyModal(true)} style={styles.btnKey}>
            <Key size={10} style={{ marginRight: 4 }} /> Configura API Key
          </button>
        </>
      )}

      {/* API Key modal */}
      <AnimatePresence>
        {showKeyModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={styles.modal}
          >
            <div style={styles.modalBox}>
              <h2 style={styles.modalTitle}>Gemini API Key</h2>
              <p style={styles.modalHint}>Gratis sleutel: aistudio.google.com</p>
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

// ── Styles ────────────────────────────────────────────────────────────────
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
    minHeight: '100vh', background: C.bg, color: C.text,
    fontFamily: "'Georgia', serif",
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '0 0 30px', position: 'relative', overflow: 'hidden',
  },
  bgGlow: {
    position: 'fixed', inset: 0,
    background: 'radial-gradient(ellipse at 50% 30%, rgba(30,55,153,0.25) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  pageNav: {
    width: '100%', maxWidth: 480,
    display: 'flex', gap: 6, padding: '10px 16px 4px', zIndex: 10,
  },
  pageNavBtn: {
    flex: 1, padding: '7px 0',
    background: 'rgba(112,161,255,0.05)',
    border: '1px solid rgba(112,161,255,0.15)',
    borderRadius: 20, fontSize: 11,
    color: 'rgba(112,161,255,0.5)', cursor: 'pointer',
    letterSpacing: '0.08em',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
  },
  pageNavBtnActive: {
    background: C.blueDim, border: `1px solid ${C.blueBorder}`,
    color: C.blue, fontWeight: 600,
  },
  instrPage: {
    width: '100%', maxWidth: 480,
    padding: '10px 16px 20px',
    display: 'flex', flexDirection: 'column', gap: 0, zIndex: 1,
  },
  instrLangRow: {
    display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' as const,
  },
  instrLangBtn: {
    padding: '5px 12px', borderRadius: 20,
    border: '1px solid rgba(112,161,255,0.2)',
    background: 'transparent', color: 'rgba(112,161,255,0.5)',
    fontSize: 11, cursor: 'pointer', letterSpacing: '0.05em', transition: 'all 0.2s',
  },
  instrLangBtnActive: {
    background: C.blueDim, border: `1px solid ${C.blueBorder}`,
    color: C.blue, fontWeight: 600,
  },
  instrTitle: {
    margin: '0 0 16px', fontSize: 17, fontWeight: 400,
    color: C.blue, letterSpacing: '0.1em',
  },
  instrSteps: {
    display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16,
  },
  instrStep: {
    display: 'flex', gap: 10, alignItems: 'flex-start',
    background: C.blueDim, border: `1px solid ${C.blueBorder}`,
    borderRadius: 10, padding: '9px 12px',
  },
  instrStepHighlight: {
    background: 'rgba(255,210,80,0.08)',
    border: '1px solid rgba(255,210,80,0.35)',
  },
  instrStepIcon: { fontSize: 15, flexShrink: 0, marginTop: 1 },
  instrStepText: {
    fontSize: 12, color: 'rgba(224,224,240,0.85)',
    lineHeight: 1.6, letterSpacing: '0.02em',
  },
  instrStepTextHighlight: {
    color: 'rgba(255,230,140,0.95)',
  },
  instrFreeKey: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 14px',
    background: 'rgba(112,161,255,0.07)',
    border: '1px dashed rgba(112,161,255,0.25)',
    borderRadius: 10, marginTop: 4,
  },
  instrLinkText: { color: C.blue, fontSize: 12, letterSpacing: '0.03em' },
  header: {
    width: '100%', maxWidth: 480,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', zIndex: 1,
  },
  title: { margin: 0, fontSize: 20, fontWeight: 300, color: C.blue, letterSpacing: '0.15em' },
  subtitle: { margin: 0, fontSize: 10, color: 'rgba(112,161,255,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase' },
  scoreBox: {
    textAlign: 'center', background: C.blueDim,
    borderRadius: 10, padding: '6px 12px', border: `1px solid ${C.blueBorder}`,
  },
  scoreNum: { display: 'block', fontSize: 18, fontWeight: 700, color: C.blue },
  scoreLabel: { fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.1em' },
  mirrorSection: { margin: '6px 0', zIndex: 1 },
  mirrorOuter: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  mirrorFrame: {
    width: 200, height: 250, borderRadius: '50% 50% 48% 48%',
    border: `6px solid ${C.blue}`,
    boxShadow: `0 0 40px rgba(112,161,255,0.4), inset 0 0 20px rgba(0,0,0,0.4)`,
    overflow: 'hidden', background: '#060620', position: 'relative',
  },
  mirrorInner: { width: '100%', height: '100%', position: 'relative' },
  video: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
  mirrorOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'none',
  },
  noCamMsg: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  noCamText: {
    fontSize: 10, color: 'rgba(112,161,255,0.4)',
    textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: 'center',
  },
  speakingRing: {
    position: 'absolute', inset: -6, borderRadius: '50%',
    border: `3px solid ${C.blue}`,
    animation: 'pulse 1.2s ease-in-out infinite', pointerEvents: 'none',
  },
  personaBadge: {
    marginTop: 10, background: C.blueDim, border: `1px solid ${C.blueBorder}`,
    borderRadius: 20, padding: '4px 18px', fontSize: 12, color: C.blue, letterSpacing: '0.1em',
  },
  quoteBlock: {
    width: '100%', maxWidth: 480, padding: '12px 24px', margin: '8px 0 4px',
    borderTop: `1px solid ${C.blueBorder}`, borderBottom: `1px solid ${C.blueBorder}`,
    background: 'rgba(112,161,255,0.04)', textAlign: 'center', zIndex: 1,
  },
  quoteText: {
    margin: 0, fontSize: 12, lineHeight: 1.7,
    color: 'rgba(112,161,255,0.75)', fontStyle: 'italic', letterSpacing: '0.02em',
  },
  quoteAuthor: {
    margin: '6px 0 0', fontSize: 10,
    color: 'rgba(112,161,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase',
  },
  selectRow: {
    width: '100%', maxWidth: 480,
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 10, padding: '10px 16px', zIndex: 1,
  },
  selectGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  selectLabel: {
    fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.2em',
    color: 'rgba(112,161,255,0.6)', display: 'flex', alignItems: 'center',
  },
  select: {
    background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.blueBorder}`,
    borderRadius: 8, padding: '7px 10px', fontSize: 12, color: C.blue, outline: 'none',
  },
  chatBox: {
    width: '100%', maxWidth: 480, maxHeight: 190, overflowY: 'auto',
    padding: '0 12px', zIndex: 1,
  },
  chatEmpty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60 },
  chatEmptyText: { fontSize: 11, color: 'rgba(112,161,255,0.3)', fontStyle: 'italic', letterSpacing: '0.05em' },
  bubbleModel: {
    background: C.blueDim, border: `1px solid ${C.blueBorder}`,
    borderRadius: '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '82%',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  bubbleUser: {
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '18px 18px 4px 18px', padding: '10px 14px', maxWidth: '82%',
    fontSize: 14, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic',
  },
  bubbleError: {
    background: 'rgba(200,50,50,0.12)', border: '1px solid rgba(200,50,50,0.25)',
    borderRadius: '18px 18px 18px 4px', padding: '10px 14px', maxWidth: '92%',
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  bubbleErrorIt: { fontSize: 13, color: '#ffaaaa', lineHeight: 1.55 },
  bubbleIt: { fontSize: 15, color: C.blue, fontStyle: 'normal', lineHeight: 1.5 },
  bubbleInsight: { fontSize: 10, color: 'rgba(112,161,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase' },
  bubbleNl: { fontSize: 11, color: C.dim, fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 4, marginTop: 2 },
  thinkingRow: { display: 'flex', gap: 6, padding: '8px 14px' },
  thinkingDot: { width: 6, height: 6, borderRadius: '50%', background: C.blue, animation: 'bounce 1s infinite' },
  statusText: {
    fontSize: 11, color: 'rgba(112,161,255,0.6)',
    fontStyle: 'italic', margin: '4px 0', zIndex: 1, textAlign: 'center',
  },
  controls: { display: 'flex', alignItems: 'center', gap: 22, marginTop: 8, zIndex: 1 },
  btnMic: {
    width: 68, height: 68, borderRadius: '50%',
    border: `3px solid ${C.blue}`, background: C.blue, fontSize: 28,
    cursor: 'pointer', transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 20px rgba(112,161,255,0.4)',
  },
  btnMicActive: {
    background: 'rgba(200,50,50,0.8)', border: '3px solid #e74c3c',
    transform: 'scale(1.1)', boxShadow: '0 0 20px rgba(231,76,60,0.5)',
  },
  btnSec: {
    width: 46, height: 46, borderRadius: '50%',
    border: `2px solid ${C.blueBorder}`, background: 'rgba(0,0,0,0.4)',
    cursor: 'pointer', color: C.blue,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  btnKey: {
    marginTop: 12, padding: '6px 16px', background: 'transparent',
    border: '1px solid rgba(112,161,255,0.15)', borderRadius: 20,
    fontSize: 10, color: 'rgba(112,161,255,0.35)',
    textTransform: 'uppercase', letterSpacing: '0.15em', cursor: 'pointer',
    display: 'flex', alignItems: 'center', zIndex: 1,
  },
  modal: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  modalBox: {
    background: '#0c1a3a', border: `2px solid ${C.blue}`,
    borderRadius: 20, padding: 28, maxWidth: 300, width: '90%',
  },
  modalTitle: {
    margin: '0 0 4px', fontWeight: 300, fontSize: 20,
    color: C.blue, textAlign: 'center', letterSpacing: '0.1em',
  },
  modalHint: {
    margin: '0 0 16px', fontSize: 11,
    color: 'rgba(112,161,255,0.5)', textAlign: 'center', letterSpacing: '0.04em',
  },
  modalInput: {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.4)', border: `1px solid ${C.blueBorder}`,
    borderRadius: 10, padding: '10px 14px',
    fontSize: 14, color: 'white', outline: 'none', textAlign: 'center',
  },
  modalBtnCancel: {
    flex: 1, padding: '10px', background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12,
  },
  modalBtnSave: {
    flex: 1, padding: '10px', background: C.blue, border: 'none',
    borderRadius: 10, color: C.bg, fontWeight: 700, cursor: 'pointer',
    fontSize: 12, letterSpacing: '0.1em',
  },
};
