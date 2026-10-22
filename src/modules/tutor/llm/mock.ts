import { normalizePlan, type Evaluation, type Plan, type Step } from "../schemas";
import type { EvalInput, PlanInput, TutorLLM } from "./types";

/**
 * Offline tutor used when no Claude credentials are configured (local UI work,
 * demos, CI). It understands linear equations and basic arithmetic, and falls
 * back to a generic "explain it back" concept plan for anything else.
 */
export class MockTutor implements TutorLLM {
  readonly name = "mock";
  readonly model = "offline";
  readonly supportsImages = true; // photos are accepted but ignored

  async plan({ question }: PlanInput): Promise<Plan> {
    const q = question.replace(/\s+/g, " ").trim();
    return normalizePlan(linearPlan(q) ?? arithmeticPlan(q) ?? factPlan(q) ?? conceptPlan(q));
  }

  /** The offline tutor only speaks English, so its plans stay as they are. */
  async translatePlan(plan: Plan): Promise<Plan> {
    return plan;
  }

  async evaluate({ step, reply }: EvalInput): Promise<Evaluation> {
    const r = reply.toLowerCase().trim();
    if (/(just )?(tell|give|show) me (the )?(answer|solution)|i don'?t know|idk|pari na|jani na/.test(r)) {
      return {
        verdict: "asks_for_answer",
        feedback: "I know it feels tricky, but your brain grows when *you* crack it! 💪 I'm right here with you.",
        follow_up: `Let's take a tiny first move: ${step.hints[0]}`,
        misconception: "",
      };
    }
    if (r.endsWith("?")) {
      return {
        verdict: "question",
        feedback: "Great question — curious minds learn fastest! Think of it like this: we only ever do one small move at a time.",
        follow_up: step.prompt,
        misconception: "",
      };
    }
    if (isMatch(step.expected, r)) {
      return { verdict: "correct", feedback: "Yes! You spotted exactly the right move. 🎉", follow_up: "", misconception: "" };
    }
    return {
      verdict: "incorrect",
      feedback: "Not quite yet — but that's how learning works! Let's check it together.",
      follow_up: step.hints[0],
      misconception: "mock: answer did not match",
    };
  }
}

function isMatch(expected: string, reply: string): boolean {
  if (!expected) return reply.split(/\s+/).length >= 3; // open reflection step
  const expNum = expected.match(/-?\d+(\.\d+)?/)?.[0];
  if (expNum) return (reply.match(/-?\d+(\.\d+)?/g) ?? []).some((n) => Number(n) === Number(expNum));
  return expected
    .toLowerCase()
    .split("|")
    .some((alt) => reply.includes(alt.trim()));
}

const base = (p: Partial<Plan> & Pick<Plan, "title" | "topic" | "steps" | "final_answer">): Plan => ({
  safety: "ok",
  safety_reply: "",
  mode: "problem",
  big_idea: "",
  intro: "",
  recap: "",
  practice_problem: "",
  answer: "",
  more_info: [],
  fun_fact: "",
  explore_next: [],
  ...p,
});

