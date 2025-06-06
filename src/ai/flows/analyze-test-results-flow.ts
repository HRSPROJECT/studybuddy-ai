
'use server';
/**
 * @fileOverview AI flow to analyze submitted test results.
 *
 * - analyzeTestResults - Analyzes test questions, user answers, and provides feedback.
 * - AnalyzeTestResultsInput - Input type for the flow.
 * - TestAnalysisReport - Output type for the flow (imported from @/types).
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import type { TestAnalysisReport } from '@/types'; // For output type hinting, ensure TestAnalysisReport is exported from types

// ---- Input Schema (Matches the structure from TestSet for analysis) ----
const TestQuestionForAnalysisSchema = z.object({
  id: z.string().describe('Unique ID for the question.'),
  questionText: z.string().describe('The text of the question.'),
  type: z.enum(['subjective', 'objective']).describe('Type of the question.'),
  options: z.array(z.object({
    id: z.string().describe('Unique ID for the option (e.g., "a", "b").'),
    text: z.string().describe('Text of the option.'),
  })).optional().describe('Options for multiple-choice questions.'),
  correctAnswerKey: z.string().optional().describe('The ID of the correct option for objective questions.'),
  correctAnswerText: z.string().optional().describe('The text of the correct answer (model answer for subjective).'),
});

// This schema is defined for internal use and type inference but NOT exported as an object.
const AnalyzeTestResultsInputSchema = z.object({
  testTitle: z.string().describe('The title of the test.'),
  testSubject: z.string().optional().describe('The subject the test covers.'),
  testDescription: z.string().optional().describe('A brief description or topic for the test.'),
  questions: z.array(TestQuestionForAnalysisSchema).describe('An array of the test questions.'),
  userResponses: z.record(z.string()).describe('A map of questionId to the user\'s answer (optionId for objective, text for subjective).'),
});
export type AnalyzeTestResultsInput = z.infer<typeof AnalyzeTestResultsInputSchema>;


// ---- Output Schema (Matches TestAnalysisReport in types/index.ts) ----
const QuestionAnalysisSchema = z.object({
  questionId: z.string(),
  questionText: z.string(),
  userAnswerText: z.string().describe("The user's full answer text (text of chosen option or written answer)."),
  correctAnswerText: z.string().optional().describe("The full text of the correct answer."),
  isCorrect: z.boolean().describe("Whether the user's answer was correct (primarily for objective)."),
  feedback: z.string().describe("Specific AI feedback on the user's answer to this question."),
  suggestedScoreOutOfTen: z.number().optional().describe("For subjective questions, AI's suggested score (0-10)."),
});

const AnalyzeTestResultsOutputSchema = z.object({
  overallScore: z.number().nullable().describe('Overall percentage score. Null if not applicable.'),
  overallFeedback: z.string().describe("General AI feedback on the user's performance, strengths, and areas for improvement."),
  questionAnalyses: z.array(QuestionAnalysisSchema).describe("Detailed analysis for each question."),
});
// This output schema matches TestAnalysisReport.


// ---- Internal Schema for Prompt (Data after pre-processing) ----
const ProcessedQuestionForPromptSchema = TestQuestionForAnalysisSchema.extend({
  userAnswerTextForPrompt: z.string().describe("User's answer (text or chosen option text)."),
  questionDisplayNumber: z.number().describe("1-based display number for the question."),
  // correctAnswerText is already available in TestQuestionForAnalysisSchema and will be used as the model/correct answer.
});
const ProcessedDataForPromptSchema = z.object({
  testTitle: z.string(),
  testSubject: z.string().optional(),
  testDescription: z.string().optional(),
  questions: z.array(ProcessedQuestionForPromptSchema),
});


// ---- The wrapper function that should be exported ----
export async function analyzeTestResults(input: AnalyzeTestResultsInput): Promise<TestAnalysisReport> {
  return analyzeTestResultsInternalFlow(input);
}

// ---- Genkit Prompt Definition ----
const thePrompt = ai.definePrompt({
  name: 'analyzeTestResultsPrompt',
  input: { schema: ProcessedDataForPromptSchema }, // Use the processed data schema here
  output: { schema: AnalyzeTestResultsOutputSchema }, // This will be validated against TestAnalysisReport type via the flow's outputSchema
  prompt: `You are an expert AI test evaluator. Analyze the following test results and provide a detailed report.

Test Title: {{{testTitle}}}
{{#if testSubject}}Test Subject: {{{testSubject}}}{{/if}}
{{#if testDescription}}Test Description: {{{testDescription}}}{{/if}}

Instructions for Analysis:
1.  For each question, compare the user's answer with the correct answer.
2.  For 'objective' questions, determine if 'userAnswerTextForPrompt' matches 'correctAnswerText'. Set 'isCorrect' accordingly. The 'correctAnswerText' for objective questions is the text of the correct option.
3.  For 'subjective' questions, evaluate 'userAnswerTextForPrompt' based on 'questionText' and the provided 'correctAnswerText' (which serves as a model answer). Provide constructive 'feedback' and a 'suggestedScoreOutOfTen' (0-10). 'isCorrect' can be true if the answer is substantially correct.
4.  Provide specific 'feedback' for each question, explaining why an answer is correct or incorrect, and offering suggestions for improvement.
5.  Calculate an 'overallScore' (percentage). For objective questions, count correct answers. For subjective questions, use the 'suggestedScoreOutOfTen' (assume max 10 points per subjective question for scoring calculation if you include them in overall score, or score only based on objective questions if subjective scores are hard to integrate reliably). Ensure the score is between 0 and 100. If no questions are scorable, the score can be null.
6.  Write 'overallFeedback' summarizing the user's performance, highlighting strengths, and suggesting areas for improvement.
7.  Ensure all output fields in 'questionAnalyses' and the top-level output are populated as per the schema.

Questions & User Answers:
{{#each questions}}
---
Question {{{questionDisplayNumber}}} (ID: {{{id}}}, Type: {{{type}}}):
Text: {{{questionText}}}
{{#if options}}
Options:
{{#each options}}
  - ({{id}}) {{{text}}}
{{/each}}
Correct Answer: {{{correctAnswerText}}} (This is the text of the correct option for objective questions, or the model answer for subjective)
{{else}}
Model Answer (for subjective): {{{correctAnswerText}}}
{{/if}}
User's Answer: {{{userAnswerTextForPrompt}}}
---
{{/each}}

Generate the analysis report.
`,
});

// ---- The internal Genkit flow ----
const analyzeTestResultsInternalFlow = ai.defineFlow(
  {
    name: 'analyzeTestResultsInternalFlow',
    inputSchema: AnalyzeTestResultsInputSchema, // External input schema
    outputSchema: AnalyzeTestResultsOutputSchema, // External output schema (ensures result matches TestAnalysisReport)
  },
  async (input) => {
    // Pre-process input to create the structure expected by thePrompt
    const processedQuestions = input.questions.map((q, index) => {
      let userAnswerTextForPrompt = "N/A";
      const rawUserAnswer = input.userResponses[q.id];

      if (rawUserAnswer) {
        if (q.type === 'objective' && q.options) {
          const selectedOption = q.options.find(opt => opt.id === rawUserAnswer);
          userAnswerTextForPrompt = selectedOption ? selectedOption.text : "Invalid option selected by user";
        } else { // Subjective answer is direct text
          userAnswerTextForPrompt = rawUserAnswer;
        }
      } else {
        userAnswerTextForPrompt = "No answer provided";
      }
      
      return {
        ...q, // Includes original question details like correctAnswerText (model answer for subjective, text of correct option for objective)
        userAnswerTextForPrompt,
        questionDisplayNumber: index + 1, // Add 1-based display number
      };
    });

    const processedDataForPrompt: z.infer<typeof ProcessedDataForPromptSchema> = {
      testTitle: input.testTitle,
      testSubject: input.testSubject,
      testDescription: input.testDescription,
      questions: processedQuestions,
    };
    
    const {output} = await thePrompt(processedDataForPrompt);
    if (!output) {
      throw new Error('AI analysis failed to return an output.');
    }
    // The output from the prompt is already in the shape of AnalyzeTestResultsOutputSchema,
    // which aligns with TestAnalysisReport.
    return output;
  }
);

