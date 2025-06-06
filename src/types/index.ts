

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  imageUrl?: string | null; // Data URI for images
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  userId: string;
}

export interface ConversationListItem {
  id: string;
  title: string;
  lastMessageAt: string;
}

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: React.ElementType; // Lucide icon component
  hasArrow?: boolean;
}

export interface CommunityComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  updatedAt?: string;
  likes: number;
  likedBy: { [userId: string]: true }; 
  // replies?: CommunityReply[]; // For future enhancement
}

export interface CommunityPost {
  id: string;
  userId: string;
  username: string;
  questionText: string;
  imageUrl?: string | null;
  timestamp: string;
  updatedAt?: string;
  likes: number;
  likedBy: { [userId: string]: true }; 
  comments: { [commentId: string]: CommunityComment };
  commentCount: number;
}

// Types for Study Planner are now primarily defined and exported from the AI flow file
// (e.g., Exam, StudySession, GenerateStudyPlanOutput)
// and their corresponding Zod schemas for input validation are in /lib/planner-schemas.ts.

export type DailyStudySessions = { 
  date: string; // YYYY-MM-DD
  sessions: import('@/ai/flows/generate-study-plan-flow').StudySession[]; 
};

export type StudyPlanFromAI = import('@/ai/flows/generate-study-plan-flow').GenerateStudyPlanOutput;

export interface SavedStudyPlan extends StudyPlanFromAI {
  id: string;
  savedAt: string; // ISO string for timestamp
  // planTitle is already part of GenerateStudyPlanOutput (optional)
}

// Flashcard Types
export interface Flashcard {
  id: string;
  setId: string;
  frontText: string;
  backText: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FlashcardSet {
  id: string;
  userId: string;
  title: string;
  subject?: string;
  chapter?: string;
  createdAt: string;
  updatedAt: string;
  flashcardCount?: number; 
}

// Test Taking Types
export interface TestQuestionOption {
  id: string; // e.g., "a", "b", "c"
  text: string;
}

export interface TestQuestion {
  id: string; // Unique ID for the question
  type: 'subjective' | 'objective';
  questionText: string;
  options?: TestQuestionOption[]; // Only for objective type
  correctAnswerKey?: string; // Key of the correct option (e.g., "a"), for objective
  correctAnswerText?: string; // Model answer for subjective, or text of correct option for objective
}

export interface UserAnswer {
  questionId: string;
  answer: string; // For subjective, this is text; for objective, this is the optionId (e.g., "a")
}

// Test Analysis Types
export interface QuestionAnalysis {
  questionId: string;
  questionText: string;
  userAnswerText: string; // The user's full answer text (text of chosen option or written answer)
  correctAnswerText?: string; // The full text of the correct answer
  isCorrect: boolean; // Whether the user's answer was correct (primarily for objective)
  feedback: string; // Specific AI feedback on the user's answer to this question
  suggestedScoreOutOfTen?: number; // For subjective questions, AI's suggested score (0-10)
}

export interface TestAnalysisReport {
  overallScore: number | null; // Overall percentage score. Null if not applicable.
  overallFeedback: string; // General AI feedback on the user's performance, strengths, and areas for improvement.
  questionAnalyses: QuestionAnalysis[]; // Detailed analysis for each question.
}

export interface TestSet {
  id: string;
  userId: string;
  title: string;
  subject?: string;
  description?: string;
  numSubjective: number;
  numObjective: number;
  timeLimitMinutes?: number;
  questions: TestQuestion[];
  createdAt: string;
  updatedAt: string;
  status: 'generated' | 'submitted' | 'analyzing' | 'analyzed';
  submittedAt?: string;
  userResponses?: Record<string, string>; // questionId -> answer (optionId or text)
  analysis?: TestAnalysisReport;
}