// A tiny offline knowledge base so the "fact" flow can be demoed without Claude.
const FACTS: { match: RegExp; title: string; topic: string; answer: string; more: string[]; fun: string; explore: string[] }[] = [
  {
    match: /capital.*bangladesh|bangladesh.*capital/i,
    title: "Capital of Bangladesh",
    topic: "Bangladesh geography",
    answer: "The capital of Bangladesh is **Dhaka** 🏙️",
    more: [
      "Dhaka sits on the banks of the **Buriganga River** in the centre of the country.",
      "It is one of the most crowded cities on Earth, home to more than 2 crore people in the greater city area.",
      "Dhaka is nicknamed the **City of Mosques**: there are thousands of them, including the 17th-century Lalbagh Fort mosque.",
      "It became the capital of independent Bangladesh after the Liberation War in 1971.",
    ],
    fun: "Dhaka is often called the **Rickshaw Capital of the World**: hundreds of thousands of colourful rickshaws roll through its streets every day!",
    explore: ["Why is the Buriganga River important for Dhaka?", "What happened in the Liberation War of 1971?", "What are the capitals of other South Asian countries?"],
  },
  {
    match: /national flower/i,
    title: "Our national flower",
    topic: "National symbols",
    answer: "The national flower of Bangladesh is the **Shapla** (white water lily) 🪷",
    more: ["Shapla grows in ponds, haors and beels all over Bangladesh.", "You can see it on our coins, banknotes and the national emblem."],
    fun: "Shapla flowers open in the morning and close again in the afternoon!",
    explore: ["What is the national fruit of Bangladesh?", "What is shown on the national emblem?"],
  },
  {
    match: /national (fruit)/i,
    title: "Our national fruit",
    topic: "National symbols",
    answer: "The national fruit of Bangladesh is the **jackfruit** (kathal) 🍈",
    more: ["Jackfruit is the largest fruit that grows on a tree.", "Ripe jackfruit is sweet; green jackfruit is cooked as a vegetable curry."],
    fun: "A single jackfruit can weigh more than 30 kg, heavier than many Class 3 students!",
    explore: ["What is the national animal of Bangladesh?", "Why do plants grow fruits?"],
  },
  {
    match: /largest planet|biggest planet/i,
    title: "The biggest planet",
    topic: "Solar system",
    answer: "The largest planet in our solar system is **Jupiter** 🪐",
    more: ["More than 1,300 Earths could fit inside Jupiter.", "It is a gas giant, so it has no solid ground to stand on.", "Its Great Red Spot is a storm bigger than Earth."],
    fun: "A day on Jupiter lasts only about 10 hours, the shortest of any planet!",
    explore: ["Why does Jupiter have a Great Red Spot?", "What is the smallest planet?"],
  },
];

function factPlan(q: string): Plan | null {
  if (!/^(what|who|when|where|which|name)\b|^(কে|কী|কি|কোথায়|কবে)/i.test(q) || /\b(why|how)\b/i.test(q)) return null;
  const f = FACTS.find((x) => x.match.test(q));
  return base({
    mode: "fact",
    title: f?.title ?? "Quick answer",
    topic: f?.topic ?? "General knowledge",
    big_idea: "",
    steps: [],
    answer: f?.answer ?? "I'm in **offline practice mode**, so I can't look that up right now. Connect Claude to get a full answer! 🍌",
    final_answer: f?.answer ?? "",
    more_info: f?.more ?? [],
    fun_fact: f?.fun ?? "",
    explore_next: f?.explore ?? [],
  });
}

function linearPlan(q: string): Plan | null {
  const m = q.match(/(\d*)\s*([a-z])\s*([+-])\s*(\d+)\s*=\s*(-?\d+)/i);
  if (!m) return null;
  const a = Number(m[1] || 1);
  const v = m[2];
  const sign = m[3];
  const b = Number(m[4]);
  const c = Number(m[5]);
  const rhs = sign === "+" ? c - b : c + b;
  const ans = rhs / a;
  const undo = sign === "+" ? "subtract" : "add";
  const eq = `${a === 1 ? "" : a}${v} ${sign} ${b} = ${c}`;

  const steps: Step[] = [
    {
      goal: "Find what's unknown",
      prompt: `In $${eq}$, which letter are we trying to find?`,
      expected: v,
      options: [v, String(b), String(c)],
      hints: ["Look for the letter — letters stand for numbers we don't know yet.", `It's the only letter in the equation!`, `The unknown is written next to the ${a === 1 ? "start" : `number ${a}`}.`],
      why: "Naming the unknown first tells us our mission: get that letter all alone on one side.",
      explain:
        "In an equation, a **letter** is a secret number we haven't found yet — we call it the *unknown*. Numbers like 3 or 7 are already known. For example, in $y + 4 = 9$ the unknown is $y$, because it's the only thing we don't know. Look at your equation the same way: which symbol is not a number?",
    },
    {
      goal: `Undo the ${sign}${b}`,
      prompt: `To get $${a === 1 ? "" : a}${v}$ alone, we ${undo} ${b} on **both** sides. What is $${c} ${sign === "+" ? "-" : "+"} ${b}$?`,
      expected: String(rhs),
      options: [String(rhs), String(sign === "+" ? c + b : c - b), String(c)],
      hints: ["An equation is like a balance — whatever we do to one side, we do to the other.", `${sign === "+" ? "Taking away" : "Adding"} ${b} cancels the ${sign}${b}.`, `Try with smaller numbers: if $${v} + 2 = 7$, then $${v} = 7 - 2$.`],
      why: `${undo === "subtract" ? "Subtracting" : "Adding"} ${b} cancels the ${sign}${b} and keeps the equation balanced, because we did the same thing to both sides.`,
      explain: `Think of an equation as a **balance scale** ⚖️: both sides weigh the same. To get the unknown alone, we *undo* whatever is attached to it — and to keep the scale balanced, we do it to **both** sides. Example: in $m + 3 = 10$, the $+3$ is undone by subtracting 3, so $m = 10 - 3 = 7$. In your equation, the number attached is ${sign}${b}, so ${undo} ${b} from the other side too.`,
    },
  ];
  if (a !== 1) {
    steps.push({
      goal: `Undo the ×${a}`,
      prompt: `Now we have $${a}${v} = ${rhs}$. What number times ${a} gives ${rhs}?`,
      expected: String(ans),
      options: [String(ans), String(rhs * a), String(rhs - a)],
      hints: [`$${a}${v}$ means ${a} times ${v}. What's the opposite of multiplying?`, `Divide both sides by ${a}.`, `Like this: if $2y = 10$, then $y = 10 \\div 2 = 5$.`],
      why: `Dividing by ${a} undoes multiplying by ${a}, leaving ${v} all alone.`,
      explain: `When a number sits right next to a letter, like $${a}${v}$, it means **${a} times ${v}**. The opposite of multiplying is **dividing**, so we divide both sides by that number. Example: $3k = 12$ means "3 groups of $k$ make 12", so $k = 12 \\div 3 = 4$. Do the same with your numbers.`,
    });
  }
  return base({
    title: "Solve for the mystery number",
    topic: "Linear equations",
    big_idea: "An equation is a balance: do the same thing to both sides to get the unknown alone.",
    intro: `Let's crack $${eq}$ together! Think of it as a balance scale ⚖️ — we'll keep it balanced while we free $${v}$.`,
    steps,
    final_answer: `${v} = ${ans}`,
    recap: `- Name the unknown\n- Undo adding/subtracting first\n- Then undo multiplying\n- Always do the same to **both** sides`,
    practice_problem: `$${a + 1}${v} + ${b + 2} = ${(a + 1) * 4 + b + 2}$`,
  });
}

