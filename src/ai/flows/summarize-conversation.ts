// Summarizes a conversation between a user and the AI to provide a quick review of the topics discussed.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeConversationInputSchema = z.object({
  conversationHistory: z.string().describe('The complete conversation history between the user and the AI.'),
});

export type SummarizeConversationInput = z.infer<typeof SummarizeConversationInputSchema>;

const SummarizeConversationOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the conversation, highlighting key topics and conclusions.'),
});

export type SummarizeConversationOutput = z.infer<typeof SummarizeConversationOutputSchema>;

export async function summarizeConversation(input: SummarizeConversationInput): Promise<SummarizeConversationOutput> {
  return summarizeConversationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeConversationPrompt',
  input: {schema: SummarizeConversationInputSchema},
  output: {schema: SummarizeConversationOutputSchema},
  prompt: `You are an AI assistant tasked with summarizing conversations for review.

  Please provide a concise summary of the following conversation, highlighting the key topics discussed and any conclusions reached:

  Conversation History:
  {{conversationHistory}}
  `,
});

const summarizeConversationFlow = ai.defineFlow(
  {
    name: 'summarizeConversationFlow',
    inputSchema: SummarizeConversationInputSchema,
    outputSchema: SummarizeConversationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
