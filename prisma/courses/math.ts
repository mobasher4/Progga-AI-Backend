import type { CourseData } from "./types";

export const MATH_10: CourseData = {
  id: "math-10",
  subjectId: "math",
  grade: 10,
  title: "General Mathematics",
  titleBn: "সাধারণ গণিত",
  book: "Mathematics, Class 9–10 textbook",
  description: "Real numbers, algebra, geometry, trigonometry, mensuration and statistics — every SSC general maths chapter, explained step by step.",
  chapters: [
    {
      title: "Real Numbers",
      titleBn: "বাস্তব সংখ্যা",
      summary: "The family of real numbers, rational and irrational numbers, and recurring decimals.",
      topics: [
        {
          title: "Classifying real numbers",
          body: String.raw`All the numbers on the number line together are called **real numbers** ($\mathbb{R}$).

### The family tree
- **Natural numbers** $\mathbb{N} = \{1, 2, 3, \dots\}$
- **Integers** $\mathbb{Z} = \{\dots, -2, -1, 0, 1, 2, \dots\}$
- **Rational numbers** $\mathbb{Q}$: can be written as $\dfrac{p}{q}$ where $p, q$ are integers and $q \neq 0$ — for example $\dfrac{3}{4}$, $-5$, $0.25$
- **Irrational numbers:** cannot be written as $\dfrac{p}{q}$ — for example $\sqrt{2}$, $\pi$

Real numbers = rational numbers together with irrational numbers.

### Worked example
Classify $-7$, $\dfrac{2}{3}$, $\sqrt{9}$ and $\sqrt{5}$:
- $-7$ → an integer (and so rational)
- $\dfrac{2}{3}$ → rational
- $\sqrt{9} = 3$ → a natural number!
- $\sqrt{5}$ → irrational`,
          checkpoints: [
            { question: "Which of these is irrational?", options: ["√9", "3/4", "√5", "−7"], answerIndex: 2, explanation: "√5 is not a perfect square, so it can't be written as p/q." },
          ],
        },
        {
          title: "Irrational numbers",
          body: String.raw`A number whose decimal goes on forever **without repeating** is irrational: $\sqrt{2} = 1.41421356\dots$

### Proof that $\sqrt{2}$ is irrational
Suppose $\sqrt{2} = \dfrac{p}{q}$ in lowest terms (no common factor).
1. Square both sides: $2 = \dfrac{p^2}{q^2}$, so $p^2 = 2q^2$.
2. So $p^2$ is even, which means $p$ is even. Write $p = 2k$.
3. Then $4k^2 = 2q^2$, so $q^2 = 2k^2$ — $q$ is even too.
4. But then $p$ and $q$ share the factor 2 — a **contradiction**!

So $\sqrt{2}$ cannot be written as $\dfrac{p}{q}$: it is irrational.

### Finding $\sqrt{2}$ on the number line
Draw a right triangle with both legs 1 unit long. By Pythagoras the hypotenuse is $\sqrt{1^2 + 1^2} = \sqrt{2}$. Swing it onto the number line with a compass!`,
          checkpoints: [
            { question: "In the proof, squaring √2 = p/q gives…", options: ["p = 2q", "p² = 2q²", "p² = q²", "2p = q²"], answerIndex: 1, explanation: "2 = p²/q², so p² = 2q²." },
          ],
        },
        {
          title: "Recurring decimals",
          body: String.raw`Divide 1 by 3 and the 3s never stop: $\dfrac{1}{3} = 0.333\dots = 0.\dot{3}$. Decimals like this are **recurring decimals** — and they are always **rational**.

### Notation
- $0.\dot{3} = 0.333\dots$
- $0.\dot{1}\dot{2} = 0.121212\dots$
- $2.1\dot{4} = 2.1444\dots$

### Turning a recurring decimal into a fraction
Let $x = 0.\dot{4}\dot{5} = 0.4545\dots$
- Two digits repeat, so multiply by 100: $100x = 45.4545\dots$
- Subtract: $100x - x = 45$, so $99x = 45$
- $x = \dfrac{45}{99} = \dfrac{5}{11}$

### Shortcut
For a pure recurring decimal, put the repeating digits over the same number of 9s: $0.\dot{7} = \dfrac{7}{9}$ and $0.\dot{2}\dot{3} = \dfrac{23}{99}$.`,
          checkpoints: [
            { question: "0.777… written as a fraction is…", options: ["7/10", "7/9", "7/99", "1/7"], answerIndex: 1, explanation: "One repeating digit → put it over 9: 7/9." },
          ],
        },
      ],
    },
    {
      title: "Sets and Functions",
      titleBn: "সেট ও ফাংশন",
      summary: "Sets and their operations, Venn diagrams, power sets, ordered pairs, relations and functions.",
      topics: ["Sets and set operations", "Venn diagrams and power sets", "Relations and functions"],
    },
    {
      title: "Algebraic Expressions",
      titleBn: "বীজগাণিতিক রাশি",
      summary: "Algebraic formulae and their uses, factorisation, and the remainder theorem.",
      topics: ["Algebraic formulae", "Factorisation", "Remainder theorem"],
    },
    {
      title: "Exponents and Logarithms",
      titleBn: "সূচক ও লগারিদম",
      summary: "The laws of exponents, logarithms and their laws, and common and natural logarithms.",
      topics: ["Laws of exponents", "Logarithms and their laws", "Common and natural logarithms"],
    },
    {
      title: "Equations with One Variable",
      titleBn: "এক চলকবিশিষ্ট সমীকরণ",
      summary: "Solving linear and quadratic equations in one variable and using them in word problems.",
      topics: ["Linear equations", "Quadratic equations", "Word problems with equations"],
    },
    {
      title: "Lines, Angles and Triangles",
      titleBn: "রেখা, কোণ ও ত্রিভুজ",
      summary: "Angles and parallel lines, congruent triangles, and the main theorems about triangles.",
      topics: ["Angles and parallel lines", "Congruence of triangles", "Theorems on triangles"],
    },
    {
      title: "Practical Geometry",
      titleBn: "ব্যবহারিক জ্যামিতি",
      summary: "Constructing triangles and quadrilaterals from given data with ruler and compass.",
      topics: ["Constructing triangles", "Constructing quadrilaterals"],
    },
    {
      title: "Circle",
      titleBn: "বৃত্ত",
      summary: "Chords and arcs, angles in a circle, and tangents.",
      topics: ["Chords and arcs", "Angles in a circle", "Tangents to a circle"],
    },
    {
      title: "Trigonometric Ratio",
      titleBn: "ত্রিকোণমিতিক অনুপাত",
      summary: "Sine, cosine and tangent of an acute angle, values for standard angles, and trigonometric identities.",
      topics: ["Trigonometric ratios of an acute angle", "Ratios of standard angles", "Trigonometric identities"],
    },
    {
      title: "Distance and Height",
      titleBn: "দূরত্ব ও উচ্চতা",
      summary: "Using angles of elevation and depression to find heights and distances.",
      topics: ["Angles of elevation and depression", "Finding heights and distances"],
    },
    {
      title: "Algebraic Ratio and Proportion",
      titleBn: "বীজগাণিতিক অনুপাত ও সমানুপাত",
      summary: "Ratio, proportion and its properties, and continued proportion.",
      topics: ["Ratio and proportion", "Properties of proportion", "Continued proportion"],
    },
    {
      title: "Simple Simultaneous Equations with Two Variables",
      titleBn: "দুই চলকবিশিষ্ট সরল সহসমীকরণ",
      summary: "Solving pairs of linear equations by substitution, elimination and graphs.",
      topics: ["Substitution and elimination", "Solving by graph", "Word problems with two variables"],
    },
    {
      title: "Finite Series",
      titleBn: "সসীম ধারা",
      summary: "Sequences and series, and the sums of arithmetic and geometric series.",
      topics: ["Sequences and series", "Arithmetic series", "Geometric series"],
    },
    {
      title: "Ratio, Similarity and Symmetry",
      titleBn: "অনুপাত, সদৃশতা ও প্রতিসমতা",
      summary: "Geometric ratio, similar triangles, and line and rotational symmetry.",
      topics: ["Geometric ratio", "Similar triangles", "Symmetry"],
    },
    {
      title: "Area Related Theorems and Constructions",
      titleBn: "ক্ষেত্রফল সম্পর্কিত উপপাদ্য ও সম্পাদ্য",
      summary: "Theorems about the areas of triangles and parallelograms, Pythagoras' theorem, and area constructions.",
      topics: ["Areas of triangles and parallelograms", "Pythagoras' theorem", "Area constructions"],
    },
    {
      title: "Mensuration",
      titleBn: "পরিমিতি",
      summary: "Areas of plane figures, the circle, and the surface area and volume of solids.",
      topics: ["Areas of triangles and quadrilaterals", "Circumference and area of a circle", "Surface area and volume of solids"],
    },
    {
      title: "Statistics",
      titleBn: "পরিসংখ্যান",
      summary: "Organising data, mean, median and mode, and drawing frequency polygons and ogives.",
      topics: ["Organising data", "Mean, median and mode", "Frequency polygons and ogives"],
    },
  ],
};