function arithmeticPlan(q: string): Plan | null {
  const m = q.match(/(\d+)\s*([+\-×*÷/])\s*(\d+)/);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[3]);
  const op = m[2];
  const ops: Record<string, [string, (a: number, b: number) => number]> = {
    "+": ["add", (a, b) => a + b],
    "-": ["subtract", (a, b) => a - b],
    "×": ["multiply", (a, b) => a * b],
    "*": ["multiply", (a, b) => a * b],
    "÷": ["divide", (a, b) => a / b],
    "/": ["divide", (a, b) => a / b],
  };
  const [name, fn] = ops[op];
  const tens = Math.floor(y / 10) * 10;
  const ones = y % 10;
  const steps: Step[] = [
    {
      goal: "Spot the operation",
      prompt: `In $${x} ${op} ${y}$, do we add, subtract, multiply or divide?`,
      expected: name,
      options: ["add", "subtract", "multiply", "divide"],
      hints: ["Look at the symbol between the numbers.", `The symbol is "${op}".`, `"${op}" means we ${name.slice(0, 3)}…`],
      why: "Knowing the operation tells us which strategy to use.",
      explain: 'The little symbol between two numbers tells us what to do: **+** means add (put together), **−** means subtract (take away), **×** means multiply (groups of), and **÷** means divide (share equally). For example, in $6 \\times 2$ the symbol "×" tells us to multiply. Look at the symbol in your problem and name it.',
    },
  ];
  if (tens && ones && (name === "add" || name === "multiply")) {
    steps.push({
      goal: "Use the tens first",
      prompt: `Let's split ${y} into ${tens} + ${ones}. What is $${x} ${name === "add" ? "+" : "\\times"} ${tens}$?`,
      expected: String(fn(x, tens)),
      options: [String(fn(x, tens)), String(fn(x, tens) + 10), String(fn(x, tens / 10))],
      hints: ["Tens are easy to work with!", `Think in groups of ten.`, `Example: $12 ${name === "add" ? "+ 20 = 32" : "\\times 20 = 240"}$.`],
      why: "Splitting a number into tens and ones makes big sums easy to do in your head.",
      explain: `Big numbers are easier in pieces. We split the second number into **tens** and **ones**, and work with the tens first because tens are friendly. Example: $25 + 30$ — just add 3 tens to 25: $25, 35, 45, 55$. Now try your numbers with ${tens}.`,
    });
    steps.push({
      goal: "Finish with the ones",
      prompt: `Now ${name} the ${ones} as well. What's the total?`,
      expected: String(fn(x, y)),
      options: [String(fn(x, y)), String(fn(x, tens)), String(fn(x, y) + 10)],
      hints: [`Take your last answer and ${name === "add" ? "add" : "add"} the ones part.`, name === "add" ? `${fn(x, tens)} + ${ones}` : `${fn(x, tens)} + ${x} × ${ones}`, "You're one tiny step away!"],
      why: "Putting the parts back together gives the whole answer — that's the distributive idea.",
      explain: `We already did the tens part, so now we finish with the **ones** and add the pieces together. Example: for $25 + 34$ we did $25 + 30 = 55$, then $55 + 4 = 59$. Take your last answer and finish with the ${ones}.`,
    });
  } else {
    steps.push({
      goal: "Work it out",
      prompt: `Now, what is $${x} ${op} ${y}$?`,
      expected: String(fn(x, y)),
      // the right result first, then what the other operations would give
      options: [fn(x, y), x + y, x - y, x * y].map((v) => String(Number(v.toFixed(2)))),
      hints: ["Take it slowly — use your fingers or draw dots if it helps.", `Think about what "${name}" means with real objects.`, `Try a smaller version first: $4 ${op} 2$.`],
      why: `When we ${name}, we combine the numbers in a specific way — practice makes it automatic!`,
      explain: `To ${name}, picture real things. For example, with 8 mangoes and 2 more, adding means counting them all together; sharing 8 mangoes between 2 friends means dividing. Draw dots or use your fingers for your numbers, one at a time.`,
    });
  }
  return base({
    title: `Let's ${name}!`,
    topic: "Arithmetic",
    big_idea: "Breaking numbers into friendly parts makes hard sums easy.",
    intro: `Let's work out $${x} ${op} ${y}$ together, one small move at a time! 🍌`,
    steps,
    final_answer: String(fn(x, y)),
    recap: "- Spot the operation\n- Break numbers into friendly parts\n- Put the parts back together",
    practice_problem: `Your turn: $${x + 3} ${op} ${y + 2}$`,
  });
}

