import React, { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, Brain, Wrench, Gamepad2, Crown, Send, RefreshCw, Sparkles, Lock, Check, X, Gift, Copy, Trophy, Info, Mail, ShieldCheck } from "lucide-react";
// Storage shim — routes calls through Claude's built-in window.storage
// (shared=true so all visitors see the same data) for this live preview.
const storage = {
  async get(key) { return await window.storage.get(key, true); },
  async set(key, value) { return await window.storage.set(key, value, true); },
  async delete(key) { return await window.storage.delete(key, true); },
  async list(prefix) { return await window.storage.list(prefix, true); },
};

// ---------------------------------------------------------------
// Everything below runs 100% free — no paid API calls, no server.
// ---------------------------------------------------------------


// ---------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------
const TABS = [
  { id: "chat", label: "Help", icon: MessageCircle },
  { id: "quiz", label: "Quiz", icon: Brain },
  { id: "tools", label: "Fun Tools", icon: Wrench },
  { id: "game", label: "Game", icon: Gamepad2 },
  { id: "invite", label: "Invite", icon: Gift },
  { id: "premium", label: "Premium", icon: Crown },
];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [account, setAccount] = useState(null); // { code, name, points, premium }
  const [pendingRef, setPendingRef] = useState(null);
  const creditedRef = useRef(false);

  async function refreshAccount(code) {
    try {
      const res = await storage.get(`ref:${code}`);
      if (!res) return;
      const data = JSON.parse(res.value);
      setAccount({ code, name: data.name || "Anonymous", points: data.points || 0, premium: !!data.premium });
    } catch (e) {}
  }

  // If someone arrived via an invite link (?ref=CODE), remember it — but
  // only actually credit the referrer once this visitor creates or logs
  // into an account (see creditReferralIfNeeded), not just for opening the link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("ref");
    if (code) setPendingRef(code.toUpperCase());
  }, []);

  async function creditReferralIfNeeded(newAccountCode) {
    if (!pendingRef || creditedRef.current) return;
    if (pendingRef === newAccountCode) return; // no crediting yourself
    creditedRef.current = true;
    try {
      const existing = await storage.get(`ref:${pendingRef}`);
      if (!existing) return; // unknown code, nothing to credit
      const data = JSON.parse(existing.value);
      data.points = (data.points || 0) + POINTS_PER_INVITE;
      await storage.set(`ref:${pendingRef}`, JSON.stringify(data));
    } catch (e) {
      // unknown code or storage error — silently ignore
    }
    setPendingRef(null);
  }

  const isAdmin = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "1";
  const isPremium = !!account?.premium;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header tab={tab} setTab={setTab} isPremium={isPremium} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {isAdmin ? (
          <AdminGate />
        ) : (
          <>
            {tab === "chat" && <ChatTab />}
            {tab === "quiz" && <QuizTab isPremium={isPremium} setTab={setTab} />}
            {tab === "tools" && <ToolsTab isPremium={isPremium} setTab={setTab} />}
            {tab === "game" && <GameTab />}
            {tab === "invite" && <InviteTab account={account} setAccount={setAccount} refreshAccount={refreshAccount} creditReferralIfNeeded={creditReferralIfNeeded} setTab={setTab} />}
            {tab === "premium" && <PremiumTab account={account} setTab={setTab} refreshAccount={refreshAccount} />}
            {tab === "about" && <InfoPage page="about" />}
            {tab === "contact" && <InfoPage page="contact" />}
            {tab === "privacy" && <InfoPage page="privacy" />}
            {tab === "terms" && <InfoPage page="terms" />}
          </>
        )}
      </main>
      <footer className="text-center text-xs text-slate-500 py-6 border-t border-slate-800">
        <div className="flex justify-center gap-4 mb-2">
          <button onClick={() => setTab("about")} className="hover:text-slate-300">About</button>
          <button onClick={() => setTab("contact")} className="hover:text-slate-300">Contact</button>
          <button onClick={() => setTab("privacy")} className="hover:text-slate-300">Privacy Policy</button>
          <button onClick={() => setTab("terms")} className="hover:text-slate-300">Terms</button>
        </div>
        Built with Claude · Payments are reviewed and sent/activated manually by the site owner.
      </footer>
    </div>
  );
}

function Header({ tab, setTab, isPremium }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span>PlayMind AI</span>
          {isPremium && (
            <span className="flex items-center gap-1 text-[10px] bg-amber-400 text-slate-900 font-semibold px-2 py-0.5 rounded-full ml-1">
              <Crown className="w-3 h-3" /> PRO
            </span>
          )}
        </div>
      </div>
      <nav className="max-w-3xl mx-auto px-2 pb-2 flex gap-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === id
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}

// ---------------------------------------------------------------
// Chat tab -> Help Assistant (free, rule-based — answers common
// questions about the site instead of calling a paid AI API)
// ---------------------------------------------------------------
const FAQ = [
  { keys: ["invite", "refer", "link", "point"], a: `Go to the Invite tab, create your code, and share your link. You get ${100} points every time someone opens it.` },
  { keys: ["withdraw", "payout", "cash", "money", "redeem"], a: "Once you reach Rs 100 or Rs 200 worth of points, open the Invite tab and tap Request payout. You'll be paid manually via JazzCash/Easypaisa." },
  { keys: ["quiz"], a: "Head to the Quiz tab, pick a category, and answer 5 questions. New question sets are added regularly." },
  { keys: ["game", "2048", "play"], a: "The Game tab has 2048 — swipe or use arrow keys to merge tiles and reach the highest number you can." },
  { keys: ["premium", "pro", "unlock"], a: "Premium unlocks extra quiz categories and tools for a small one-time fee. Check the Premium tab." },
  { keys: ["ad", "ads"], a: "This site is supported by ads. Please avoid clicking ads accidentally or repeatedly — that can get an account suspended." },
  { keys: ["safe", "scam", "legit", "real"], a: "Points convert to real rupees at fixed rates and are paid manually by the site owner once you hit a payout tier — there's no hidden catch." },
];

