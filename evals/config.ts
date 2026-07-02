import type { ProviderId } from '../src/config/provider-registry';

/**
 * Eval-time provider selection. Both generator and judge are separately
 * configurable per PRD §8 (decoupled generator ↔ judge).
 *
 * Provide keys via env vars — never commit them.
 */
export interface EvalConfig {
  generatorProvider: ProviderId;
  judgeProvider: ProviderId;
  generatorKey: string;
  judgeKey: string;
}

export function loadEvalConfig(): EvalConfig {
  const env = process.env;
  const generatorProvider = (env['EVAL_GENERATOR'] as ProviderId) || 'gemini';
  const judgeProvider = (env['EVAL_JUDGE'] as ProviderId) || 'groq';
  const generatorKey = env['EVAL_GENERATOR_KEY'];
  const judgeKey = env['EVAL_JUDGE_KEY'];

  if (!generatorKey || !judgeKey) {
    throw new Error(
      'EVAL_GENERATOR_KEY and EVAL_JUDGE_KEY env vars are required.',
    );
  }

  return {
    generatorProvider,
    judgeProvider,
    generatorKey,
    judgeKey,
  };
}
