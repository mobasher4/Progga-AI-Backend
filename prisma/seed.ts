/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedCourses } from "./courses";

const prisma = new PrismaClient();

// Demo accounts (local development only). Password for all: Progga@123
const DEMO_PASSWORD = "Progga@123";

const SUBJECTS = [
  { id: "math", name: "Mathematics", nameBn: "গণিত", icon: "🔢", color: "#2B7BE8", minGrade: 3, maxGrade: 10 },
  { id: "science", name: "Science", nameBn: "বিজ্ঞান", icon: "🔬", color: "#22C493", minGrade: 3, maxGrade: 10 },
  { id: "english", name: "English", nameBn: "ইংরেজি", icon: "📖", color: "#3BA7FF", minGrade: 3, maxGrade: 12 },
  { id: "bangla", name: "Bangla", nameBn: "বাংলা", icon: "✍️", color: "#FF6B6B", minGrade: 3, maxGrade: 12 },
  { id: "bgs", name: "Bangladesh & Global Studies", nameBn: "বাংলাদেশ ও বিশ্বপরিচয়", icon: "🌏", color: "#FF9F1C", minGrade: 3, maxGrade: 10 },
  { id: "ict", name: "ICT", nameBn: "তথ্য ও যোগাযোগ প্রযুক্তি", icon: "💻", color: "#14B8A6", minGrade: 6, maxGrade: 12 },
  { id: "physics", name: "Physics", nameBn: "পদার্থবিজ্ঞান", icon: "⚛️", color: "#0EA5E9", minGrade: 9, maxGrade: 12 },
  { id: "chemistry", name: "Chemistry", nameBn: "রসায়ন", icon: "🧪", color: "#EC4899", minGrade: 9, maxGrade: 12 },
  { id: "biology", name: "Biology", nameBn: "জীববিজ্ঞান", icon: "🧬", color: "#10B981", minGrade: 9, maxGrade: 12 },
  { id: "higher-math", name: "Higher Math", nameBn: "উচ্চতর গণিত", icon: "📐", color: "#1D4ED8", minGrade: 9, maxGrade: 12 },
];

// Placeholder videos (public sample files) — replace videoUrl with your own
// lesson recordings (mp4 URL) or YouTube video ids (provider: "youtube").
const V = "https://storage.googleapis.com/gtv-videos-bucket/sample/";

