
'use server';
/**
 * @fileOverview AI-powered study plan generator.
 *
 * - generateStudyPlan - A function that creates a personalized study plan.
 * - GenerateStudyPlanInput - The input type for the generateStudyPlan function.
 * - GenerateStudyPlanOutput - The return type for the generateStudyPlan function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ExamSchema, GenerateStudyPlanInputSchema } from '@/lib/planner-schemas'; // Import ainput schemas

// --- Exported Types (inferred from schemas) ---
export type Exam = z.infer<typeof ExamSchema>;
export type GenerateStudyPlanInput = z.infer<typeof GenerateStudyPlanInputSchema>;

// --- Local Output Schemas (not exported as objects) ---
const StudySessionSchema = z.object({
  date: z.string().describe('The date for this study session (YYYY-MM-DD).'),
  startTime: z.string().describe('The suggested start time for the session (e.g., "09:00 AM").'),
  endTime: z.string().describe('The suggested end time for the session (e.g., "11:00 AM").'),
  subject: z.string().describe('The subject or topic to focus on during this session.'),
  activity: z.string().describe('A brief description of the study activity (e.g., "Review Chapter 3", "Practice problems for Algebra", "Work on History essay draft").'),
  isBreak: z.boolean().optional().default(false).describe('Indicates if this session is a scheduled break.')
});
export type StudySession = z.infer<typeof StudySessionSchema>;

const GenerateStudyPlanOutputSchema = z.object({
  planTitle: z.string().optional().describe('A suggested title for the study plan.'),
  dailySessions: z.array(
    z.object({
      date: z.string().describe('The date for these sessions (YYYY-MM-DD).'),
      sessions: z.array(StudySessionSchema).describe('A list of study sessions or breaks scheduled for this day.'),
    })
  ).describe('The study plan, organized by day, with a list of sessions for each day.'),
  summaryNotes: z.string().optional().describe('Any overall advice or summary notes from the AI regarding the plan.'),
});
export type GenerateStudyPlanOutput = z.infer<typeof GenerateStudyPlanOutputSchema>;


// --- AI Flow ---
export async function generateStudyPlan(input: GenerateStudyPlanInput): Promise<GenerateStudyPlanOutput> {
  return generateStudyPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStudyPlanPrompt',
  input: {schema: GenerateStudyPlanInputSchema}, // Use imported input schema
  output: {schema: GenerateStudyPlanOutputSchema}, // Use local output schema
  prompt: `You are an expert academic advisor AI specializing in creating personalized study plans.
Your goal is to generate a structured, actionable, and realistic study timetable for a student based on their input.
Today's date is {{currentDate}}. Ensure all study plan dates are on or after this date.

Student's Input:
Exams/Deadlines:
{{#each exams}}
- Subject: {{{subject}}}, Date: {{{date}}}{{#if type}}, Type: {{{type}}}{{/if}}
{{/each}}

{{#if weakAreas.length}}
Weak Areas:
{{#each weakAreas}}
- {{{this}}}
{{/each}}
{{else}}
Weak Areas: None specified.
{{/if}}

Learning Pace: {{{learningPace}}}
{{#if studyHoursPerWeek}}Preferred Study Hours Per Week: {{{studyHoursPerWeek}}}{{/if}}
{{#if preferredStudyDays.length}}
Preferred Study Days: {{{preferredStudyDaysString}}}
{{else}}
Preferred Study Days: Any day.
{{/if}}
{{#if notes}}Additional Notes: {{{notes}}}{{/if}}

Instructions for generating the plan:
1.  **Prioritize Weak Areas**: Allocate more time to subjects/topics listed as weak areas, especially in the initial phases of the plan. If no weak areas are specified, distribute time based on proximity to deadlines.
2.  **Work Backwards from Deadlines**: Ensure sufficient preparation time for each exam/deadline. Schedule more intensive review sessions closer to the exam dates. All exam dates provided are crucial.
3.  **Distribute Workload**: Spread study sessions evenly across available days, considering the learning pace and preferred study hours/days. Avoid overloading any single day. If specific study days are preferred, prioritize them. If not, distribute across the week.
4.  **Session Structure**:
    *   Create study sessions of reasonable length (e.g., 1-2 hours per subject block, but adapt based on student notes).
    *   Suggest specific activities for each session (e.g., "Read Chapter X", "Solve Y practice problems", "Outline essay points").
    *   Incorporate short breaks (e.g., 10-15 minutes) if the student has long study blocks (e.g., over 2 hours) or mentions needing them in notes. Mark breaks with \`isBreak: true\`.
5.  **Learning Pace Adaptation**:
    *   'relaxed': Fewer hours, more spread out, longer lead times for exams.
    *   'moderate': Balanced approach.
    *   'intensive': More focused hours, potentially more frequent sessions, can be tighter to deadlines if necessary.
    *   If 'studyHoursPerWeek' is provided, try to adhere to it while ensuring adequate coverage for all exams. If not, suggest a reasonable amount based on the workload and pace.
6.  **Output Format**: The output must be a JSON object strictly conforming to the GenerateStudyPlanOutputSchema.
    *   The 'dailySessions' array should list days chronologically, starting from tomorrow or a suitable near date based on exam proximity.
    *   Each day in 'dailySessions' MUST have a 'date' (YYYY-MM-DD) and an array of 'sessions'.
    *   Each session needs a clear 'subject', 'activity', 'date' (matching the parent dailySession date), 'startTime', and 'endTime'. Use a consistent time format (e.g., "09:00 AM", "05:30 PM").
    *   If you schedule breaks, mark \`isBreak: true\` and provide a suitable activity like "Short break" or "Rest".
7.  **Clarity and Actionability**: The plan should be easy to understand and follow.
8.  **Start Date**: The plan should start from {{currentDate}} or the day after if {{currentDate}} is too packed or exams are far. Make sure all exam dates are in the future from the planning start date. No study sessions should be scheduled for past dates.
9.  **Generate a \`planTitle\`** that is encouraging and reflects the student's goals (e.g., "Your Personalized Path to Exam Success!").
10. **Provide \`summaryNotes\`** with any general advice, encouragement, or important considerations about executing the plan (e.g., "Remember to stay hydrated," "Adjust the plan if needed," "Good luck!").
11. **Handle No Exams**: If the exams list is empty (which shouldn't happen due to schema validation, but as a fallback), indicate that a plan cannot be generated without target dates.

Generate the study plan.
`,
});

const generateStudyPlanFlow = ai.defineFlow(
  {
    name: 'generateStudyPlanFlow',
    inputSchema: GenerateStudyPlanInputSchema, // Use imported input schema
    outputSchema: GenerateStudyPlanOutputSchema, // Use local output schema
  },
  async (input) => {
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    let preferredStudyDaysString: string | undefined = undefined;
    if (input.preferredStudyDays && input.preferredStudyDays.length > 0) {
      preferredStudyDaysString = input.preferredStudyDays.join(', ');
    }

    const promptInput = {
      ...input,
      currentDate,
      // Conditionally add preferredStudyDaysString to the prompt's context 
      // if it has a value, so Handlebars can access it.
      ...(preferredStudyDaysString && { preferredStudyDaysString }),
    };
    
    const {output} = await prompt(promptInput);
    
    // Basic validation of output structure if needed, though Zod handles schema.
    // For example, ensure dailySessions are sorted if AI doesn't guarantee it.
    if (output?.dailySessions) {
      output.dailySessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      output.dailySessions.forEach(day => {
        if (day.sessions) {
          day.sessions.sort((s1, s2) => {
            // Convert HH:MM AM/PM to a comparable format
            const convertTime = (timeStr: string) => {
              const [time, modifier] = timeStr.split(' ');
              let [hours, minutes] = time.split(':').map(Number);
              if (modifier === 'PM' && hours < 12) hours += 12;
              if (modifier === 'AM' && hours === 12) hours = 0; 
              return hours * 60 + minutes;
            };
            return convertTime(s1.startTime) - convertTime(s2.startTime);
          });
        }
      });
    }
    return output!;
  }
);

