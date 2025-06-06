
'use server';
/**
 * @fileOverview AI flow to generate an answer for a flashcard question.
 *
 * - generateFlashcardAnswer - Generates an answer given a question.
 * - GenerateFlashcardAnswerInput - Input type for the flow.
 * - GenerateFlashcardAnswerOutput - Output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFlashcardAnswerInputSchema = z.object({
  questionText: z.string().describe('The question or front text of the flashcard.'),
});
export type GenerateFlashcardAnswerInput = z.infer<typeof GenerateFlashcardAnswerInputSchema>;

const GenerateFlashcardAnswerOutputSchema = z.object({
  answerText: z.string().describe('The AI-generated answer or back text for the flashcard.'),
});
export type GenerateFlashcardAnswerOutput = z.infer<typeof GenerateFlashcardAnswerOutputSchema>;

export async function generateFlashcardAnswer(input: GenerateFlashcardAnswerInput): Promise<GenerateFlashcardAnswerOutput> {
  return generateFlashcardAnswerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFlashcardAnswerPrompt',
  input: {schema: GenerateFlashcardAnswerInputSchema},
  output: {schema: GenerateFlashcardAnswerOutputSchema},
  prompt: `You are an expert at creating concise and accurate answers for flashcards.
Given the following question, provide a suitable answer for the back of a flashcard.
The answer should be clear, correct, and directly address the question. Avoid overly long explanations.

Question: {{{questionText}}}

Generate the answer.
`,
});

const generateFlashcardAnswerFlow = ai.defineFlow(
  {
    name: 'generateFlashcardAnswerFlow',
    inputSchema: GenerateFlashcardAnswerInputSchema,
    outputSchema: GenerateFlashcardAnswerOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
