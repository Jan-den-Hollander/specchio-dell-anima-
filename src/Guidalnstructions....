// ============================================================
// ISTRUZIONI / HANDLEIDING / INSTRUCTIONS
// Voeg dit toe aan elke versie van de spiegelapp:
//
// STAP 1 — Voeg de bladwijzerlink toe direct ONDER de <motion.h1> titel in de header:
//
//   <a href="#guida" className="...zie onder...">
//     Come iniziare · Hoe te beginnen · How to start ↓
//   </a>
//
// STAP 2 — Plak het <GuidaSection /> component VOOR de sluitende </div> van de hele return
//
// STAP 3 — Voeg de GuidaSection functie toe BUITEN de App() functie (onderaan het bestand)
// ============================================================


// ── BLADWIJZERLINK — plak dit direct onder de <motion.h1> in de header ──────
//
// <a
//   href="#guida"
//   className="text-[0.55rem] tracking-[0.15em] uppercase opacity-40 hover:opacity-80 transition-opacity mt-1 block"
//   style={{ color: 'inherit' }}
// >
//   Come iniziare · Hoe te beginnen · How to start ↓
// </a>
//
// ────────────────────────────────────────────────────────────────────────────


// ── GUIDE COMPONENT — voeg dit toe als losse functie buiten App() ────────────

