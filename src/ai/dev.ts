
import { config } from 'dotenv';
config();

import '@/ai/flows/resolve-question.ts';
import '@/ai/flows/summarize-conversation.ts';
import '@/ai/flows/generate-study-plan-flow.ts';
import '@/ai/flows/generate-flashcard-answer-flow.ts';
import '@/ai/flows/generate-multiple-flashcards-flow.ts';
import '@/ai/flows/generate-test-flow.ts';
import '@/ai/flows/analyze-test-results-flow.ts'; // Ensure this line is present and correct