const LESSONS = [
  {
    subjectId: "math", grade: 4, chapter: "Fractions", title: "What is a fraction? 🍕", provider: "mp4", videoUrl: `${V}ForBiggerFun.mp4`, durationSec: 60,
    description: "Slice a pizza and discover how fractions describe parts of a whole.",
    checkpoints: [
      { atSec: 15, question: "A pizza is cut into 4 equal slices. You eat 1. What fraction did you eat?", options: ["1/2", "1/4", "4/1", "3/4"], answerIndex: 1, explanation: "1 slice out of 4 equal slices is 1/4." },
      { atSec: 40, question: "Which is bigger: 1/2 or 1/4?", options: ["1/2", "1/4", "They're equal"], answerIndex: 0, explanation: "Cutting into fewer pieces makes each piece bigger, so 1/2 > 1/4." },
    ],
  },
  {
    subjectId: "math", grade: 7, chapter: "Algebra", title: "Balancing equations ⚖️", provider: "mp4", videoUrl: `${V}BigBuckBunny.mp4`, durationSec: 596,
    description: "Think of an equation as a balance scale. Whatever you do to one side, do to the other.",
    checkpoints: [
      { atSec: 30, question: "To solve x + 7 = 12, what should we do to both sides?", options: ["Add 7", "Subtract 7", "Multiply by 7"], answerIndex: 1, explanation: "Subtracting 7 cancels the +7 and keeps the balance." },
      { atSec: 90, question: "If 3x = 18, then x = ?", options: ["6", "15", "54"], answerIndex: 0, explanation: "Divide both sides by 3: 18 ÷ 3 = 6." },
    ],
  },
  {
    subjectId: "math", grade: 6, chapter: "Ratio", title: "Ratios in the kitchen 🍳", provider: "mp4", videoUrl: `${V}ForBiggerJoyrides.mp4`, durationSec: 15,
    description: "Use recipes to understand ratios and scaling.",
    checkpoints: [{ atSec: 8, question: "A recipe uses 2 cups rice : 3 cups water. For 4 cups rice you need…", options: ["5 cups", "6 cups", "8 cups"], answerIndex: 1, explanation: "Double both parts: 2:3 → 4:6." }],
  },
  {
    subjectId: "science", grade: 5, chapter: "Plants", title: "How plants make food 🌱", provider: "mp4", videoUrl: `${V}ForBiggerBlazes.mp4`, durationSec: 15,
    description: "Sunlight, water and air — the recipe for photosynthesis.",
    checkpoints: [{ atSec: 8, question: "Which gas do plants take in to make food?", options: ["Oxygen", "Carbon dioxide", "Nitrogen"], answerIndex: 1, explanation: "Plants use carbon dioxide and release oxygen." }],
  },
  {
    subjectId: "science", grade: 7, chapter: "Matter", title: "Solids, liquids & gases 🧊", provider: "mp4", videoUrl: `${V}ElephantsDream.mp4`, durationSec: 653,
    description: "Why does ice melt? Explore how particles move in each state of matter.",
    checkpoints: [
      { atSec: 40, question: "In which state do particles move the fastest?", options: ["Solid", "Liquid", "Gas"], answerIndex: 2, explanation: "Gas particles have the most energy and move freely." },
      { atSec: 120, question: "Ice turning into water is called…", options: ["Melting", "Freezing", "Evaporation"], answerIndex: 0, explanation: "Solid → liquid is melting." },
    ],
  },
  {
    subjectId: "english", grade: 6, chapter: "Grammar", title: "Tenses made easy ⏰", provider: "mp4", videoUrl: `${V}ForBiggerEscapes.mp4`, durationSec: 15,
    description: "Past, present and future — learn to time-travel with verbs.",
    checkpoints: [{ atSec: 8, question: "'She ___ to school yesterday.'", options: ["go", "went", "will go"], answerIndex: 1, explanation: "'Yesterday' signals the past tense: went." }],
  },
  {
    subjectId: "ict", grade: 8, chapter: "Computing", title: "Binary: how computers count 💻", provider: "mp4", videoUrl: `${V}ForBiggerMeltdowns.mp4`, durationSec: 15,
    description: "Discover why computers only need 0s and 1s.",
    checkpoints: [{ atSec: 8, question: "What is binary 101 in decimal?", options: ["3", "5", "101"], answerIndex: 1, explanation: "1×4 + 0×2 + 1×1 = 5." }],
  },
  {
    subjectId: "physics", grade: 9, chapter: "Motion", title: "Speed, velocity & acceleration 🚀", provider: "mp4", videoUrl: `${V}TearsOfSteel.mp4`, durationSec: 734,
    description: "What's the difference between speed and velocity? Build intuition with real examples.",
    checkpoints: [
      { atSec: 45, question: "A car travels 100 m in 5 s. Its speed is…", options: ["20 m/s", "500 m/s", "0.05 m/s"], answerIndex: 0, explanation: "speed = distance ÷ time = 100 ÷ 5 = 20 m/s." },
      { atSec: 150, question: "Velocity is speed with a…", options: ["mass", "direction", "colour"], answerIndex: 1, explanation: "Velocity is a vector: it has a direction." },
    ],
  },
  {
    subjectId: "chemistry", grade: 10, chapter: "Atoms", title: "Inside the atom ⚛️", provider: "mp4", videoUrl: `${V}Sintel.mp4`, durationSec: 888,
    description: "Protons, neutrons and electrons — meet the tiny team inside every atom.",
    checkpoints: [{ atSec: 60, question: "Which particle has a negative charge?", options: ["Proton", "Neutron", "Electron"], answerIndex: 2, explanation: "Electrons carry negative charge." }],
  },
  {
    subjectId: "higher-math", grade: 11, chapter: "Calculus", title: "Limits: getting closer and closer ∞", provider: "mp4", videoUrl: `${V}ForBiggerFun.mp4`, durationSec: 60,
    description: "Build the intuition behind limits before the formulas.",
    checkpoints: [{ atSec: 20, question: "As x → 0, what does 1/x do for positive x?", options: ["Goes to 0", "Grows without bound", "Stays 1"], answerIndex: 1, explanation: "Dividing 1 by smaller and smaller positive numbers gives larger results." }],
  },
];

type Q = [grade: number, topic: string, prompt: string, options: string[], answer: number, explanation: string, difficulty?: number];

