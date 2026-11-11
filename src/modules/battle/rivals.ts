// Practice rivals: when no real student of your class and league is online,
// Progga plays you itself under a typical Bangladeshi student name. The battle is
// marked `isBot` in the database, so guardians and admins can always tell.

const BOYS = [
  "Rafi", "Tanvir", "Arif", "Sakib", "Nafis", "Rakib", "Fahim", "Mahin", "Ayaan", "Rayhan", "Siam", "Imran",
  "Tahmid", "Shihab", "Nayeem", "Sabbir", "Rifat", "Fardin", "Zarif", "Ishraq", "Tamim", "Abrar", "Junaid", "Mehedi",
  "Sajid", "Hasib", "Raihan", "Tasin", "Labib", "Adnan", "Shafin", "Arnob", "Pranto", "Sourav", "Anik", "Riyad",
];
const GIRLS = [
  "Nusrat", "Ayesha", "Sadia", "Tasnim", "Farhana", "Mim", "Raisa", "Anika", "Sumaiya", "Lamia", "Nabila", "Tahsin",
  "Jannat", "Maliha", "Samiha", "Orin", "Prova", "Nowshin", "Fariha", "Tanjila", "Afia", "Zara", "Ishita", "Rumana",
  "Sanjida", "Mithila", "Purnota", "Adiba", "Labiba", "Rodela", "Nazia", "Meherin", "Tithi", "Bushra", "Shreya", "Anusha",
];
const SURNAMES = [
  "Ahmed", "Hossain", "Rahman", "Islam", "Hasan", "Chowdhury", "Khan", "Akter", "Sarker", "Talukder", "Mia", "Uddin",
  "Karim", "Siddique", "Haque", "Alam", "Begum", "Sultana", "Majumder", "Bhuiyan", "Molla", "Sheikh", "Das", "Roy",
  "Saha", "Paul", "Biswas", "Barua", "Kabir", "Mahmud", "Jahan", "Ferdous", "Nahar", "Rashid", "Bari", "Mostafa",
];
const SKINS = ["classic", "mango", "mint", "ocean", "rose", "ninja", "galaxy", "gold"];

const pick = <T>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

export function rivalName(avoid?: string): string {
  for (;;) {
    const first = Math.random() < 0.5 ? pick(BOYS) : pick(GIRLS);
    const name = `${first} ${pick(SURNAMES)}`;
    if (name !== avoid) return name;
  }
}

export const rivalSkin = () => pick(SKINS);

export interface PlannedAnswer {
  choice: number; // -1 = ran out of time
  correct: boolean;
  ms: number; // thinking time on this question
  at: number; // ms after the battle starts when this answer lands
}

/**
 * Plans the rival's whole game up front so its score can be revealed live as
 * the clock runs. Skill tracks the student's form so most battles are close:
 * a losing streak gives an easier rival, a winning streak a sharper one.
 */
export function planRival(opts: {
  questions: { answerIndex: number; options: unknown[] }[];
  difficulty: number;
  form: number; // student's current win streak (>0) or loss streak (<0)
  timeLimitMs: number;
  revealMs: number;
}): PlannedAnswer[] {
  const { questions, difficulty, form, timeLimitMs, revealMs } = opts;
  const formShift = form <= -2 ? -0.12 : form >= 3 ? 0.08 : form >= 1 ? 0.03 : 0;
  const accuracy = Math.min(0.9, Math.max(0.35, 0.58 + (Math.random() - 0.5) * 0.24 + formShift));
  const pace = 0.8 + Math.random() * 0.5; // some rivals are just quicker
  let clock = 0;
  return questions.map((q) => {
    const timedOut = Math.random() < 0.03;
    const correct = !timedOut && Math.random() < accuracy;
    const think = (2200 + difficulty * 450 + Math.random() * 5200) * pace * (correct ? 1 : 1.15);
    const ms = timedOut ? timeLimitMs : Math.min(timeLimitMs - 300, Math.round(think));
    let choice = -1;
    if (!timedOut) {
      if (correct) choice = q.answerIndex;
      else {
        const wrong = q.options.map((_, i) => i).filter((i) => i !== q.answerIndex);
        choice = pick(wrong);
      }
    }
    clock += ms;
    const answer = { choice, correct, ms, at: clock };
    clock += revealMs;
    return answer;
  });
}