function conceptPlan(q: string): Plan {
  return base({
    mode: "concept",
    title: "Let's explore this idea",
    topic: "Exploration",
    big_idea: "Great understanding is built from small things you already know.",
    intro: `Ooh, interesting question: *"${q.slice(0, 160)}"* 🤔 Let's build the idea together, piece by piece.`,
    steps: [
      {
        goal: "What do you already know?",
        prompt: "Before I explain anything — what do *you* already know or guess about this? Write a sentence or two.",
        expected: "",
        options: [],
        hints: ["There's no wrong answer here — just share your thoughts!", "Think about where you've seen or heard about this before.", "Start with: 'I think it's because…'"],
        why: "Connecting new ideas to what you already know makes them stick much better.",
        explain: "There's no wrong answer here! Scientists always start by saying what they already *think*, then they test it. For example, if someone asks \"why does ice melt?\", you might say \"because the room is warm\" — that's a great start. Just write one sentence about what comes to mind.",
      },
      {
        goal: "Find the key words",
        prompt: "Which words in the question seem most important? Why?",
        expected: "",
        options: [],
        hints: ["Look for nouns and action words.", "Which word would you look up in a dictionary?", "Try: 'The important word is … because …'"],
        why: "Key words tell us exactly what we need to understand.",
        explain: "Key words are the words the whole question depends on — usually the names of things and the action. In \"Why do plants need sunlight?\", the key words are **plants** and **sunlight**, because the question is about how they connect. Pick the one or two words in your question that matter most.",
      },
      {
        goal: "Explain it back",
        prompt: "Now explain the idea in your own words, as if teaching a younger friend.",
        expected: "",
        options: [],
        hints: ["Keep it simple — use an example.", "What would you draw to show it?", "Start with: 'Imagine…'"],
        why: "If you can teach it, you truly understand it!",
        explain: "Explaining to a younger friend means using simple words and one everyday example. For example: \"Plants are like little kitchens — sunlight is the stove that helps them cook food from water and air.\" Try making a picture like that for your idea.",
      },
    ],
    final_answer: "(open-ended)",
    recap: "- Start from what you know\n- Find the key words\n- Explain it in your own words",
    practice_problem: "Explain the same idea to someone at home tonight!",
  });
}