function GuidaSection({ accentColor = '#c9a84c' }: { accentColor?: string }) {
  const dim = `${accentColor}30`;
  const mid = `${accentColor}60`;
  const bright = accentColor;

  const steps = [
    {
      num: '1',
      it: 'Genera la tua chiave API gratuita',
      nl: 'Genereer je gratis API-sleutel',
      en: 'Generate your free API key',
      detail: {
        it: 'Vai su aistudio.google.com → accedi con Google → clicca "Get API key" → "Create API key". È gratuito.',
        nl: 'Ga naar aistudio.google.com → log in met Google → klik "Get API key" → "Create API key". Gratis.',
        en: 'Go to aistudio.google.com → sign in with Google → click "Get API key" → "Create API key". Free.',
      },
    },
    {
      num: '2',
      it: 'Inserisci la chiave nell\'app',
      nl: 'Voer de sleutel in de app in',
      en: 'Enter the key in the app',
      detail: {
        it: 'Tocca il simbolo 🔑 in basso a destra → incolla la chiave → tocca Salva.',
        nl: 'Tik op het sleuteltje 🔑 rechtsonder → plak de sleutel → tik Opslaan.',
        en: 'Tap the 🔑 key icon bottom right → paste your key → tap Save.',
      },
    },
    {
      num: '3',
      it: 'Accendi lo specchio',
      nl: 'Zet de spiegel aan',
      en: 'Switch on the mirror',
      detail: {
        it: 'Tocca "Accendi Specchio" per vedere il tuo riflesso. Opzionale ma consigliato per il shadowing.',
        nl: 'Tik op "Accendi Specchio" om jezelf te zien. Optioneel maar aanbevolen voor shadowing.',
        en: 'Tap "Accendi Specchio" to see your reflection. Optional but recommended for shadowing.',
      },
    },
    {
      num: '4',
      it: 'Inizia la conversazione',
      nl: 'Start het gesprek',
      en: 'Start the conversation',
      detail: {
        it: 'Tocca "Nuova Conversazione". Lo specchio parla — ascolta, poi premi 🎤 per rispondere.',
        nl: 'Tik op "Nieuw Gesprek". De spiegel spreekt — luister, druk dan op 🎤 om te antwoorden.',
        en: 'Tap "New Conversation". The mirror speaks — listen, then press 🎤 to reply.',
      },
    },
    {
      num: '5',
      it: 'Scegli livello e argomento',
      nl: 'Kies niveau en onderwerp',
      en: 'Choose level and topic',
      detail: {
        it: 'Usa i menu a tendina per adattare la difficoltà e l\'argomento alla tua sessione.',
        nl: 'Gebruik de dropdowns om de moeilijkheidsgraad en het onderwerp aan te passen.',
        en: 'Use the dropdowns to match the difficulty and topic to your session.',
      },
    },
  ];

  return (
    <section
      id="guida"
      style={{
        marginTop: '2.5rem',
        borderTop: `1px solid ${dim}`,
        paddingTop: '1.5rem',
        paddingBottom: '2rem',
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
        <p style={{ fontSize: '0.6rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: mid, marginBottom: '0.3rem' }}>
          Come iniziare · Hoe te beginnen · How to start
        </p>
        <div style={{ width: '40px', height: '1px', background: bright, margin: '0 auto', opacity: 0.4 }} />
      </div>

      {/* API key highlight */}
      <div style={{
        border: `1px solid ${dim}`,
        borderRadius: '10px',
        padding: '0.9rem 1rem',
        marginBottom: '1.2rem',
        background: `${accentColor}08`,
      }}>
        <p style={{ fontSize: '0.72rem', color: bright, fontWeight: 'bold', marginBottom: '0.4rem' }}>
          🔑 API Key — aistudio.google.com
        </p>
        <p style={{ fontSize: '0.68rem', color: mid, lineHeight: 1.6, marginBottom: '0.2rem' }}>
          <strong style={{ color: bright }}>IT</strong> · Ogni utente usa la propria chiave gratuita. Nessun abbonamento richiesto.
        </p>
        <p style={{ fontSize: '0.68rem', color: mid, lineHeight: 1.6, marginBottom: '0.2rem' }}>
          <strong style={{ color: bright }}>NL</strong> · Elke gebruiker gebruikt zijn eigen gratis sleutel. Geen abonnement nodig.
        </p>
        <p style={{ fontSize: '0.68rem', color: mid, lineHeight: 1.6 }}>
          <strong style={{ color: bright }}>EN</strong> · Each user uses their own free key. No subscription required.
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {steps.map((step) => (
          <div key={step.num} style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
            <div style={{
              minWidth: '22px', height: '22px', borderRadius: '50%',
              border: `1px solid ${mid}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', color: bright, flexShrink: 0, marginTop: '2px',
            }}>
              {step.num}
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: bright, marginBottom: '0.25rem', fontWeight: 'bold' }}>
                {step.it} · {step.nl} · {step.en}
              </p>
              <p style={{ fontSize: '0.63rem', color: mid, lineHeight: 1.55, marginBottom: '0.1rem' }}>
                🇮🇹 {step.detail.it}
              </p>
              <p style={{ fontSize: '0.63rem', color: mid, lineHeight: 1.55, marginBottom: '0.1rem' }}>
                🇳🇱 {step.detail.nl}
              </p>
              <p style={{ fontSize: '0.63rem', color: mid, lineHeight: 1.55 }}>
                🇬🇧 {step.detail.en}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: '1.2rem',
        padding: '0.7rem 0.9rem',
        borderRadius: '8px',
        background: `${accentColor}06`,
        border: `1px solid ${dim}`,
        fontSize: '0.62rem',
        color: mid,
        lineHeight: 1.6,
        textAlign: 'center',
      }}>
        🇮🇹 La chiave viene salvata solo sul tuo dispositivo. Nessun dato viene condiviso.<br />
        🇳🇱 De sleutel wordt alleen op jouw apparaat opgeslagen. Er worden geen gegevens gedeeld.<br />
        🇬🇧 The key is saved only on your device. No data is shared.
      </div>
    </section>
  );
}

// ── GEBRUIK IN DE RETURN VAN APP() ───────────────────────────────────────────
//
// Plak dit VOOR de laatste sluitende </div> van de hele return:
//
//   <GuidaSection accentColor="#c9a84c" />   ← goud voor Specchio Magico / Zauberspiegel
//   <GuidaSection accentColor="#4a7ab5" />   ← blauw voor Specchio English
//
// ────────────────────────────────────────────────────────────────────────────

export { GuidaSection };
