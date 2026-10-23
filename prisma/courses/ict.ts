import type { CourseData } from "./types";

export const ICT_10: CourseData = {
  id: "ict-10",
  subjectId: "ict",
  grade: 10,
  title: "Information and Communication Technology",
  titleBn: "তথ্য ও যোগাযোগ প্রযুক্তি",
  book: "ICT, Class 9–10 textbook",
  description: "ICT in Bangladesh, staying safe online, how computers work, documents and spreadsheets, multimedia and databases.",
  chapters: [
    {
      title: "ICT and Our Bangladesh",
      titleBn: "তথ্য ও যোগাযোগ প্রযুক্তি এবং আমাদের বাংলাদেশ",
      summary: "What ICT is, how it is changing Bangladesh, and how we use it every day.",
      topics: [
        {
          title: "Information and communication technology",
          body: String.raw`**Information and Communication Technology (ICT)** means all the technology we use to **collect, store, process and share information** — computers, mobile phones, the internet, radio, TV and satellites.

### Data and information
- **Data:** raw facts — for example 45, 67, 82.
- **Information:** processed data that has meaning — "Rina's average mark is 64.7".

### The two halves of ICT
- **Information technology:** computers and software that process data.
- **Communication technology:** networks that move it — mobile networks, fibre-optic cables and Wi-Fi.

### The global village
Because of ICT, a student in Rangpur can video-call a friend in Canada or join an online class from anywhere — the world feels like one **global village**.`,
          checkpoints: [
            { question: "Processed data that has meaning is called…", options: ["Hardware", "Information", "A network", "Software"], answerIndex: 1, explanation: "Data becomes information once it is processed and meaningful." },
          ],
        },
        {
          title: "ICT in Bangladesh",
          body: String.raw`Bangladesh uses ICT to make government services, education and business **faster, cheaper and open to everyone**.

### Examples you may have used
- **Union Digital Centres** help people get birth certificates, land records and online forms close to home.
- **Mobile banking** lets families send money in seconds.
- **Online results:** SSC and HSC results are published online and by SMS.
- **e-Learning:** lessons on TV, YouTube and apps like Progga!

### Why it matters
ICT cuts travel and paperwork, creates freelancing and outsourcing jobs, and connects villages with cities.`,
          checkpoints: [
            { question: "Union Digital Centres mainly help people…", options: ["Get government services", "Play games", "Repair phones", "Build roads"], answerIndex: 0, explanation: "They bring government and online services close to home." },
          ],
        },
        "ICT in everyday life",
      ],
    },
    {
      title: "Computer and Computer User Security",
      titleBn: "কম্পিউটার ও কম্পিউটার ব্যবহারকারীর নিরাপত্তা",
      summary: "Protecting computers from viruses and hackers, using the internet safely, and healthy, ethical computer use.",
      topics: ["Viruses and computer security", "Safe internet use", "Health and ethics"],
    },
    {
      title: "My Computer",
      titleBn: "আমার কম্পিউটার",
      summary: "Hardware and software, input and output devices, and operating systems.",
      topics: ["Hardware and software", "Input and output devices", "Operating systems"],
    },
    {
      title: "My Writing and Computation",
      titleBn: "আমার লেখালেখি ও হিসাব",
      summary: "Writing documents with a word processor and calculating with spreadsheets.",
      topics: ["Word processing", "Spreadsheets"],
    },
    {
      title: "Multimedia and Graphics",
      titleBn: "মাল্টিমিডিয়া ও গ্রাফিক্স",
      summary: "What multimedia is and how to work with images and graphics.",
      topics: ["What is multimedia?", "Working with images and graphics"],
    },
    {
      title: "Use of Database",
      titleBn: "ডেটাবেজের ব্যবহার",
      summary: "Databases, tables, queries and forms for storing and finding information.",
      topics: ["Databases and tables", "Queries and forms"],
    },
  ],
};
