import type { CourseData } from "./types";

export const BIOLOGY_10: CourseData = {
  id: "biology-10",
  subjectId: "biology",
  grade: 10,
  title: "Biology",
  titleBn: "জীববিজ্ঞান",
  book: "Biology, Class 9–10 textbook",
  description: "Cells, energy, nutrition, transport, coordination, reproduction, heredity and the environment — the full SSC biology syllabus.",
  chapters: [
    {
      title: "Lessons on Life",
      titleBn: "জীবন পাঠ",
      summary: "What biology studies, its branches, how living things are classified, and how they are named.",
      topics: ["Biology and its branches", "Classification of organisms", "Binomial nomenclature"],
    },
    {
      title: "Cell and Tissues of Organisms",
      titleBn: "জীবকোষ ও টিস্যু",
      summary: "Cells and their types, the organelles inside a cell, and plant and animal tissues.",
      topics: [
        {
          title: "Cell and its types",
          body: String.raw`The **cell** is the basic structural and functional unit of life. Some living things are a single cell (like bacteria); you are made of trillions.

### Discovery
**Robert Hooke** (1665) first saw "cells" in a thin slice of cork. Later Schleiden and Schwann proposed the **cell theory**: all living things are made of cells, and new cells come from existing cells.

### Prokaryotic and eukaryotic cells
- **Prokaryotic:** no true nucleus — the genetic material lies in the cytoplasm, and there are no membrane-bound organelles. Example: bacteria.
- **Eukaryotic:** a true nucleus with a nuclear membrane, plus organelles such as mitochondria. Examples: plant and animal cells.

### Plant cell vs animal cell
- Plant cells have a **cell wall**, **chloroplasts** and a large **vacuole**.
- Animal cells have **centrioles** and no cell wall.`,
          checkpoints: [
            { question: "Which cell has no true nucleus?", options: ["Plant cell", "Animal cell", "Bacterial cell", "Nerve cell"], answerIndex: 2, explanation: "Bacteria are prokaryotes: no nuclear membrane." },
          ],
        },
        {
          title: "Cell organelles",
          body: String.raw`Organelles are the cell's "organs" — each one has a job.

- **Nucleus:** the control centre; holds DNA in chromosomes.
- **Mitochondria:** the *powerhouse* — cellular respiration releases energy as ATP.
- **Chloroplast** (plants only): where photosynthesis happens, using the green pigment chlorophyll.
- **Ribosome:** builds proteins.
- **Endoplasmic reticulum:** a transport network; rough ER is dotted with ribosomes.
- **Golgi body:** packs and sends out substances such as enzymes.
- **Vacuole:** stores water, food and waste; keeps plant cells firm.
- **Cell membrane:** controls what goes in and out.

> **Remember:** mitochondria and chloroplasts both have their **own DNA**!`,
          checkpoints: [
            { question: "Which organelle is called the powerhouse of the cell?", options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"], answerIndex: 1, explanation: "Mitochondria release energy as ATP." },
          ],
        },
        {
          title: "Plant tissues",
          body: String.raw`A **tissue** is a group of cells with a common origin that work together to do one job.

### Meristematic tissue
Cells that keep dividing — found at the tips of roots and shoots. They make the plant grow.

### Permanent tissue
Cells that have stopped dividing and taken on a special role:
- **Parenchyma:** thin-walled cells that store food.
- **Collenchyma:** gives flexible support to young stems.
- **Sclerenchyma:** thick-walled dead cells for strength (like coconut husk fibres!).

### Complex tissues: the plant's pipes
- **Xylem** carries water and minerals **up** from the roots.
- **Phloem** carries food made in the leaves to every part of the plant.`,
          checkpoints: [
            { question: "Xylem carries…", options: ["Food", "Water and minerals", "Only hormones", "Air"], answerIndex: 1, explanation: "Xylem moves water and minerals up from the roots." },
          ],
        },
        {
          title: "Animal tissues",
          body: String.raw`Animals have four main types of tissue:

1. **Epithelial tissue** covers the body and lines organs — like your skin and the inside of your mouth.
2. **Connective tissue** joins and supports — bone, cartilage and even **blood** are connective tissues.
3. **Muscular tissue** contracts to move things:
   - skeletal (voluntary) muscle in your arms,
   - smooth (involuntary) muscle in your stomach,
   - cardiac muscle, found only in the heart, which never tires.
4. **Nervous tissue** is made of **neurons** that carry messages as electrical signals.

> **Fun fact:** your heart muscle beats about 100 000 times a day without you ever thinking about it!`,
          checkpoints: [
            { question: "Blood is which type of tissue?", options: ["Epithelial", "Connective", "Muscular", "Nervous"], answerIndex: 1, explanation: "Blood is a fluid connective tissue." },
          ],
        },
      ],
    },
    {
      title: "Cell Division",
      titleBn: "কোষ বিভাজন",
      summary: "How cells divide: mitosis for growth and repair, and meiosis for making gametes.",
      topics: ["Mitosis", "Meiosis"],
    },
    {
      title: "Bioenergetics",
      titleBn: "জীবনীশক্তি",
      summary: "ATP as the energy currency, photosynthesis, and respiration.",
      topics: ["ATP: the energy currency", "Photosynthesis", "Respiration"],
    },
    {
      title: "Food, Nutrition and Digestion",
      titleBn: "খাদ্য, পুষ্টি এবং পরিপাক",
      summary: "Nutrients and a balanced diet, the human digestive system, and malnutrition.",
      topics: ["Nutrients and a balanced diet", "The human digestive system", "Malnutrition"],
    },
    {
      title: "Transport in Organisms",
      titleBn: "জীবে পরিবহন",
      summary: "How water and food move in plants, blood and its parts, and the heart and circulation.",
      topics: ["Transport in plants", "Blood and its components", "The heart and circulation"],
    },
    {
      title: "Exchange of Gases",
      titleBn: "গ্যাসীয় বিনিময়",
      summary: "Breathing and respiration, the human respiratory system, and gas exchange in plants.",
      topics: ["Breathing and respiration", "The human respiratory system", "Gas exchange in plants"],
    },
    {
      title: "Excretory System",
      titleBn: "রেচন প্রক্রিয়া",
      summary: "How plants and humans remove wastes, the kidney, and kidney diseases.",
      topics: ["Excretion in plants", "The human kidney", "Kidney diseases"],
    },
    {
      title: "Firmness and Locomotion",
      titleBn: "দৃঢ়তা প্রদান ও চলন",
      summary: "The human skeleton, joints and muscles that make movement possible.",
      topics: ["The human skeleton", "Joints and muscles"],
    },
    {
      title: "Coordination",
      titleBn: "সমন্বয়",
      summary: "Plant hormones, the human nervous system, and endocrine glands.",
      topics: ["Plant hormones", "The nervous system", "Endocrine glands"],
    },
    {
      title: "Reproduction in Organisms",
      titleBn: "জীবের প্রজনন",
      summary: "Reproduction in flowering plants, pollination and fertilisation, and human reproduction.",
      topics: ["Reproduction in plants", "Pollination and fertilisation", "Human reproduction"],
    },
    {
      title: "Heredity in Organisms and Evolution",
      titleBn: "জীবের বংশগতি ও বিবর্তন",
      summary: "Chromosomes, DNA and genes, Mendel's laws of inheritance, and evolution.",
      topics: ["Chromosomes, DNA and genes", "Mendel's laws", "Evolution"],
    },
    {
      title: "Environment of Life",
      titleBn: "জীবের পরিবেশ",
      summary: "Ecosystems, food chains and food webs, and protecting biodiversity.",
      topics: ["Ecosystems", "Food chains and food webs", "Biodiversity and conservation"],
    },
    {
      title: "Biotechnology",
      titleBn: "জীবপ্রযুক্তি",
      summary: "What biotechnology is, genetic engineering, and how biotechnology is used in farming and medicine.",
      topics: ["What is biotechnology?", "Genetic engineering", "Uses of biotechnology"],
    },
  ],
};
