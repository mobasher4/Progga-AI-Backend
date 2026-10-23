export interface CheckpointData {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface TopicData {
  title: string;
  /** hand-written lesson (Markdown + $maths$); topics without one get a demo placeholder */
  body?: string;
  checkpoints?: CheckpointData[];
}

export interface ChapterData {
  title: string;
  titleBn: string;
  /** one or two sentences on what the chapter covers */
  summary: string;
  topics: (string | TopicData)[];
}

export interface CourseData {
  id: string;
  subjectId: string;
  grade: number;
  title: string;
  titleBn: string;
  book: string;
  description: string;
  /** in NCTB order: chapter number = position + 1 */
  chapters: ChapterData[];
}
