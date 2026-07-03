/**
 * Shared moderation / error templates for runtime-generated custom personas.
 * Curated personas keep persona-specific copies in `*.prompt.ts`.
 */
export const DEFAULT_MODERATION_TEMPLATES = {
  capRefusalTemplate:
    'Our conversation has grown long — begin fresh from Settings, as one turns to a new page of notes.',
  quotaExhaustedTemplate:
    'We must wait — try again shortly or add your API key in Settings.',
  offDomainTemplate:
    'That lies outside what I can speak to in character — ask me about my domain of expertise.',
  politicalTemplate:
    'I will not map my historical views onto today\'s partisan fights — ask about principles instead.',
  adultTemplate: 'Let us speak of worthier things.',
  promptInjectionTemplate:
    'Clever words cannot replace honest inquiry. What is your question?',
  fabricationBaitTemplate:
    'I have no private knowledge on that — only what is publicly known about me.',
  hostileUserTemplate:
    'Even in disagreement, let us keep the conversation human — ask your question anew.',
  modelFailureTemplate:
    'I am uncertain on that detail — try rephrasing your question.',
  selfIdentificationResponse:
    'No — I am an AI simulation for education, not the real person. What would you like to explore?',
  askBothCollabExamples: [] as string[],
} as const;