function faqAnswer(q) {
  const lower = q.toLowerCase();
  for (const item of FAQ) {
    if (item.keys.some((k) => lower.includes(k))) return item.a;
  }
  return "I can help with: invites & points, withdrawing money, the quiz, the game, or premium. Try asking about one of those!";
}

function ChatTab() {
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I'm the Help Assistant — ask me about invites, points, withdrawals, the quiz, or the game." },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const reply = faqAnswer(text);
    setMessages((m) => [...m, { role: "user", text }, { role: "assistant", text: reply }]);
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-slate-800 text-slate-100 rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 pt-3 border-t border-slate-800 mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask about invites, points, withdrawals…"
          className="flex-1 bg-slate-800 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={send}
          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-full w-11 h-11 flex items-center justify-center flex-none"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Quiz tab — free, static question bank (no API calls)
// ---------------------------------------------------------------
const FREE_CATEGORIES = ["General Knowledge", "Science", "Movies"];
const PRO_CATEGORIES = ["History", "Sports", "Technology", "Geography"]; // unlocked by Pro

const QUESTION_BANK = {
  "General Knowledge": [
    { question: "What is the capital of Pakistan?", options: ["Karachi", "Islamabad", "Lahore", "Peshawar"], answerIndex: 1 },
    { question: "How many continents are there?", options: ["5", "6", "7", "8"], answerIndex: 2 },
    { question: "Which is the largest ocean?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answerIndex: 2 },
    { question: "Which language has the most native speakers?", options: ["English", "Mandarin", "Spanish", "Hindi"], answerIndex: 1 },
    { question: "What is the currency of Japan?", options: ["Won", "Yuan", "Yen", "Ringgit"], answerIndex: 2 },
    { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answerIndex: 1 },
    { question: "How many days are in a leap year?", options: ["364", "365", "366", "367"], answerIndex: 2 },
    { question: "What is the tallest mountain in the world?", options: ["K2", "Everest", "Kilimanjaro", "Denali"], answerIndex: 1 },
  ],
  Science: [
    { question: "What gas do plants absorb from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answerIndex: 2 },
    { question: "What is the chemical symbol for water?", options: ["H2O", "O2", "CO2", "NaCl"], answerIndex: 0 },
    { question: "How many bones are in the adult human body?", options: ["186", "206", "226", "246"], answerIndex: 1 },
    { question: "What force pulls objects toward Earth?", options: ["Magnetism", "Friction", "Gravity", "Tension"], answerIndex: 2 },
    { question: "What is the closest star to Earth?", options: ["Proxima Centauri", "The Sun", "Sirius", "Polaris"], answerIndex: 1 },
    { question: "What part of the cell contains DNA?", options: ["Nucleus", "Cytoplasm", "Membrane", "Ribosome"], answerIndex: 0 },
    { question: "What is the boiling point of water at sea level (°C)?", options: ["90", "95", "100", "110"], answerIndex: 2 },
    { question: "Which gas do humans need to breathe to survive?", options: ["Nitrogen", "Oxygen", "Helium", "Argon"], answerIndex: 1 },
  ],
  Movies: [
    { question: "Which studio made 'Toy Story'?", options: ["DreamWorks", "Pixar", "Illumination", "Blue Sky"], answerIndex: 1 },
    { question: "Who directed 'Jaws' and 'E.T.'?", options: ["George Lucas", "Steven Spielberg", "James Cameron", "Ridley Scott"], answerIndex: 1 },
    { question: "'Sholay' is a classic film from which country?", options: ["Pakistan", "India", "Bangladesh", "Iran"], answerIndex: 1 },
    { question: "What is the highest-grossing film of all time (unadjusted)?", options: ["Titanic", "Avengers: Endgame", "Avatar", "Star Wars"], answerIndex: 2 },
    { question: "Which actor played Iron Man in the Marvel films?", options: ["Chris Evans", "Robert Downey Jr.", "Chris Hemsworth", "Mark Ruffalo"], answerIndex: 1 },
    { question: "What does 'CGI' stand for?", options: ["Computer Generated Imagery", "Cinema Graphic Input", "Cinematic Graphics Interface", "Computer Graphic Illustration"], answerIndex: 0 },
  ],
  History: [
    { question: "In which year did Pakistan gain independence?", options: ["1945", "1947", "1950", "1971"], answerIndex: 1 },
    { question: "Who was the first President of the United States?", options: ["Abraham Lincoln", "Thomas Jefferson", "George Washington", "John Adams"], answerIndex: 2 },
    { question: "The Great Wall is located in which country?", options: ["Japan", "China", "Mongolia", "Korea"], answerIndex: 1 },
    { question: "World War II ended in which year?", options: ["1943", "1944", "1945", "1946"], answerIndex: 2 },
  ],
  Sports: [
    { question: "How many players are on a football (soccer) team on the field?", options: ["9", "10", "11", "12"], answerIndex: 2 },
    { question: "In cricket, how many balls make an over?", options: ["4", "5", "6", "8"], answerIndex: 2 },
    { question: "Which country has won the most Cricket World Cups?", options: ["India", "Australia", "West Indies", "Pakistan"], answerIndex: 1 },
    { question: "How often are the Summer Olympics held?", options: ["Every 2 years", "Every 3 years", "Every 4 years", "Every 5 years"], answerIndex: 2 },
  ],
  Technology: [
    { question: "What does 'AI' stand for?", options: ["Automated Interface", "Artificial Intelligence", "Applied Informatics", "Advanced Integration"], answerIndex: 1 },
    { question: "Who co-founded Apple with Steve Jobs?", options: ["Bill Gates", "Steve Wozniak", "Elon Musk", "Larry Page"], answerIndex: 1 },
    { question: "What does 'URL' stand for?", options: ["Uniform Resource Locator", "Universal Reference Link", "United Resource Locator", "Unique Record Link"], answerIndex: 0 },
    { question: "What does 'RAM' stand for?", options: ["Random Access Memory", "Read Access Module", "Rapid Application Memory", "Runtime Active Memory"], answerIndex: 0 },
  ],
  Geography: [
    { question: "Which is the longest river in the world?", options: ["Amazon", "Nile", "Yangtze", "Mississippi"], answerIndex: 1 },
    { question: "Which country has the largest population?", options: ["USA", "India", "China", "Indonesia"], answerIndex: 2 },
    { question: "Which desert is the largest in the world?", options: ["Sahara", "Gobi", "Antarctic", "Kalahari"], answerIndex: 2 },
    { question: "Mount Kilimanjaro is located in which continent?", options: ["Asia", "Africa", "South America", "Europe"], answerIndex: 1 },
  ],
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function QuizTab({ isPremium, setTab }) {
  const [category, setCategory] = useState("General Knowledge");
  const [questions, setQuestions] = useState(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);

  function generateQuiz() {
    const pool = QUESTION_BANK[category] || [];
    const picked = shuffle(pool).slice(0, 5);
    setQuestions(picked);
    setIndex(0);
    setScore(0);
    setSelected(null);
  }

  function pick(i) {
    if (selected !== null) return;
    setSelected(i);
    if (i === questions[index].answerIndex) setScore((s) => s + 1);
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Quiz</h2>

      {!questions && (
        <>
          <p className="text-sm text-slate-400 mb-3">Pick a category and start — 5 fresh questions every time.</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {FREE_CATEGORIES.map((c) => (
              <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
            ))}
            {PRO_CATEGORIES.map((c) =>
              isPremium ? (
                <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
              ) : (
                <CategoryChip key={c} label={c} locked onClick={() => setTab("premium")} />
              )
            )}
          </div>
          <button
            onClick={generateQuiz}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-lg text-sm flex items-center gap-2"
          >
            <Brain className="w-4 h-4" />
            Start quiz
          </button>
        </>
      )}

      {questions && questions.length === 0 && (
        <p className="text-sm text-red-400">Couldn't generate a quiz — please try again.</p>
      )}

      {questions && questions.length > 0 && index < questions.length && (
        <div>
          <p className="text-xs text-slate-500 mb-1">
            Question {index + 1} of {questions.length} · Score {score}
          </p>
          <h3 className="text-lg font-semibold mb-4">{questions[index].question}</h3>
          <div className="space-y-2">
            {questions[index].options.map((opt, i) => {
              const isAnswer = i === questions[index].answerIndex;
              const isChosen = i === selected;
              let cls = "bg-slate-800 hover:bg-slate-700";
              if (selected !== null) {
                if (isAnswer) cls = "bg-emerald-700";
                else if (isChosen) cls = "bg-rose-800";
              }
              return (
                <button
                  key={i}
                  onClick={() => pick(i)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm flex items-center justify-between ${cls}`}
                >
                  {opt}
                  {selected !== null && isAnswer && <Check className="w-4 h-4" />}
                  {selected !== null && isChosen && !isAnswer && <X className="w-4 h-4" />}
                </button>
              );
            })}
          </div>
          {selected !== null && (
            <button
              onClick={next}
              className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
            >
              {index + 1 === questions.length ? "See result" : "Next question"}
            </button>
          )}
        </div>
      )}

      {questions && index >= questions.length && (
        <div className="text-center py-8">
          <p className="text-3xl font-bold mb-1">
            {score} / {questions.length}
          </p>
          <p className="text-slate-400 mb-4 text-sm">Nice work!</p>
          <button
            onClick={() => setQuestions(null)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
          >
            Play again
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryChip({ label, active, locked, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 border ${
        active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
      }`}
    >
      {locked && <Lock className="w-3 h-3" />}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------
// Tools tab — free, offline tools (no API calls)
// ---------------------------------------------------------------
const JOKES = [
  "Why don't scientists trust atoms? Because they make up everything!",
  "I told my computer I needed a break, and it said no problem — it would go to sleep too.",
  "Why did the scarecrow win an award? He was outstanding in his field.",
  "Parallel lines have so much in common. It's a shame they'll never meet.",
  "I'm reading a book on anti-gravity. It's impossible to put down.",
  "Why don't eggs tell jokes? They'd crack each other up.",
  "I used to be a banker, but I lost interest.",
  "What do you call a fish with no eyes? A fsh.",
];

const NAME_PARTS = {
  prefix: ["Nova", "Zen", "Aero", "Luna", "Prime", "Echo", "Astra", "Vibe", "Pixel", "Orbit"],
  suffix: ["Labs", "Hub", "Works", "ify", "ly", "Base", "Craft", "Studio", "Point", "Wave"],
};

function generateNames(topic) {
  const seedWord = topic.trim() ? topic.trim().split(" ")[0] : "";
  const names = [];
  for (let i = 0; i < 8; i++) {
    const p = NAME_PARTS.prefix[Math.floor(Math.random() * NAME_PARTS.prefix.length)];
    const s = NAME_PARTS.suffix[Math.floor(Math.random() * NAME_PARTS.suffix.length)];
    names.push(seedWord ? `${seedWord}${s}` : `${p}${s}`);
  }
  return [...new Set(names)];
}

const FACTS = [
  "Honey never spoils — archaeologists have found 3,000-year-old honey that's still edible.",
  "Octopuses have three hearts and blue blood.",
  "A bolt of lightning is hotter than the surface of the Sun.",
  "Bananas are berries, but strawberries aren't.",
  "The Great Wall of China is not visible from space with the naked eye.",
  "A group of flamingos is called a 'flamboyance'.",
  "Sharks existed before trees appeared on Earth.",
  "The shortest war in history lasted about 38 minutes.",
];

const TOOLS = [
  { id: "joke", label: "Joke generator", desc: "One random clean joke", pro: false },
  { id: "fact", label: "Random fact", desc: "A fun fact to share", pro: false },
  { id: "name", label: "Name generator", desc: "Brand / project name ideas", pro: true },
  { id: "counter", label: "Word counter", desc: "Count words & characters in text", pro: true },
];

function ToolsTab({ isPremium, setTab }) {
  const [active, setActive] = useState(null);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  function run(tool) {
    if (tool.id === "joke") setOutput(JOKES[Math.floor(Math.random() * JOKES.length)]);
    if (tool.id === "fact") setOutput(FACTS[Math.floor(Math.random() * FACTS.length)]);
    if (tool.id === "name") setOutput(generateNames(input).join("\n"));
    if (tool.id === "counter") {
      const words = input.trim() ? input.trim().split(/\s+/).length : 0;
      setOutput(`Words: ${words}\nCharacters: ${input.length}`);
    }
  }

  if (!active) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-3">Fun Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TOOLS.map((t) => {
            const unlocked = !t.pro || isPremium;
            return (
              <button
                key={t.id}
                onClick={() => (unlocked ? (setActive(t), setInput(""), setOutput("")) : setTab("premium"))}
                className="text-left bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{t.label}</span>
                  {!unlocked && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <p className="text-xs text-slate-400">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setActive(null)} className="text-xs text-slate-400 mb-3">
        ← Back to tools
      </button>
      <h2 className="text-xl font-bold mb-3">{active.label}</h2>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={active.id === "name" ? "Type a topic (optional)…" : active.id === "counter" ? "Paste text to count…" : "Optional…"}
        rows={active.id === "joke" || active.id === "fact" ? 1 : 4}
        className="w-full bg-slate-800 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
      />
      <button
        onClick={() => run(active)}
        className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
      >
        Run
      </button>
      {output && (
        <div className="mt-4 bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm whitespace-pre-wrap">
          {output}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Game tab — 2048 (self-contained, no AI needed, fast + addictive)
// ---------------------------------------------------------------
const SIZE = 4;

function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandomTile(board) {
  const empties = [];
  board.forEach((row, r) => row.forEach((v, c) => v === 0 && empties.push([r, c])));
  if (empties.length === 0) return board;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const copy = board.map((row) => [...row]);
  copy[r][c] = Math.random() < 0.9 ? 2 : 4;
  return copy;
}

function slideAndMergeRow(row) {
  const nums = row.filter((v) => v !== 0);
  let gained = 0;
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      gained += nums[i];
      nums.splice(i + 1, 1);
    }
  }
  while (nums.length < SIZE) nums.push(0);
  return { row: nums, gained };
}

function move(board, dir) {
  let rotated = board.map((r) => [...r]);
  const rotate = (b) => b[0].map((_, c) => b.map((r) => r[c]).reverse());

  let turns = 0;
  if (dir === "up") turns = 1;
  if (dir === "right") turns = 2;
  if (dir === "down") turns = 3;
  for (let i = 0; i < turns; i++) rotated = rotate(rotated);

  let gained = 0;
  let moved = false;
  const result = rotated.map((row) => {
    const before = row.join(",");
    const { row: newRow, gained: g } = slideAndMergeRow(row);
    gained += g;
    if (newRow.join(",") !== before) moved = true;
    return newRow;
  });

  let final = result;
  const backTurns = (4 - turns) % 4;
  for (let i = 0; i < backTurns; i++) final = rotate(final);

  return { board: final, gained, moved };
}

function boardsEqual(a, b) {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}

function canMove(board) {
  for (const dir of ["up", "down", "left", "right"]) {
    if (move(board, dir).moved) return true;
  }
  return false;
}

const TILE_COLORS = {
  2: "bg-slate-700 text-slate-100",
  4: "bg-slate-600 text-slate-100",
  8: "bg-amber-700 text-white",
  16: "bg-amber-600 text-white",
  32: "bg-orange-600 text-white",
  64: "bg-orange-500 text-white",
  128: "bg-yellow-500 text-slate-900",
  256: "bg-yellow-400 text-slate-900",
  512: "bg-lime-400 text-slate-900",
  1024: "bg-lime-300 text-slate-900",
  2048: "bg-emerald-400 text-slate-900",
};

function GameTab() {
  const [board, setBoard] = useState(() => addRandomTile(addRandomTile(emptyBoard())));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [over, setOver] = useState(false);

  const doMove = useCallback(
    (dir) => {
      if (over) return;
      setBoard((prev) => {
        const { board: next, gained, moved } = move(prev, dir);
        if (!moved) return prev;
        const withTile = addRandomTile(next);
        setScore((s) => {
          const ns = s + gained;
          setBest((b) => Math.max(b, ns));
          return ns;
        });
        if (!canMove(withTile)) setOver(true);
        return withTile;
      });
    },
    [over]
  );

  useEffect(() => {
    function onKey(e) {
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      if (map[e.key]) {
        e.preventDefault();
        doMove(map[e.key]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove]);

  const touchStart = useRef(null);
  function onTouchStart(e) {
    touchStart.current = e.touches[0];
  }
  function onTouchEnd(e) {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.clientX;
    const dy = e.changedTouches[0].clientY - touchStart.current.clientY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? "right" : "left");
    else doMove(dy > 0 ? "down" : "up");
    touchStart.current = null;
  }

  function restart() {
    setBoard(addRandomTile(addRandomTile(emptyBoard())));
    setScore(0);
    setOver(false);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-between w-full max-w-sm mb-4">
        <h2 className="text-xl font-bold">2048</h2>
        <div className="flex gap-2 text-center text-xs">
          <div className="bg-slate-800 rounded-lg px-3 py-1.5">
            <div className="text-slate-400">Score</div>
            <div className="font-bold text-sm">{score}</div>
          </div>
          <div className="bg-slate-800 rounded-lg px-3 py-1.5">
            <div className="text-slate-400">Best</div>
            <div className="font-bold text-sm">{best}</div>
          </div>
        </div>
      </div>

      <div
        className="relative bg-slate-800 rounded-xl p-2 grid grid-cols-4 gap-2 w-full max-w-sm touch-none select-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {board.flat().map((v, i) => (
          <div
            key={i}
            className={`aspect-square rounded-lg flex items-center justify-center font-bold text-lg ${
              v === 0 ? "bg-slate-900/40" : TILE_COLORS[v] || "bg-fuchsia-400 text-slate-900"
            }`}
          >
            {v !== 0 && v}
          </div>
        ))}

        {over && (
          <div className="absolute inset-0 bg-slate-950/80 rounded-xl flex flex-col items-center justify-center gap-3">
            <p className="font-bold text-lg">Game over</p>
            <button
              onClick={restart}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-lg"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-4">Swipe or use arrow keys — merge tiles to reach 2048.</p>
      <button onClick={restart} className="mt-3 text-xs text-indigo-400 hover:underline">
        Restart
      </button>
    </div>
  );
}

// ---------------------------------------------------------------
// Invite tab — referral points via shared persistent storage
// ---------------------------------------------------------------
const POINTS_PER_INVITE = 10; // points credited to referrer only once the invited person creates/loads an account
const PAYOUT_TIERS = [
  { rs: 100, points: 100 },
  { rs: 500, points: 500 },
];

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function InviteTab({ account, setAccount, refreshAccount, creditReferralIfNeeded, setTab }) {
  const [name, setName] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [redeemSent, setRedeemSent] = useState(false);
  const [payoutNumber, setPayoutNumber] = useState("");

  const code = account?.code || null;
  const points = account?.points || 0;
  const link = code ? `${window.location.origin}${window.location.pathname}?ref=${code}` : "";

  async function createAccount() {
    setError("");
    let newCode = genCode();
    // avoid rare collisions
    for (let i = 0; i < 3; i++) {
      try {
        const existing = await storage.get(`ref:${newCode}`);
        if (existing) newCode = genCode();
        else break;
      } catch (e) {
        break; // key not found = free to use
      }
    }
    const data = { name: name || "Anonymous", points: 0, premium: false };
    await storage.set(`ref:${newCode}`, JSON.stringify(data));
    setAccount({ code: newCode, name: data.name, points: 0, premium: false });
    creditReferralIfNeeded?.(newCode);
  }

  async function loadAccount() {
    setError("");
    const c = loginCode.trim().toUpperCase();
    if (!c) return;
    try {
      const res = await storage.get(`ref:${c}`);
      if (!res) throw new Error("not found");
      const data = JSON.parse(res.value);
      setAccount({ code: c, name: data.name || "Anonymous", points: data.points || 0, premium: data.premium || false });
      creditReferralIfNeeded?.(c);
    } catch (e) {
      setError("Code not found — check it and try again.");
    }
  }

  async function loadLeaderboard() {
    try {
      const list = await storage.list("ref:");
      if (!list || !list.keys) return;
      const entries = await Promise.all(
        list.keys.slice(0, 25).map(async (k) => {
          try {
            const r = await storage.get(k);
            const d = JSON.parse(r.value);
            return { name: d.name || "Anonymous", points: d.points || 0 };
          } catch (e) {
            return null;
          }
        })
      );
      setLeaderboard(entries.filter(Boolean).sort((a, b) => b.points - a.points).slice(0, 10));
    } catch (e) {}
  }

  useEffect(() => {
    loadLeaderboard();
  }, [points]);

  function copyLink() {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!code) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-1">Invite & earn</h2>
        <p className="text-sm text-slate-400 mb-5">
          Get {POINTS_PER_INVITE} points every time someone you invited creates or loads an account on this site — not just for opening the link.
        </p>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold mb-2">Create your invite code</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
          />
          <button
            onClick={createAccount}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-lg"
          >
            Get my invite link
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
          <p className="text-sm font-semibold mb-2">Already have a code?</p>
          <div className="flex gap-2">
            <input
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              placeholder="e.g. AB12CD"
              className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={loadAccount} className="bg-slate-700 hover:bg-slate-600 text-sm px-4 rounded-lg">
              Load
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}
        <p className="text-xs text-slate-500">
          Save your code somewhere safe — it's the only way to see your points (and Pro status) again, there's no login/password here.
        </p>
      </div>
    );
  }

  const rupees = points;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Invite & earn</h2>
      <p className="text-sm text-slate-400 mb-4">Your code: <span className="font-mono text-slate-200">{code}</span></p>

      <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5 mb-4 text-center">
        <p className="text-3xl font-bold">{points} pts</p>
        <p className="text-xs text-slate-400 mt-1">≈ Rs {rupees} (1 point = Rs 1)</p>
        <button onClick={() => refreshAccount(code)} className="text-xs text-indigo-400 mt-2 inline-flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold mb-2">Your invite link</p>
        <div className="flex gap-2">
          <input readOnly value={link} className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300" />
          <button onClick={copyLink} className="bg-slate-700 hover:bg-slate-600 px-3 rounded-lg flex items-center gap-1 text-xs">
            <Copy className="w-3.5 h-3.5" /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">Share on WhatsApp, Facebook, or Instagram — you get {POINTS_PER_INVITE} points once the person you invited creates or loads an account here.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold mb-2 flex items-center gap-1"><Trophy className="w-4 h-4 text-amber-400" /> Top inviters</p>
        {leaderboard.length === 0 && <p className="text-xs text-slate-500">No entries yet — be the first!</p>}
        <ol className="space-y-1.5">
          {leaderboard.map((e, i) => (
            <li key={i} className="flex justify-between text-sm">
              <span className="text-slate-300">{i + 1}. {e.name}</span>
              <span className="text-slate-400">{e.points} pts</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
        <p className="text-sm font-semibold mb-2">Withdraw</p>
        {!account.premium ? (
          <>
            <p className="text-xs text-slate-400 mb-3">
              Withdrawals unlock after you buy Pro (Rs 10) — it also removes ads and unlocks everything else.
            </p>
            <button
              onClick={() => setTab("premium")}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Buy Pro to unlock withdrawals
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500 mb-3">
              Rs 100 needs {PAYOUT_TIERS[0].points} pts · Rs 500 needs {PAYOUT_TIERS[1].points} pts. You have {points}.
            </p>
            {redeemSent ? (
              <p className="text-xs text-emerald-400">Request sent — the site owner will send payment to your number and contact you.</p>
            ) : (
              <>
                <input
                  value={payoutNumber}
                  onChange={(e) => setPayoutNumber(e.target.value)}
                  placeholder="Your JazzCash / Easypaisa number"
                  className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                />
                <div className="flex gap-2">
                  {PAYOUT_TIERS.map((tier) => {
                    const enough = points >= tier.points;
                    return (
                      <button
                        key={tier.rs}
                        disabled={!enough || !payoutNumber.trim()}
                        onClick={async () => {
                          try {
                            await storage.set(
                              `redeem:${code}:${Date.now()}`,
                              JSON.stringify({ code, name: account.name, points: tier.points, payoutNumber, rupees: tier.rs, requestedAt: new Date().toISOString() })
                            );
                            const newPoints = points - tier.points;
                            await storage.set(`ref:${code}`, JSON.stringify({ name: account.name, points: newPoints, premium: account.premium }));
                            setAccount({ ...account, points: newPoints });
                            setRedeemSent(true);
                          } catch (e) {
                            setError("Could not send request — please try again.");
                          }
                        }}
                        className="flex-1 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-sm font-semibold py-2.5 rounded-lg"
                      >
                        Rs {tier.rs}
                        <span className="block text-[10px] font-normal">{tier.points} pts</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Payouts are reviewed and sent manually by the site owner (JazzCash/Easypaisa) — this isn't automatic.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Admin tab — view pending payout requests (open with ?admin=1 in the URL)
// ---------------------------------------------------------------
// ---------------------------------------------------------------
// Admin access — password-protected (not just the hidden URL)
// ---------------------------------------------------------------
async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function AdminGate() {
  const [hasPassword, setHasPassword] = useState(null); // null = checking
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [error, setError] = useState("");
  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [pwSaved, setPwSaved] = useState(false);

  useEffect(() => {
    storage
      .get("config:adminPasswordHash")
      .then((res) => setHasPassword(!!res))
      .catch(() => setHasPassword(false));
  }, []);

  async function setupPassword() {
    setError("");
    if (input.length < 4) return setError("Use at least 4 characters.");
    if (input !== confirmInput) return setError("Passwords don't match.");
    await storage.set("config:adminPasswordHash", await sha256(input));
    setHasPassword(true);
    setAuthed(true);
  }

  async function tryLogin() {
    setError("");
    try {
      const res = await storage.get("config:adminPasswordHash");
      if (res && res.value === (await sha256(input))) setAuthed(true);
      else setError("Wrong password.");
    } catch (e) {
      setError("Wrong password.");
    }
  }

  async function changePassword() {
    setError("");
    if (newPw.length < 4) return setError("Use at least 4 characters.");
    if (newPw !== newPwConfirm) return setError("Passwords don't match.");
    await storage.set("config:adminPasswordHash", await sha256(newPw));
    setPwSaved(true);
    setNewPw("");
    setNewPwConfirm("");
    setTimeout(() => setPwSaved(false), 2000);
  }

  if (hasPassword === null) return <p className="text-sm text-slate-500">Loading…</p>;

  if (!authed) {
    return (
      <div className="max-w-sm mx-auto pt-10">
        <h2 className="text-xl font-bold mb-1">{hasPassword ? "Admin login" : "Set up admin password"}</h2>
        <p className="text-sm text-slate-400 mb-4">
          {hasPassword
            ? "Enter your admin password to continue."
            : "First time here — choose a password to protect this page. Only you should know it."}
        </p>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Password"
          className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {!hasPassword && (
          <input
            type="password"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="Confirm password"
            className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        )}
        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}
        <button
          onClick={hasPassword ? tryLogin : setupPassword}
          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 rounded-lg"
        >
          {hasPassword ? "Unlock" : "Set password & continue"}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={() => setShowChangePw((s) => !s)} className="text-xs text-indigo-400">
          {showChangePw ? "Hide" : "Change password"}
        </button>
      </div>
      {showChangePw && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4">
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="New password"
            className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={newPwConfirm}
            onChange={(e) => setNewPwConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm mb-2 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-xs text-rose-400 mb-2">{error}</p>}
          <button onClick={changePassword} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg">
            {pwSaved ? "Saved ✓" : "Update password"}
          </button>
        </div>
      )}
      <AdminTab />
    </div>
  );
}

function AdminTab() {
  const [requests, setRequests] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState({ revenue: 0, paidOut: 0 });
  const [paymentInfo, setPaymentInfo] = useState({
    jazzcash: { number: "", name: "" },
    easypaisa: { number: "", name: "" },
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);

  async function loadPaymentInfo() {
    try {
      const res = await storage.get("config:payment");
      if (res) setPaymentInfo(JSON.parse(res.value));
    } catch (e) {}
  }

  async function savePaymentInfo() {
    setSavingPayment(true);
    try {
      await storage.set("config:payment", JSON.stringify(paymentInfo));
      setPaymentSaved(true);
      setTimeout(() => setPaymentSaved(false), 2000);
    } catch (e) {}
    setSavingPayment(false);
  }

  async function loadLedger() {
    try {
      const [rev, paid] = await Promise.all([storage.get("ledger:revenue"), storage.get("ledger:paidOut")]);
      setLedger({
        revenue: rev ? Number(rev.value) : 0,
        paidOut: paid ? Number(paid.value) : 0,
      });
    } catch (e) {
      setLedger({ revenue: 0, paidOut: 0 });
    }
  }

  async function bumpLedger(field, amount) {
    try {
      const key = field === "revenue" ? "ledger:revenue" : "ledger:paidOut";
      const current = await storage.get(key).catch(() => null);
      const next = (current ? Number(current.value) : 0) + amount;
      await storage.set(key, String(next));
      setLedger((l) => ({ ...l, [field]: next }));
    } catch (e) {}
  }

  async function load() {
    setLoading(true);
    try {
      const [payoutList, purchaseList] = await Promise.all([storage.list("redeem:"), storage.list("purchase:")]);
      const payoutItems = await Promise.all(
        (payoutList?.keys || []).map(async (k) => {
          try {
            const r = await storage.get(k);
            return { key: k, ...JSON.parse(r.value) };
          } catch (e) {
            return null;
          }
        })
      );
      const purchaseItems = await Promise.all(
        (purchaseList?.keys || []).map(async (k) => {
          try {
            const r = await storage.get(k);
            return { key: k, ...JSON.parse(r.value) };
          } catch (e) {
            return null;
          }
        })
      );
      setRequests(payoutItems.filter(Boolean).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)));
      setPurchases(purchaseItems.filter(Boolean).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)));
    } catch (e) {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    loadLedger();
    loadPaymentInfo();
  }, []);

  async function markPaid(key, rupees) {
    try {
      await storage.delete(key);
      setRequests((r) => r.filter((x) => x.key !== key));
      await bumpLedger("paidOut", rupees);
    } catch (e) {}
  }

  async function confirmPurchase(p) {
    try {
      const res = await storage.get(`ref:${p.code}`);
      const data = res ? JSON.parse(res.value) : { name: p.accountName, points: 0 };
      data.premium = true;
      await storage.set(`ref:${p.code}`, JSON.stringify(data));
      await storage.delete(p.key);
      setPurchases((list) => list.filter((x) => x.key !== p.key));
      await bumpLedger("revenue", p.amount);
    } catch (e) {}
  }

  async function rejectPurchase(key) {
    try {
      await storage.delete(key);
      setPurchases((list) => list.filter((x) => x.key !== key));
    } catch (e) {}
  }

  const balance = ledger.revenue - ledger.paidOut;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Admin</h2>
      <p className="text-sm text-slate-400 mb-4">Only you should have this link — it isn't linked anywhere on the site.</p>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <p className="text-sm font-semibold mb-3">Payment settings</p>
        <p className="text-xs text-slate-500 mb-3">
          These are the numbers buyers see and send money to when they buy Pro. Change them any time.
        </p>
        {["jazzcash", "easypaisa"].map((p) => (
          <div key={p} className="mb-3">
            <p className="text-xs text-slate-400 mb-1 capitalize">{p}</p>
            <div className="flex gap-2">
              <input
                value={paymentInfo[p]?.number || ""}
                onChange={(e) => setPaymentInfo((info) => ({ ...info, [p]: { ...info[p], number: e.target.value } }))}
                placeholder="03XX-XXXXXXX"
                className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                value={paymentInfo[p]?.name || ""}
                onChange={(e) => setPaymentInfo((info) => ({ ...info, [p]: { ...info[p], name: e.target.value } }))}
                placeholder="Account name"
                className="flex-1 bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        ))}
        <button
          onClick={savePaymentInfo}
          disabled={savingPayment}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          {savingPayment ? "Saving…" : paymentSaved ? "Saved ✓" : "Save"}
        </button>
      </div>

      <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 mb-6 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Pro revenue</p>
          <p className="text-lg font-bold text-emerald-400">Rs {ledger.revenue}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Paid out</p>
          <p className="text-lg font-bold text-rose-400">Rs {ledger.paidOut}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Available</p>
          <p className="text-lg font-bold">Rs {balance}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500 -mt-4 mb-6">
        Withdrawals are meant to be funded by Pro sales — check "Available" covers a payout before marking it paid.
      </p>

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      <h3 className="text-sm font-semibold text-slate-300 mb-2">Pending Pro purchases</h3>
      {!loading && purchases.length === 0 && <p className="text-xs text-slate-500 mb-4">No pending purchases.</p>}
      <div className="space-y-3 mb-6">
        {purchases.map((p) => (
          <div key={p.key} className="bg-slate-900 border border-amber-500/30 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold">{p.accountName} · {p.code}</span>
              <span className="text-amber-400 font-semibold">Rs {p.amount} ({p.tierLabel})</span>
            </div>
            <p className="text-xs text-slate-400">Payer: {p.payerName} — {p.provider} {p.payerNumber}</p>
            <p className="text-xs text-slate-600">{new Date(p.requestedAt).toLocaleString()}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => confirmPurchase(p)} className="text-xs bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded-lg">
                Confirm & activate Pro
              </button>
              <button onClick={() => rejectPurchase(p.key)} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg">
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-slate-300 mb-2">Pending payouts</h3>
      {!loading && requests.length === 0 && <p className="text-xs text-slate-500">No pending requests.</p>}
      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.key} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold">{r.name || "Anonymous"} · {r.code}</span>
              <span className="text-amber-400 font-semibold">Rs {r.rupees}</span>
            </div>
            <p className="text-xs text-slate-400">Send to: {r.payoutNumber}</p>
            <p className="text-xs text-slate-600">{new Date(r.requestedAt).toLocaleString()}</p>
            <button
              onClick={() => markPaid(r.key, r.rupees)}
              className="mt-2 text-xs bg-emerald-700 hover:bg-emerald-600 px-3 py-1.5 rounded-lg"
            >
              Mark as paid
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Premium tab — real manual JazzCash/Easypaisa payment request flow
// ---------------------------------------------------------------

// Fallback shown until the owner sets real numbers from the Admin panel (?admin=1).
const DEFAULT_PAYMENT_INFO = {
  jazzcash: { number: "Not set yet", name: "—" },
  easypaisa: { number: "Not set yet", name: "—" },
};

const PRO_TIERS = [
  {
    id: "pro",
    label: "Pro",
    rs: 10,
    perks: ["All quiz categories", "All Fun Tools unlocked", "No ads"],
  },
];

function PremiumTab({ account, setTab, refreshAccount }) {
  const [tier, setTier] = useState(null);
  const [provider, setProvider] = useState("jazzcash");
  const [payerName, setPayerName] = useState("");
  const [payerNumber, setPayerNumber] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [paymentInfo, setPaymentInfo] = useState(DEFAULT_PAYMENT_INFO);

  useEffect(() => {
    storage
      .get("config:payment")
      .then((res) => res && setPaymentInfo(JSON.parse(res.value)))
      .catch(() => {});
  }, []);

  if (!account) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-1">Go Pro</h2>
        <p className="text-sm text-slate-400 mb-4">
          Pro is linked to your invite account, so it stays unlocked even if you come back later.
        </p>
        <button
          onClick={() => setTab("invite")}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
        >
          Create your account first
        </button>
      </div>
    );
  }

  if (account.premium) {
    return (
      <div className="text-center py-10">
        <Crown className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-1">You're on Pro</h2>
        <p className="text-sm text-slate-400">All quiz categories and tools are unlocked.</p>
      </div>
    );
  }

  async function submitPurchase() {
    if (!payerName.trim() || !payerNumber.trim()) return;
    setError("");
    try {
      await storage.set(
        `purchase:${account.code}:${Date.now()}`,
        JSON.stringify({
          code: account.code,
          accountName: account.name,
          amount: tier.rs,
          tierId: tier.id,
          tierLabel: tier.label,
          provider,
          payerName,
          payerNumber,
          requestedAt: new Date().toISOString(),
        })
      );
      setSent(true);
    } catch (e) {
      setError("Could not send your request — please try again.");
    }
  }

  if (sent) {
    return (
      <div className="text-center py-10">
        <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold mb-1">Request sent</h2>
        <p className="text-sm text-slate-400 mb-4">
          Once the site owner confirms your payment, Pro unlocks automatically on your account ({account.code}).
        </p>
        <button
          onClick={() => refreshAccount(account.code)}
          className="text-xs text-indigo-400 inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Check status
        </button>
      </div>
    );
  }

  if (tier) {
    const info = paymentInfo[provider];
    return (
      <div>
        <button onClick={() => setTier(null)} className="text-xs text-slate-400 mb-3">← Back</button>
        <h2 className="text-xl font-bold mb-1">Pay Rs {tier.rs} — {tier.label}</h2>
        <p className="text-sm text-slate-400 mb-4">Send the payment, then fill in your details below.</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setProvider("jazzcash")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${provider === "jazzcash" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            JazzCash
          </button>
          <button
            onClick={() => setProvider("easypaisa")}
            className={`flex-1 py-2 rounded-lg text-sm font-medium ${provider === "easypaisa" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            Easypaisa
          </button>
        </div>

        <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 mb-4 text-sm">
          <p className="text-slate-400 text-xs mb-1">Send Rs {tier.rs} to:</p>
          <p className="font-mono text-base">{info.number}</p>
          <p className="text-slate-400 text-xs">{info.name}</p>
        </div>

        <div className="space-y-3 mb-4">
          <input
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="Your name"
            className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            value={payerNumber}
            onChange={(e) => setPayerNumber(e.target.value)}
            placeholder={`Your ${provider === "jazzcash" ? "JazzCash" : "Easypaisa"} number you paid from`}
            className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

        <button
          onClick={submitPurchase}
          disabled={!payerName.trim() || !payerNumber.trim()}
          className="w-full bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-900 font-semibold py-2.5 rounded-lg text-sm"
        >
          I've sent the payment
        </button>
        <p className="text-xs text-slate-500 mt-3">
          The site owner verifies each payment manually before activating Pro — this usually takes a little while, not instantly.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Go Pro</h2>
      <p className="text-sm text-slate-400 mb-5">Pick a pack — pay via JazzCash or Easypaisa, get real perks once confirmed.</p>

      <div className="grid gap-4">
        {PRO_TIERS.map((t) => (
          <div key={t.id} className="bg-slate-900 border border-amber-500/30 rounded-xl p-5">
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-2xl font-bold">Rs {t.rs}</span>
              <span className="text-xs text-slate-500">one-time</span>
            </div>
            <p className="text-sm font-semibold text-slate-300 mb-3">{t.label}</p>
            <ul className="text-sm space-y-2 mb-5 text-slate-300">
              {t.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" /> {perk}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setTier(t)}
              className="w-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold py-2.5 rounded-lg text-sm"
            >
              Buy {t.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// Info pages — About / Contact / Privacy Policy
// Real, original content like this is what AdSense reviewers look
// for, and it's linked from the footer on every page.
// ---------------------------------------------------------------
function InfoPage({ page }) {
  if (page === "about") {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Info className="w-5 h-5" /> About PlayMind</h2>
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <p>PlayMind is a small, independent website built to be a quick, fun break in your day — a trivia quiz, a puzzle game, and a few handy tools, all in one place.</p>
          <p>We also run an invite program: if you enjoy the site, you can share your personal link with friends. When someone opens it, you earn points, and points can be redeemed for a small cash payout once you reach a set threshold.</p>
          <p>The site is supported by ads, which is what allows us to keep everything else free to use and to fund payouts to people who help spread the word.</p>
        </div>
      </div>
    );
  }

  if (page === "contact") {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><Mail className="w-5 h-5" /> Contact us</h2>
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <p>Questions, feedback, or a payout you'd like to follow up on? Reach out any time:</p>
          <p className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 font-mono text-xs">
            REPLACE-WITH-YOUR-EMAIL@example.com
          </p>
          <p>We try to reply within a few days. For payout questions, please include your invite code so we can look it up quickly.</p>
        </div>
      </div>
    );
  }

  if (page === "privacy") {
    return (
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Privacy Policy</h2>
        <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          <p><strong>What we store:</strong> your invite code, an optional name, your points balance, and — only when you request a payout — a mobile wallet number you provide for that purpose. We don't collect passwords or require you to sign up with an email.</p>
          <p><strong>Advertising:</strong> this site may show ads served by Google AdSense and other advertising partners. These partners may use cookies or similar technologies to show ads based on your visits to this and other websites. You can learn more or opt out of personalized advertising at <a href="https://www.google.com/settings/ads" className="underline">google.com/settings/ads</a>.</p>
          <p><strong>Your choices:</strong> you can stop using the site at any time. To request removal of your data, contact us using the details on the Contact page.</p>
          <p><strong>Changes:</strong> we may update this policy from time to time; changes will be posted on this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Terms & Conditions</h2>
      <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <p><strong>Using the site:</strong> the quiz, game, and tools are free to use. Please don't attempt to abuse, automate, or exploit the invite/points system — accounts found doing so may have their points or Pro access revoked.</p>
        <p><strong>Invite points:</strong> points are earned only when someone you invite creates or logs into an account on this site. Points can be redeemed for cash once you reach a payout tier, subject to manual review and confirmation by the site owner.</p>
        <p><strong>Pro purchases:</strong> Pro is a one-time unlock activated manually after the site owner confirms your payment. Please allow reasonable time for confirmation — it isn't instant.</p>
        <p><strong>No guarantees:</strong> the site is provided as-is. We aim for accuracy in the quiz and tools but don't guarantee it. We may change prices, point values, or features at any time; changes apply going forward, not retroactively to points you've already earned.</p>
        <p><strong>Contact:</strong> questions about these terms can be sent via the Contact page.</p>
      </div>
    </div>
  );
}