const QUIZ: Record<string, Q[]> = {
  math: [
    [3, "Addition", "What is 27 + 15?", ["32", "42", "41", "52"], 1, "27 + 15 = 27 + 10 + 5 = 42."],
    [3, "Subtraction", "What is 50 − 18?", ["32", "38", "42", "28"], 0, "50 − 18 = 50 − 20 + 2 = 32."],
    [3, "Multiplication", "What is 6 × 7?", ["36", "42", "48", "49"], 1, "6 × 7 = 42."],
    [4, "Fractions", "Which fraction equals 1/2?", ["2/3", "3/6", "1/3", "2/5"], 1, "3/6 simplifies to 1/2."],
    [4, "Division", "24 ÷ 4 = ?", ["4", "6", "8", "5"], 1, "4 × 6 = 24."],
    [5, "Decimals", "0.5 + 0.25 = ?", ["0.75", "0.30", "0.525", "7.5"], 0, "Line up the decimal points: 0.50 + 0.25 = 0.75."],
    [5, "Geometry", "How many sides does a hexagon have?", ["5", "6", "7", "8"], 1, "Hexa means six."],
    [5, "Percent", "50% of 80 is…", ["40", "50", "30", "16"], 0, "50% means half: 80 ÷ 2 = 40."],
    [6, "Ratio", "Simplify the ratio 12 : 18.", ["2 : 3", "3 : 4", "6 : 8", "4 : 6"], 0, "Divide both by 6."],
    [6, "Integers", "−5 + 8 = ?", ["−13", "3", "13", "−3"], 1, "Start at −5 and move 8 steps right: 3."],
    [6, "LCM", "LCM of 4 and 6?", ["12", "24", "2", "10"], 0, "Multiples of 4: 4, 8, 12… 12 is the first shared with 6."],
    [7, "Algebra", "If x + 9 = 15, x = ?", ["6", "24", "9", "5"], 0, "Subtract 9 from both sides."],
    [7, "Algebra", "Simplify 3a + 2a − a.", ["4a", "5a", "6a", "3a"], 0, "3 + 2 − 1 = 4, so 4a."],
    [7, "Geometry", "Angles in a triangle add up to…", ["90°", "180°", "270°", "360°"], 1, "Always 180° in a flat triangle."],
    [8, "Algebra", "Expand (a + b)².", ["a² + b²", "a² + 2ab + b²", "2a + 2b", "a² + ab + b²"], 1, "(a + b)(a + b) = a² + 2ab + b²."],
    [8, "Equations", "Solve 2x − 4 = 10.", ["x = 3", "x = 7", "x = 12", "x = 5"], 1, "Add 4: 2x = 14, divide by 2: x = 7."],
    [9, "Sets", "If A = {1,2,3} and B = {2,3,4}, A ∩ B = ?", ["{1,4}", "{2,3}", "{1,2,3,4}", "{}"], 1, "Intersection keeps common elements."],
    [9, "Pythagoras", "A right triangle has legs 3 and 4. The hypotenuse is…", ["5", "6", "7", "25"], 0, "√(3² + 4²) = √25 = 5."],
    [10, "Trigonometry", "sin 30° = ?", ["1", "1/2", "√3/2", "0"], 1, "A standard value: sin 30° = 1/2."],
    [10, "Quadratics", "Roots of x² − 5x + 6 = 0?", ["2 and 3", "1 and 6", "−2 and −3", "5 and 6"], 0, "(x − 2)(x − 3) = 0."],
  ],
  science: [
    [3, "Living things", "Which of these is a living thing?", ["Stone", "Tree", "Chair", "Water"], 1, "Trees grow, breathe and reproduce."],
    [4, "Senses", "Which organ do we use to smell?", ["Ear", "Nose", "Skin", "Eye"], 1, "The nose detects smells."],
    [5, "Plants", "Plants make food in their…", ["Roots", "Leaves", "Flowers", "Seeds"], 1, "Leaves contain chlorophyll for photosynthesis."],
    [5, "Water", "Water boils at…", ["50 °C", "100 °C", "0 °C", "200 °C"], 1, "At sea level, water boils at 100 °C."],
    [6, "Energy", "The main source of energy for Earth is the…", ["Moon", "Sun", "Wind", "Ocean"], 1, "The Sun powers almost all life and weather."],
    [6, "Body", "Which organ pumps blood?", ["Lungs", "Heart", "Liver", "Kidney"], 1, "The heart is a muscular pump."],
    [7, "Matter", "Which is a chemical change?", ["Melting ice", "Burning paper", "Cutting paper", "Boiling water"], 1, "Burning makes new substances."],
    [7, "Cells", "The control centre of a cell is the…", ["Nucleus", "Wall", "Membrane", "Vacuole"], 0, "The nucleus holds DNA."],
    [8, "Force", "The unit of force is…", ["Joule", "Newton", "Watt", "Pascal"], 1, "Named after Isaac Newton."],
    [8, "Light", "Light travels fastest in…", ["Water", "Glass", "Vacuum", "Air"], 2, "Nothing slows light in a vacuum."],
  ],
  english: [
    [3, "Plurals", "The plural of 'child' is…", ["childs", "children", "childes", "child"], 1, "An irregular plural."],
    [4, "Opposites", "Opposite of 'ancient'?", ["Old", "Modern", "Big", "Slow"], 1, "Ancient = very old, modern = new."],
    [5, "Tenses", "'They ___ football every Friday.'", ["play", "played", "playing", "plays"], 0, "Habitual action with 'they' → play."],
    [6, "Articles", "___ honest man.", ["A", "An", "The", "No article"], 1, "'Honest' starts with a vowel sound."],
    [6, "Tenses", "'She ___ to school yesterday.'", ["go", "went", "goes", "going"], 1, "Past tense of go."],
    [7, "Prepositions", "The book is ___ the table.", ["on", "at", "in", "by"], 0, "On a surface → on."],
    [8, "Voice", "Passive of 'Rina wrote a letter'?", ["A letter is written by Rina", "A letter was written by Rina", "Rina was written a letter", "A letter wrote Rina"], 1, "Past simple passive: was + past participle."],
    [9, "Narration", "He said, 'I am busy.' → He said that he ___ busy.", ["is", "was", "were", "be"], 1, "Present becomes past in reported speech."],
    [10, "Synonyms", "A synonym of 'brave' is…", ["Coward", "Courageous", "Weak", "Shy"], 1, "Courageous means brave."],
    [11, "Vocabulary", "'Ubiquitous' means…", ["Rare", "Found everywhere", "Ancient", "Hidden"], 1, "Ubiquitous = present everywhere."],
  ],
  ict: [
    [6, "Hardware", "Which is an input device?", ["Monitor", "Keyboard", "Printer", "Speaker"], 1, "We put data in with a keyboard."],
    [7, "Internet", "WWW stands for…", ["World Wide Web", "Wide World Web", "Web World Wide", "World Web Wide"], 0, "The World Wide Web."],
    [8, "Number systems", "Binary 1010 = ? (decimal)", ["8", "10", "12", "5"], 1, "8 + 0 + 2 + 0 = 10."],
    [9, "Safety", "A strong password should…", ["Be your name", "Mix letters, numbers & symbols", "Be 1234", "Be shared with friends"], 1, "Mixing characters makes it hard to guess."],
    [10, "Logic", "In Boolean logic, 1 AND 0 = ?", ["1", "0", "2", "10"], 1, "AND is 1 only when both inputs are 1."],
    [11, "Programming", "Which is a programming language?", ["HTML", "Python", "HTTP", "URL"], 1, "Python is a general-purpose language; HTML is markup."],
  ],
  physics: [
    [9, "Motion", "SI unit of velocity?", ["m/s", "m/s²", "N", "kg"], 0, "Distance per time with direction."],
    [9, "Force", "F = ?", ["m/a", "ma", "m + a", "a/m"], 1, "Newton's second law."],
    [10, "Energy", "Kinetic energy = ?", ["mgh", "½mv²", "mv", "Fd²"], 1, "KE = ½mv²."],
    [10, "Waves", "Sound cannot travel through…", ["Air", "Water", "Steel", "Vacuum"], 3, "Sound needs a medium."],
    [11, "Gravity", "g on Earth is about…", ["9.8 m/s²", "98 m/s²", "1 m/s²", "0.98 m/s²"], 0, "Standard gravity ≈ 9.8 m/s²."],
    [12, "Electricity", "Ohm's law: V = ?", ["I/R", "IR", "I + R", "R/I"], 1, "Voltage = current × resistance."],
  ],
  chemistry: [
    [9, "Atoms", "Atomic number equals the number of…", ["Neutrons", "Protons", "Molecules", "Shells"], 1, "Protons define the element."],
    [9, "Symbols", "Chemical symbol of sodium?", ["S", "So", "Na", "Sd"], 2, "From Latin 'natrium'."],
    [10, "Acids", "pH of pure water?", ["0", "7", "14", "1"], 1, "Neutral = 7."],
    [10, "Bonds", "NaCl has which bond?", ["Covalent", "Ionic", "Metallic", "Hydrogen"], 1, "Electron transfer from Na to Cl."],
    [11, "Mole", "1 mole contains about ___ particles.", ["6.02 × 10²³", "3.14 × 10²³", "1 × 10²³", "6.02 × 10²²"], 0, "Avogadro's number."],
    [12, "Organic", "General formula of alkanes?", ["CnH2n", "CnH2n+2", "CnH2n−2", "CnHn"], 1, "Saturated hydrocarbons."],
  ],
  biology: [
    [9, "Cells", "Powerhouse of the cell?", ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"], 1, "Mitochondria make ATP."],
    [9, "Plants", "Green pigment in plants?", ["Haemoglobin", "Chlorophyll", "Melanin", "Keratin"], 1, "Chlorophyll absorbs light."],
    [10, "Genetics", "DNA stands for…", ["Deoxyribonucleic acid", "Dinitro acid", "Double nucleic acid", "Deoxyribose amine"], 0, "Deoxyribonucleic acid."],
    [10, "Human body", "Normal human body temperature?", ["37 °C", "40 °C", "30 °C", "35 °C"], 0, "About 37 °C (98.6 °F)."],
    [11, "Ecology", "Producers in a food chain are…", ["Animals", "Plants", "Fungi", "Bacteria"], 1, "Plants make their own food."],
    [12, "Blood", "Which blood group is the universal donor?", ["A", "B", "AB", "O−"], 3, "O negative has no A, B or Rh antigens."],
  ],
  bangla: [
    [3, "বর্ণ", "কোনটি স্বরবর্ণ?", ["ক", "অ", "ম", "ল"], 1, "অ একটি স্বরবর্ণ।"],
    [5, "সমার্থক শব্দ", "'সূর্য' শব্দের সমার্থক কোনটি?", ["চন্দ্র", "রবি", "তারা", "আকাশ"], 1, "রবি অর্থ সূর্য।"],
    [7, "বিপরীত শব্দ", "'আলো' শব্দের বিপরীত কী?", ["দিন", "অন্ধকার", "রোদ", "তারা"], 1, "আলোর বিপরীত অন্ধকার।"],
    [9, "ব্যাকরণ", "'বিদ্যালয়' শব্দের সন্ধি বিচ্ছেদ কোনটি?", ["বিদ্যা + আলয়", "বিদ্য + আলয়", "বিদ্যা + লয়", "বিদ + আলয়"], 0, "বিদ্যা + আলয় = বিদ্যালয়।"],
  ],
  bgs: [
    [3, "Bangladesh", "What is the capital of Bangladesh?", ["Chattogram", "Dhaka", "Khulna", "Sylhet"], 1, "Dhaka is the capital."],
    [4, "Bangladesh", "Bangladesh's Victory Day is on…", ["21 February", "26 March", "16 December", "14 April"], 2, "16 December 1971."],
    [5, "Geography", "The longest river flowing through Bangladesh is the…", ["Padma", "Meghna", "Jamuna", "Karnaphuli"], 0, "The Padma (Ganges) is the longest."],
    [6, "History", "International Mother Language Day is…", ["21 February", "26 March", "1 May", "16 December"], 0, "Honouring the 1952 Language Movement."],
    [8, "World", "The largest ocean is the…", ["Atlantic", "Indian", "Pacific", "Arctic"], 2, "The Pacific is the largest."],
  ],
  "higher-math": [
    [11, "Calculus", "d/dx (x²) = ?", ["x", "2x", "x²", "2"], 1, "Power rule: n·xⁿ⁻¹."],
    [11, "Matrices", "A 2×3 matrix has how many elements?", ["5", "6", "9", "3"], 1, "2 rows × 3 columns."],
    [12, "Calculus", "∫ 2x dx = ?", ["x² + C", "2x² + C", "x + C", "2 + C"], 0, "Reverse of the power rule."],
    [12, "Complex numbers", "i² = ?", ["1", "−1", "i", "0"], 1, "By definition i = √−1."],
    [9, "Sequences", "Next term: 2, 4, 8, 16, …", ["18", "24", "32", "20"], 2, "Each term doubles."],
  ],
};

function code(seed: string) {
  return seed.toUpperCase().padEnd(6, "X").slice(0, 6);
}

async function main() {
  console.log("🌱 Seeding Progga…");
  await prisma.$transaction([
    prisma.tutorMessage.deleteMany(),
    prisma.tutorSession.deleteMany(),
    prisma.quizAttempt.deleteMany(),
    prisma.quizQuestion.deleteMany(),
    prisma.lessonProgress.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.chapter.deleteMany(),
    prisma.course.deleteMany(),
    prisma.subject.deleteMany(),
    prisma.xpEvent.deleteMany(),
    prisma.userBadge.deleteMany(),
    prisma.userItem.deleteMany(),
    prisma.questClaim.deleteMany(),
    prisma.safetyEvent.deleteMany(),
    prisma.guardianLink.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  for (const [i, s] of SUBJECTS.entries()) await prisma.subject.create({ data: { ...s, order: i } });
  for (const [i, l] of LESSONS.entries()) await prisma.lesson.create({ data: { ...l, order: i, xpReward: 20 } });
  const courses = await seedCourses(prisma);
  for (const [subjectId, qs] of Object.entries(QUIZ)) {
    await prisma.quizQuestion.createMany({
      data: qs.map(([grade, topic, prompt, options, answerIndex, explanation, difficulty]) => ({
        subjectId, grade, topic, prompt, options, answerIndex, explanation, difficulty: difficulty ?? 1,
      })),
    });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

  const students = [
    { name: "Rafi Ahmed", email: "rafi@demo.progga.ai", grade: 7, xp: 420, coins: 140, streak: 4, skin: "classic" },
    { name: "Nusrat Jahan", email: "nusrat@demo.progga.ai", grade: 4, xp: 260, coins: 90, streak: 2, skin: "rose" },
    { name: "Tanvir Hasan", email: "tanvir@demo.progga.ai", grade: 7, xp: 610, coins: 60, streak: 9, skin: "ocean" },
    { name: "Ayesha Siddiqua", email: "ayesha@demo.progga.ai", grade: 8, xp: 520, coins: 75, streak: 6, skin: "mint" },
    { name: "Mahin Rahman", email: "mahin@demo.progga.ai", grade: 6, xp: 180, coins: 30, streak: 1, skin: "mango" },
    { name: "Sadia Islam", email: "sadia@demo.progga.ai", grade: 11, xp: 900, coins: 210, streak: 12, skin: "galaxy" },
  ];

  const created: Record<string, string> = {};
  for (const s of students) {
    const u = await prisma.user.create({
      data: {
        name: s.name, email: s.email, passwordHash, role: "STUDENT", grade: s.grade, xp: s.xp, coins: s.coins,
        streakDays: s.streak, bestStreak: s.streak, lastActiveDate: today, avatarSkin: s.skin, linkCode: code(s.name.replace(/\s/g, "")),
      },
    });
    created[s.email] = u.id;
    if (s.skin !== "classic") await prisma.userItem.create({ data: { userId: u.id, itemId: s.skin } });
    // spread this week's XP so the leaderboard has life in it
    await prisma.xpEvent.createMany({
      data: Array.from({ length: 6 }, (_, k) => ({ userId: u.id, amount: Math.round(s.xp / 12), reason: k % 2 ? "tutor_step" : "quiz_correct", day: today })),
    });
  }
  await prisma.userBadge.createMany({
    data: ["first_step", "problem_solver", "streak_3"].map((badgeId) => ({ userId: created["rafi@demo.progga.ai"], badgeId })),
  });

  const parent = await prisma.user.create({
    data: { name: "Farzana Ahmed", email: "parent@demo.progga.ai", passwordHash, role: "PARENT", linkCode: "PARENT" },
  });
  const teacher = await prisma.user.create({
    data: { name: "Kamal Hossain", email: "teacher@demo.progga.ai", passwordHash, role: "TEACHER", linkCode: "TEACHR" },
  });
  await prisma.user.create({
    data: { name: "Progga Admin", email: "admin@demo.progga.ai", passwordHash, role: "ADMIN", linkCode: "ADMINX" },
  });
  await prisma.guardianLink.create({ data: { guardianId: parent.id, studentId: created["rafi@demo.progga.ai"] } });
  for (const email of ["rafi@demo.progga.ai", "tanvir@demo.progga.ai", "ayesha@demo.progga.ai"]) {
    await prisma.guardianLink.create({ data: { guardianId: teacher.id, studentId: created[email] } });
  }

  console.log(`✅ Seeded ${SUBJECTS.length} subjects, ${LESSONS.length} lessons, ${Object.values(QUIZ).flat().length} quiz questions`);
  console.log(`📚 ${courses.courses} courses, ${courses.chapters} chapters, ${courses.topics} topics`);
  console.log(`👤 Demo logins (password: ${DEMO_PASSWORD}): rafi@demo.progga.ai (student), parent@demo.progga.ai, teacher@demo.progga.ai, admin@demo.progga.ai`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
