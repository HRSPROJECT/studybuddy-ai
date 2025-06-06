
'use server';
/**
 * @fileOverview AI flow to generate a test with subjective and objective questions.
 *
 * - generateTest - Generates a test based on topic, description, and question counts.
 * - GenerateTestInput - Input type for the flow.
 * - GenerateTestOutput - Output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod'; // Corrected: was 'genkit'

// Input Schema
const GenerateTestInputSchema = z.object({
  title: z.string().describe('The title of the test.'),
  subject: z.string().optional().describe('The subject the test covers.'),
  description: z.string().optional().describe('A brief description or topic for the test.'),
  numSubjective: z.number().int().min(0).default(5).describe('Number of subjective (essay/short answer) questions.'),
  numObjective: z.number().int().min(0).default(5).describe('Number of objective (multiple choice) questions.'),
}).refine(data => data.numObjective > 0 || data.numSubjective > 0, {
  message: "Total number of questions must be greater than 0.",
  path: ["numObjective"], // Or path: ["numSubjective"] or a general path
});
export type GenerateTestInput = z.infer<typeof GenerateTestInputSchema>;

// Output Schema
const TestQuestionOptionSchema = z.object({
  id: z.string().describe('Unique ID for the option (e.g., "a", "b", "c").'),
  text: z.string().describe('Text of the option.'),
});

const TestQuestionSchema = z.object({
  id: z.string().describe('Unique ID for the question.'),
  type: z.enum(['subjective', 'objective']).describe('Type of the question.'),
  questionText: z.string().describe('The text of the question.'),
  options: z.array(TestQuestionOptionSchema).optional().describe('Options for multiple-choice questions.'),
  correctAnswerKey: z.string().optional().describe('The ID of the correct option for objective questions.'),
  correctAnswerText: z.string().optional().describe('The text of the correct answer (for objective, text of correct option; for subjective, a model answer).')
});

const GenerateTestOutputSchema = z.object({
  questions: z.array(TestQuestionSchema).describe('An array of generated test questions.'),
});
export type GenerateTestOutput = z.infer<typeof GenerateTestOutputSchema>;


// The wrapper function that should be exported
export async function generateTest(input: GenerateTestInput): Promise<GenerateTestOutput> {
  return generateTestInternalFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTestQuestionsPrompt',
  input: { schema: GenerateTestInputSchema },
  output: { schema: GenerateTestOutputSchema },
  prompt: `You are an expert test creator. Generate a test based on the following specifications.
Title: {{{title}}}
{{#if subject}}Subject: {{{subject}}}{{/if}}
{{#if description}}Description/Topic: {{{description}}}{{/if}}

Generate {{{numSubjective}}} subjective (essay or short answer) questions.
Generate {{{numObjective}}} objective (multiple choice) questions. For each objective question, provide 3-4 distinct options and clearly indicate the correct answer key and correct answer text.

Formatting Instructions for Questions:
- Ensure questions are relevant to the title, subject, and description.
- For objective questions, ensure options are plausible and there's one clear correct answer.
- For mathematical equations or formulas:
  - Use single backticks for inline math, e.g., \`E = mc^2\`.
  - For larger or display-style equations, use fenced code blocks with a "math" hint, e.g.:
    \`\`\`math
    \sum_{i=1}^{n} x_i = x_1 + x_2 + ... + x_n
    \`\`\`
- For chemical formulas or equations:
  - Use Unicode subscript and superscript characters where appropriate, e.g., H₂O, C₆H₁₂O₆, CO₂.
  - For reactions, represent them clearly, e.g., \`2H₂ + O₂ -> 2H₂O\`.
- Provide a unique string ID for each question (e.g., "q1", "q2") and for each option (e.g., "opt_a", "opt_b").
- For objective questions, set 'correctAnswerKey' to the ID of the correct option, and 'correctAnswerText' to the text of that correct option.
- For subjective questions, 'options' and 'correctAnswerKey' can be omitted or empty. Provide a concise model answer for 'correctAnswerText' for subjective questions.
- Format the output as a JSON object strictly conforming to the schema.
`,
});

// The internal Genkit flow, not directly exported for 'use server' compatibility
const generateTestInternalFlow = ai.defineFlow(
  {
    name: 'generateTestInternalFlow',
    inputSchema: GenerateTestInputSchema,
    outputSchema: GenerateTestOutputSchema,
  },
  async (input) => {
    if (input.numObjective + input.numSubjective <= 0) {
      throw new Error("Total number of questions must be greater than 0.");
    }
    if (input.numObjective + input.numSubjective > 20) {
        throw new Error("Cannot generate more than 20 questions in total at once.");
    }

    const {output} = await prompt(input);
    if (!output || !output.questions) {
      throw new Error('AI failed to generate questions or output was empty.');
    }
    
    // Basic validation and ID generation if missing
    output.questions = output.questions.map((q, index) => {
      const questionId = q.id || `q_${Date.now()}_${index}`;
      const optionsWithIds = q.options?.map((opt, optIndex) => ({
        ...opt,
        id: opt.id || `${questionId}_opt${optIndex}`,
      }));

      return {
        ...q,
        id: questionId,
        options: q.type === 'objective' ? (optionsWithIds || []) : undefined,
        correctAnswerKey: q.type === 'objective' ? q.correctAnswerKey : undefined,
      };
    });
    return output;
  }
);

