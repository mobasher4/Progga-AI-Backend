import type { CourseData } from "./types";

export const CHEMISTRY_10: CourseData = {
  id: "chemistry-10",
  subjectId: "chemistry",
  grade: 10,
  title: "Chemistry",
  titleBn: "রসায়ন",
  book: "Chemistry, Class 9–10 textbook",
  description: "Atoms, the periodic table, bonding, moles, reactions, acids and bases and chemistry in daily life — the full SSC chemistry syllabus.",
  chapters: [
    {
      title: "Concepts of Chemistry",
      titleBn: "রসায়নের ধারণা",
      summary: "What chemistry is, how it connects with other sciences and daily life, and how to work safely in the lab.",
      topics: ["What is chemistry?", "Chemistry in everyday life", "Laboratory safety"],
    },
    {
      title: "States of Matter",
      titleBn: "পদার্থের অবস্থা",
      summary: "Solids, liquids and gases, the kinetic theory of matter, diffusion, and changes of state.",
      topics: ["Solid, liquid and gas", "Kinetic theory of matter", "Diffusion and effusion", "Melting, boiling and sublimation"],
    },
    {
      title: "Structure of Matter",
      titleBn: "পদার্থের গঠন",
      summary: "Atoms and molecules, the particles inside an atom, atomic and mass numbers, isotopes and electron configuration.",
      topics: [
        {
          title: "Atoms and molecules",
          body: String.raw`Everything around you is made of tiny particles called **atoms**. An atom is the smallest particle of an element that can take part in a chemical reaction.

### Molecules
When two or more atoms join, they form a **molecule**.
- The same kind of atoms → a molecule of an element: $\text{O}_2$, $\text{N}_2$
- Different atoms → a molecule of a compound: $\text{H}_2\text{O}$, $\text{CO}_2$

### Inside the atom
- **Protons** (+ charge) and **neutrons** (no charge) sit in the tiny central **nucleus**.
- **Electrons** (− charge) move around the nucleus in shells.

An atom has equal numbers of protons and electrons, so it is **electrically neutral**.

### Models of the atom
- **Dalton:** atoms are tiny indivisible spheres.
- **Rutherford:** a small, dense, positive nucleus with electrons around it (from the gold-foil experiment).
- **Bohr:** electrons move in fixed energy levels (shells) without losing energy.`,
          checkpoints: [
            { question: "Which particle has a negative charge?", options: ["Proton", "Neutron", "Electron", "Nucleus"], answerIndex: 2, explanation: "Electrons carry a negative charge." },
          ],
        },
        {
          title: "Atomic number and mass number",
          body: String.raw`### Atomic number ($Z$)
The number of **protons** in the nucleus. It decides which element an atom is: every carbon atom has $Z = 6$.

### Mass number ($A$)
Protons plus neutrons:
$$A = Z + N$$
where $N$ is the number of neutrons.

### Writing it
$^{A}_{Z}\text{X}$ — for example $^{23}_{11}\text{Na}$:
- protons = 11
- electrons = 11 (a neutral atom)
- neutrons = 23 − 11 = **12**

> **Try it:** How many neutrons are in $^{35}_{17}\text{Cl}$?`,
          checkpoints: [
            { question: "How many neutrons does sodium-23 (Z = 11) have?", options: ["11", "12", "23", "34"], answerIndex: 1, explanation: "N = A − Z = 23 − 11 = 12." },
          ],
        },
        {
          title: "Isotopes",
          body: String.raw`Atoms of the **same element** with the **same atomic number** but **different mass numbers** are **isotopes**. They have the same number of protons but different numbers of neutrons.

### Examples
- Hydrogen: $^1_1\text{H}$ (protium), $^2_1\text{H}$ (deuterium), $^3_1\text{H}$ (tritium)
- Carbon: $^{12}_{6}\text{C}$ and $^{14}_{6}\text{C}$

Because their electrons are the same, isotopes have the **same chemical properties**.

### Uses
- $^{14}\text{C}$ — finding the age of fossils (carbon dating)
- $^{60}\text{Co}$ — treating cancer (radiotherapy)
- $^{131}\text{I}$ — diagnosing thyroid problems

### Relative atomic mass
Chlorine is about 75% $^{35}\text{Cl}$ and 25% $^{37}\text{Cl}$:
$$\frac{75 \times 35 + 25 \times 37}{100} = 35.5$$
That's why chlorine's relative atomic mass is 35.5!`,
          checkpoints: [
            { question: "Isotopes of an element differ in their number of…", options: ["Protons", "Electrons", "Neutrons", "Shells"], answerIndex: 2, explanation: "Same protons (same element), different neutrons." },
          ],
        },
        {
          title: "Electron configuration",
          body: String.raw`Electrons fill **shells** (energy levels) around the nucleus: K, L, M, N…

### How many electrons fit?
Shell $n$ holds at most $2n^2$ electrons:
- K ($n = 1$): 2
- L ($n = 2$): 8
- M ($n = 3$): 18

### Subshells
Each shell has subshells **s, p, d, f** holding 2, 6, 10 and 14 electrons. They fill in order of increasing energy:
$$1s \to 2s \to 2p \to 3s \to 3p \to 4s \to 3d \to \dots$$

### Examples
- Sodium (11): $1s^2\, 2s^2\, 2p^6\, 3s^1$
- Chlorine (17): $1s^2\, 2s^2\, 2p^6\, 3s^2\, 3p^5$

The electrons in the outermost shell (**valence electrons**) decide how an element reacts: sodium wants to lose 1 and chlorine wants to gain 1 — so together they make $\text{NaCl}$!`,
          checkpoints: [
            { question: "The L shell (n = 2) can hold at most…", options: ["2 electrons", "8 electrons", "18 electrons", "32 electrons"], answerIndex: 1, explanation: "2n² = 2 × 2² = 8." },
          ],
        },
      ],
    },
    {
      title: "Periodic Table",
      titleBn: "পর্যায় সারণি",
      summary: "How the periodic table was built, groups and periods, and how properties change across it.",
      topics: ["History of the periodic table", "Groups and periods", "Periodic properties"],
    },
    {
      title: "Chemical Bond",
      titleBn: "রাসায়নিক বন্ধন",
      summary: "Why atoms bond, and ionic, covalent and metallic bonds.",
      topics: ["Why atoms form bonds", "Ionic bonds", "Covalent bonds", "Metallic bonds"],
    },
    {
      title: "Concept of Mole and Chemical Counting",
      titleBn: "মোলের ধারণা ও রাসায়নিক গণনা",
      summary: "The mole, molar mass, empirical and molecular formulae, and calculations from equations.",
      topics: ["The mole", "Molar mass", "Empirical and molecular formulae", "Calculations from chemical equations"],
    },
    {
      title: "Chemical Reactions",
      titleBn: "রাসায়নিক বিক্রিয়া",
      summary: "Types of chemical reaction, oxidation and reduction, and what controls the rate of reaction.",
      topics: ["Types of chemical reactions", "Oxidation and reduction", "Rate of reaction"],
    },
    {
      title: "Chemistry and Energy",
      titleBn: "রসায়ন ও শক্তি",
      summary: "Energy changes in reactions, electrolysis, and electrochemical cells.",
      topics: ["Exothermic and endothermic reactions", "Electrolysis", "Electrochemical cells"],
    },
    {
      title: "Acid-Base Balance",
      titleBn: "এসিড-ক্ষার সমতা",
      summary: "Acids and bases, the pH scale, and neutralisation and salts.",
      topics: ["Acids and bases", "The pH scale", "Neutralisation and salts"],
    },
    {
      title: "Mineral Resources: Metals and Non-metals",
      titleBn: "খনিজ সম্পদ: ধাতু-অধাতু",
      summary: "Minerals and ores, extracting metals, and corrosion and how to prevent it.",
      topics: ["Minerals and ores", "Extraction of metals", "Corrosion and its prevention"],
    },
    {
      title: "Mineral Resources: Fossils",
      titleBn: "খনিজ সম্পদ: জীবাশ্ম",
      summary: "Fossil fuels, refining petroleum, and hydrocarbons.",
      topics: ["Fossil fuels", "Refining petroleum", "Hydrocarbons"],
    },
    {
      title: "Chemistry in Our Lives",
      titleBn: "আমাদের জীবনে রসায়ন",
      summary: "Chemistry in food, soaps and detergents, fertilisers and environmental pollution.",
      topics: ["Chemistry in food", "Soaps and detergents", "Fertilisers and pollution"],
    },
  ],
};
