import type { CourseData } from "./types";

export const PHYSICS_10: CourseData = {
  id: "physics-10",
  subjectId: "physics",
  grade: 10,
  title: "Physics",
  titleBn: "পদার্থবিজ্ঞান",
  book: "Physics, Class 9–10 textbook",
  description: "From measurement and motion to electricity, light and modern physics — the full SSC physics syllabus, chapter by chapter, with short videos and easy notes.",
  chapters: [
    {
      title: "Physical Quantities and Their Measurements",
      titleBn: "ভৌত রাশি এবং পরিমাপ",
      summary: "What physics is, the quantities we measure, the SI units we measure them in, and how to measure accurately.",
      topics: [
        {
          title: "Physics and its scope",
          body: String.raw`Physics is the branch of science that studies **matter, energy and how they interact** — from the tiniest particles inside an atom to the motion of planets.

### Why study physics?
- It explains everyday things: why a ball falls, why the sky is blue, how a fan turns.
- It powers technology: mobile phones, electricity, X-ray machines and satellites all come from physics.
- It trains you to **observe, measure and reason** — the habits of a scientist.

### Main branches
- **Mechanics** — motion and forces
- **Heat and thermodynamics** — temperature and energy flow
- **Waves and sound** — vibrations
- **Optics** — light
- **Electricity and magnetism** — charges, currents and magnets
- **Modern physics** — atoms, nuclei and electronics

### Scientists who shaped physics
**Galileo** studied falling bodies, **Newton** gave the laws of motion and gravity, and **Einstein** changed how we think about space, time and energy. Bangladesh's own **Satyendra Nath Bose** worked on quantum statistics — the particles called *bosons* are named after him.

> **Think about it:** Name one thing in your home that works because of physics. Which branch does it belong to?`,
          checkpoints: [
            { question: "The particles called 'bosons' are named after…", options: ["Isaac Newton", "Satyendra Nath Bose", "Albert Einstein", "Galileo Galilei"], answerIndex: 1, explanation: "Bosons are named after the Bengali physicist Satyendra Nath Bose." },
          ],
        },
        {
          title: "Fundamental and derived quantities",
          body: String.raw`Anything we can **measure** is a *physical quantity* — length, mass, time, speed, force…

### Fundamental quantities
These don't depend on any other quantity. The SI system has **7**:
1. Length — metre (m)
2. Mass — kilogram (kg)
3. Time — second (s)
4. Temperature — kelvin (K)
5. Electric current — ampere (A)
6. Luminous intensity — candela (cd)
7. Amount of substance — mole (mol)

### Derived quantities
These are built from fundamental ones:
- Area = length × length → unit $\text{m}^2$
- Speed = distance ÷ time → unit $\text{m s}^{-1}$
- Force = mass × acceleration → unit $\text{kg m s}^{-2}$, called the **newton (N)**

### Worked example
Density is mass per unit volume: $\rho = \dfrac{m}{V}$. Its unit is $\text{kg m}^{-3}$, built from mass and length — so density is a **derived** quantity.

> **Check yourself:** Is *volume* fundamental or derived? (Hint: how do you calculate it?)`,
          checkpoints: [
            { question: "Which of these is a fundamental quantity?", options: ["Speed", "Force", "Mass", "Area"], answerIndex: 2, explanation: "Mass is one of the 7 SI fundamental quantities; the others here are derived." },
          ],
        },
        {
          title: "SI units and prefixes",
          body: String.raw`Scientists everywhere use the same units — the **Système International (SI)** — so their results can be compared.

### Prefixes make big and small numbers easy
- kilo (k) $= 10^3$ → 1 km = 1000 m
- centi (c) $= 10^{-2}$ → 1 cm = 0.01 m
- milli (m) $= 10^{-3}$ → 1 mm = 0.001 m
- micro (μ) $= 10^{-6}$
- mega (M) $= 10^6$ and giga (G) $= 10^9$ → a 4 GB memory card!

### Scientific notation
Write numbers as $a \times 10^n$ with $1 \le a < 10$:
- Earth to Sun ≈ $1.5 \times 10^{11}$ m
- Mass of an electron ≈ $9.1 \times 10^{-31}$ kg

### Worked example
Convert 2.5 km to metres: $2.5 \times 10^3 = 2500$ m.

> **Try it:** How many milligrams are there in 3 g?`,
          checkpoints: [
            { question: "1 km equals how many metres?", options: ["100", "1000", "10", "10 000"], answerIndex: 1, explanation: "kilo means 10³ = 1000." },
          ],
        },
        {
          title: "Measurement and errors",
          body: String.raw`Every measurement has a little uncertainty. Good scientists know **how precise** their instruments are.

### Least count
The smallest value an instrument can measure. A metre scale's least count is **1 mm**.

### Vernier calipers
A main scale plus a sliding vernier scale:
$$\text{Least count} = \frac{\text{value of 1 main-scale division}}{\text{number of vernier divisions}}$$
If 1 main-scale division is 1 mm and the vernier has 10 divisions, the least count is **0.1 mm**.

### Screw gauge
Measures very small lengths, like the thickness of a wire:
$$\text{Least count} = \frac{\text{pitch}}{\text{number of circular-scale divisions}}$$

### Types of error
- **Instrumental error** — for example a zero error in the calipers.
- **Personal error** — for example reading the scale at an angle (parallax).
- **Random error** — reduce it by taking several readings and finding the average.`,
          checkpoints: [
            { question: "1 main-scale division = 1 mm and the vernier has 10 divisions. The least count is…", options: ["1 mm", "0.1 mm", "0.01 mm", "10 mm"], answerIndex: 1, explanation: "1 mm ÷ 10 = 0.1 mm." },
          ],
        },
      ],
    },
    {
      title: "Motion",
      titleBn: "গতি",
      summary: "How we describe motion: rest and motion, speed, velocity and acceleration, the equations of motion and free fall.",
      topics: [
        {
          title: "Rest and motion",
          body: String.raw`Is a sleeping passenger on a moving bus at rest or in motion? **Both** — it depends on what you compare them with.

### Reference frame
An object is **at rest** if its position does not change compared with its surroundings (the *reference frame*), and **in motion** if it does.
- Compared with the bus seat, the passenger is at rest.
- Compared with a tree outside, the passenger is moving.

So rest and motion are **relative**.

### Types of motion
- **Linear:** a car on a straight road
- **Rotational:** a spinning fan blade
- **Periodic:** a pendulum, the hands of a clock
- **Vibrational:** a guitar string
- **Random:** smoke particles in the air

### Scalars and vectors
- **Scalar:** only size (magnitude) — distance, speed, mass, time.
- **Vector:** size **and** direction — displacement, velocity, force.`,
          checkpoints: [
            { question: "A spinning fan blade is an example of…", options: ["Linear motion", "Rotational motion", "Random motion", "Rest"], answerIndex: 1, explanation: "The blade turns around a fixed axis: rotational motion." },
          ],
        },
        {
          title: "Speed and velocity",
          body: String.raw`### Speed
How fast something moves:
$$v = \frac{s}{t}$$
where $s$ is distance and $t$ is time. SI unit: $\text{m s}^{-1}$.

### Velocity
Speed **in a given direction** — the rate of change of *displacement*. It is a vector.

### Uniform and average
- **Uniform velocity:** equal displacements in equal times, in the same direction.
- **Average speed** $= \dfrac{\text{total distance}}{\text{total time}}$

### Worked example
A rickshaw goes 600 m in 2 minutes: speed $= \dfrac{600\ \text{m}}{120\ \text{s}} = 5\ \text{m s}^{-1}$.

### Speed ≠ velocity
Run one full lap of a 400 m track in 80 s. Your average speed is $5\ \text{m s}^{-1}$, but you finish where you started — displacement is 0, so your **average velocity is 0**!`,
          checkpoints: [
            { question: "A car travels 100 m in 5 s. Its speed is…", options: ["20 m/s", "500 m/s", "0.05 m/s", "95 m/s"], answerIndex: 0, explanation: "speed = distance ÷ time = 100 ÷ 5 = 20 m/s." },
          ],
        },
        {
          title: "Acceleration",
          body: String.raw`**Acceleration** is the rate of change of velocity:
$$a = \frac{v - u}{t}$$
$u$ = initial velocity, $v$ = final velocity, $t$ = time. SI unit: $\text{m s}^{-2}$.

### Speeding up and slowing down
- Speeding up → positive acceleration.
- Slowing down → negative acceleration, called **retardation** or deceleration.

### Worked example
A bus starts from rest and reaches $20\ \text{m s}^{-1}$ in 10 s:
$$a = \frac{20 - 0}{10} = 2\ \text{m s}^{-2}$$

### Uniform acceleration
Velocity changes by the same amount every second — like a stone falling freely, which speeds up by about $9.8\ \text{m s}^{-1}$ each second.`,
          checkpoints: [
            { question: "A bike goes from 0 to 10 m/s in 5 s. Its acceleration is…", options: ["50 m/s²", "2 m/s²", "0.5 m/s²", "15 m/s²"], answerIndex: 1, explanation: "a = (10 − 0) ÷ 5 = 2 m/s²." },
          ],
        },
        {
          title: "Equations of motion",
          body: String.raw`For an object moving in a straight line with **uniform acceleration**:
$$v = u + at$$
$$s = ut + \tfrac{1}{2}at^2$$
$$v^2 = u^2 + 2as$$

### Choosing the right equation
List what you know ($u, v, a, s, t$) and what you want. Pick the equation that contains your unknown and **no other unknowns**.

### Worked example
A car moving at $10\ \text{m s}^{-1}$ accelerates at $2\ \text{m s}^{-2}$ for 5 s. How far does it go?
$$s = ut + \tfrac{1}{2}at^2 = 10 \times 5 + \tfrac{1}{2} \times 2 \times 5^2 = 50 + 25 = 75\ \text{m}$$

> **Try it:** What is its final velocity? Use $v = u + at$.`,
          checkpoints: [
            { question: "With u = 10 m/s, a = 2 m/s² and t = 5 s, v = u + at gives…", options: ["20 m/s", "12 m/s", "17 m/s", "50 m/s"], answerIndex: 0, explanation: "v = 10 + 2 × 5 = 20 m/s." },
          ],
        },
        {
          title: "Free fall",
          body: String.raw`When only gravity acts on a body, it is in **free fall**. Near the Earth's surface every freely falling object speeds up with the same acceleration:
$$g \approx 9.8\ \text{m s}^{-2}$$

### Galileo's idea
Without air resistance, a heavy stone and a light coin dropped together land **at the same time**. On the Moon, astronauts showed a hammer and a feather falling together!

### Equations for free fall
Replace $a$ with $g$ and $s$ with the height $h$:
$$v = u + gt \qquad h = ut + \tfrac{1}{2}gt^2 \qquad v^2 = u^2 + 2gh$$

### Worked example
A mango drops from a branch 4.9 m high ($u = 0$). Time to reach the ground:
$$4.9 = \tfrac{1}{2} \times 9.8 \times t^2 \Rightarrow t^2 = 1 \Rightarrow t = 1\ \text{s}$$`,
          checkpoints: [
            { question: "Near the Earth's surface, g is about…", options: ["9.8 m/s²", "98 m/s²", "1 m/s²", "0.98 m/s²"], answerIndex: 0, explanation: "Standard gravity is about 9.8 m/s²." },
          ],
        },
      ],
    },
    {
      title: "Force",
      titleBn: "বল",
      summary: "Newton's three laws of motion, inertia, momentum and its conservation, and friction.",
      topics: ["Newton's first law and inertia", "Newton's second law: F = ma", "Newton's third law", "Momentum and its conservation", "Friction"],
    },
    {
      title: "Work, Power and Energy",
      titleBn: "কাজ, ক্ষমতা ও শক্তি",
      summary: "When a force does work, the different forms of energy, how energy is conserved, and power and efficiency.",
      topics: ["Work", "Kinetic and potential energy", "Conservation of energy", "Power and efficiency"],
    },
    {
      title: "State of Matter and Pressure",
      titleBn: "পদার্থের অবস্থা ও চাপ",
      summary: "Density, pressure in liquids and gases, Archimedes' principle and floating, and elasticity.",
      topics: ["Density", "Pressure in liquids and gases", "Archimedes' principle and flotation", "Elasticity and Hooke's law"],
    },
    {
      title: "Effect of Heat on Matter",
      titleBn: "বস্তুর উপর তাপের প্রভাব",
      summary: "Temperature and heat, thermal expansion, specific heat capacity, and latent heat during change of state.",
      topics: ["Temperature and heat", "Thermal expansion", "Specific heat capacity", "Latent heat"],
    },
    {
      title: "Waves and Sound",
      titleBn: "তরঙ্গ ও শব্দ",
      summary: "Transverse and longitudinal waves, the properties of sound, echoes, and ultrasound.",
      topics: ["Waves and their types", "Properties of sound", "Echo", "Ultrasound and its uses"],
    },
    {
      title: "Reflection of Light",
      titleBn: "আলোর প্রতিফলন",
      summary: "The laws of reflection, images in plane mirrors, and concave and convex mirrors.",
      topics: ["Laws of reflection", "Plane mirrors", "Spherical mirrors"],
    },
    {
      title: "Refraction of Light",
      titleBn: "আলোর প্রতিসরণ",
      summary: "How light bends between media, total internal reflection, lenses, and the human eye.",
      topics: ["Laws of refraction", "Total internal reflection", "Lenses", "The human eye"],
    },
    {
      title: "Static Electricity",
      titleBn: "স্থির তড়িৎ",
      summary: "Electric charge, electric field and potential, and lightning and how to stay safe from it.",
      topics: ["Electric charge", "Electric field and potential", "Lightning and its protection"],
    },
    {
      title: "Current Electricity",
      titleBn: "চল তড়িৎ",
      summary: "Current, voltage and resistance, Ohm's law, series and parallel circuits, and using electricity safely.",
      topics: ["Current, voltage and resistance", "Ohm's law", "Series and parallel circuits", "Electric power and safety"],
    },
    {
      title: "Magnetic Effect of Current",
      titleBn: "তড়িতের চৌম্বক ক্রিয়া",
      summary: "The magnetic field around a current, electric motors, electromagnetic induction and transformers.",
      topics: ["Magnetic field of a current", "Electric motor", "Electromagnetic induction", "Transformer"],
    },
    {
      title: "Modern Physics and Electronics",
      titleBn: "আধুনিক পদার্থবিজ্ঞান ও ইলেকট্রনিক্স",
      summary: "Radioactivity and its uses, basic electronic components, and modern communication technology.",
      topics: ["Radioactivity", "Uses of radioisotopes", "Diodes and transistors", "Communication technology"],
    },
    {
      title: "Physics to Save Life",
      titleBn: "জীবন বাঁচাতে পদার্থবিজ্ঞান",
      summary: "How physics helps doctors: X-rays, ultrasonography, ECG, CT scans and MRI.",
      topics: ["X-ray and its uses", "Ultrasonography", "ECG, CT scan and MRI"],
    },
  ],
};
