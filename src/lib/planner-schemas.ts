
import { z } from 'zod';

export const ExamSchema = z.object({
  id: z.string().describe('Unique ID for the exam entry.'),
  subject: z.string().min(1, {message: 'Subject cannot be empty.'}).describe('The subject of the exam or deadline.'),
  date: z.string().describe('The date of the exam/deadline (YYYY-MM-DD).'),
  type: z.string().optional().describe('Type of event, e.g., "Final Exam", "Midterm", "Assignment Due". Default to "Exam".'),
});

export const GenerateStudyPlanInputSchema = z.object({
  exams: z.array(ExamSchema).min(1, {message: 'Please add at least one exam or deadline.'}).describe('A list of upcoming exams, tests, or assignment deadlines.'),
  weakAreas: z.array(z.string()).optional().describe('A list of subjects or topics the student feels weak in.'),
  learningPace: z.enum(['relaxed', 'moderate', 'intensive']).describe('The desired intensity of the study plan.'),
  studyHoursPerWeek: z.number().min(1).max(70).optional().describe('Preferred number of study hours per week. If not provided, the AI will suggest based on pace and workload.'),
  preferredStudyDays: z.array(z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])).optional().describe('Preferred days of the week for studying.'),
  notes: z.string().optional().describe('Any additional notes or preferences for the study plan, e.g., "prefer shorter, frequent sessions", "need breaks every hour".')
});
