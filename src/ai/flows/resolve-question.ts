'use server';

/**
 * @fileOverview An AI agent that resolves user questions.
 *
 * - resolveQuestion - A function that handles the question resolution process.
 * - ResolveQuestionInput - The input type for the resolveQuestion function.
 * - ResolveQuestionOutput - The return type for the resolveQuestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ResolveQuestionInputSchema = z.object({
  question: z.string().describe('The question to be answered.'),
  image: z
    .string()
    .optional()
    .describe(
      "An optional image associated with the question, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ResolveQuestionInput = z.infer<typeof ResolveQuestionInputSchema>;

const ResolveQuestionOutputSchema = z.object({
  answer: z.string().describe('The AI-generated answer to the question.'),
});
export type ResolveQuestionOutput = z.infer<typeof ResolveQuestionOutputSchema>;

export async function resolveQuestion(input: ResolveQuestionInput): Promise<ResolveQuestionOutput> {
  return resolveQuestionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'resolveQuestionPrompt',
  input: {schema: ResolveQuestionInputSchema},
  output: {schema: ResolveQuestionOutputSchema},
  prompt: `You are an expert AI assistant designed to answer student questions.

  Question: {{{question}}}
  {{#if image}}
  Image: {{media url=image}}
  {{/if}}
  Answer in a comprehensive and easy-to-understand manner.
  `,
});

const resolveQuestionFlow = ai.defineFlow(
  {
    name: 'resolveQuestionFlow',
    inputSchema: ResolveQuestionInputSchema,
    outputSchema: ResolveQuestionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
