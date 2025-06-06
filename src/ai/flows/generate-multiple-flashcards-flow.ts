
'use server';
/**
 * @fileOverview AI flow to generate multiple flashcards (questions and answers)
 * based on a given topic.
 *
 * - generateMultipleFlashcards - Generates a list of flashcards.
 * - GenerateMultipleFlashcardsInput - Input type for the flow.
 * - GenerateMultipleFlashcardsOutput - Output type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FlashcardPairSchema = z.object({
  questionText: z.string().describe('The question or front text of the flashcard.'),
  answerText: z.string().describe('The answer or back text for the flashcard.'),
});

// Define schema locally, do not export the object itself
const GenerateMultipleFlashcardsInputSchema = z.object({
  topic: z.string().describe('The central topic, subject, or chapter for which to generate flashcards. This could be a concatenation of title, subject, and chapter from the flashcard set details.'),
  numberOfCards: z.number().optional().default(5).describe('The desired number of flashcards to generate. Minimum 5.'),
});
export type GenerateMultipleFlashcardsInput = z.infer<typeof GenerateMultipleFlashcardsInputSchema>;

// Define schema locally, do not export the object itself
const GenerateMultipleFlashcardsOutputSchema = z.object({
  flashcards: z.array(FlashcardPairSchema).describe('An array of generated flashcard question and answer pairs.'),
});
export type GenerateMultipleFlashcardsOutput = z.infer<typeof GenerateMultipleFlashcardsOutputSchema>;


export async function generateMultipleFlashcards(input: GenerateMultipleFlashcardsInput): Promise<GenerateMultipleFlashcardsOutput> {
  // Ensure numberOfCards is at least 5
  const effectiveNumCards = Math.max(input.numberOfCards || 5, 5);
  return generateMultipleFlashcardsFlow({...input, numberOfCards: effectiveNumCards});
}

const prompt = ai.definePrompt({
  name: 'generateMultipleFlashcardsPrompt',
  input: {schema: GenerateMultipleFlashcardsInputSchema}, // Schema is used here, defined locally
  output: {schema: GenerateMultipleFlashcardsOutputSchema}, // Schema is used here, defined locally
  prompt: `You are an expert in creating educational flashcards.
Given the following topic, generate a set of {{{numberOfCards}}} distinct flashcard question and answer pairs.
Each flashcard should consist of a clear question and a concise, accurate answer.
The questions should cover key concepts related to the topic.
The answers should directly address the questions.

Topic: {{{topic}}}

Generate {{{numberOfCards}}} flashcards.
Ensure the output is an array of objects, where each object has "questionText" and "answerText".
`,
});

const generateMultipleFlashcardsFlow = ai.defineFlow(
  {
    name: 'generateMultipleFlashcardsFlow',
    inputSchema: GenerateMultipleFlashcardsInputSchema, // Schema is used here, defined locally
    outputSchema: GenerateMultipleFlashcardsOutputSchema, // Schema is used here, defined locally
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
