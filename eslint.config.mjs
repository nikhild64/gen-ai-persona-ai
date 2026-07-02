// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import boundaries from 'eslint-plugin-boundaries';

/**
 * ESLint 9 flat config for gen-ai-persona-ai. Encodes AD-2, AD-3, AD-6, AD-8,
 * AD-9, AD-17, AD-22 as machine-enforced rules.
 *
 * All AD-9 constants + `THEME_VARS`, `PROVIDER_REGISTRY`, `PERSONA_REGISTRY`,
 * `HITESH_REGEX`, `PIYUSH_REGEX` may be declared ONLY in their canonical config
 * file — re-declaration elsewhere is a hard `no-restricted-syntax` error.
 */

const HINGLISH_SIGNATURE_REGEX =
  'Haanji|Chai ke saath|देखो|यार|बात समझ आई|कुछ नहीं है';

const CANONICAL_CONSTANT_NAMES = [
  'VERBATIM_TAIL_LENGTH',
  'SUMMARY_REFRESH_CADENCE',
  'SUMMARY_TOKEN_BUDGET_PCT',
  'DRIFT_REFRESH_FIRST_TURN',
  'DRIFT_REFRESH_CADENCE',
  'MAX_TURNS_PER_THREAD',
  'KEEP_GOING_ROUNDS',
  'STREAM_STALL_TIMEOUT_MS',
  'THEME_VARS',
  'PROVIDER_REGISTRY',
  'PROVIDER_DEFAULT_ROUTING',
  'ASK_BOTH_SYSTEM_NOTE_TEMPLATE',
  'ASK_BOTH_KEEP_GOING_SYSTEM_NOTE_TEMPLATE',
  'ASK_BOTH_SUMMARY_PROVIDER_ID',
  'HITESH_REGEX',
  'PIYUSH_REGEX',
  'PERSONA_REGISTRY',
  'PERSONA_MODEL_PARAMS',
];

const NO_REDECLARE_SELECTOR = `VariableDeclarator[id.name=/^(${CANONICAL_CONSTANT_NAMES.join(
  '|',
)})$/]`;

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      '.angular/',
      'coverage/',
      '_bmad/',
      '_bmad-output/',
      '.agents/',
    ],
  },

  // ─── TypeScript files (source + specs) ─────────────────────────────────────
  {
    files: ['src/**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['tsconfig.app.json', 'tsconfig.spec.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    processor: angular.processInlineTemplates,
    plugins: {
      boundaries,
    },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/*' },
        { type: 'personas', pattern: 'src/personas/*' },
        { type: 'infrastructure', pattern: 'src/infrastructure/*' },
        { type: 'features', pattern: 'src/features/*' },
        { type: 'shared', pattern: 'src/shared/*' },
        { type: 'config', pattern: 'src/config/*' },
        { type: 'app', pattern: 'src/app/*' },
      ],
      'boundaries/include': ['src/**/*.ts'],
    },
    rules: {
      // ── AD-2: Hexagonal boundaries ───────────────────────────────────────
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'domain', allow: ['domain', 'personas', 'config'] },
            { from: 'personas', allow: ['domain', 'config'] },
            { from: 'infrastructure', allow: ['domain', 'config'] },
            {
              from: 'features',
              allow: ['domain', 'personas', 'shared', 'config'],
            },
            { from: 'shared', allow: ['domain', 'config'] },
            { from: 'config', allow: ['config', 'domain'] },
            {
              from: 'app',
              allow: [
                'app',
                'features',
                'domain',
                'infrastructure',
                'personas',
                'shared',
                'config',
              ],
            },
          ],
        },
      ],

      // ── AD-6, AD-11: browser-persistence APIs whitelisted per file ──────
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'Use StoragePort or KeyVaultService.' },
        {
          name: 'sessionStorage',
          message: 'sessionStorage is only allowed inside KeyVaultService (AD-11).',
        },
        { name: 'caches', message: 'Use StoragePort.' },
        { name: 'indexedDB', message: 'Use StoragePort (IdbKeyvalStorageAdapter).' },
      ],

      // ── AD-3: adapters accessed via registries only ──────────────────────
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**/*.adapter'],
              message:
                'Adapters go through PROVIDER_REGISTRY / StoragePort / ModerationPort / AnalyticsPort — never direct-import.',
            },
          ],
        },
      ],

      // ── AD-22: Hinglish signature phrases banned in features/shared ─────
      // ── AD-8/AD-9/AD-17: canonical constants may not be re-declared ─────
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=/${HINGLISH_SIGNATURE_REGEX}/]`,
          message:
            'Hinglish signature phrases live in src/personas/*.prompt.ts or src/config/product-copy.ts (AD-22).',
        },
        {
          selector: `TemplateElement[value.raw=/${HINGLISH_SIGNATURE_REGEX}/]`,
          message:
            'Hinglish signature phrases live in src/personas/*.prompt.ts or src/config/product-copy.ts (AD-22).',
        },
        {
          selector: NO_REDECLARE_SELECTOR,
          message:
            'This constant is declared in its canonical src/config/*.ts (or persona registry) file per AD-8/AD-9/AD-17 — re-declaring elsewhere is banned.',
        },
      ],

      // ── Angular hygiene ─────────────────────────────────────────────────
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],

      // ── Tone down defaults that would nag the skeleton ──────────────────
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ─── Overrides for canonical files that DEFINE the restricted symbols ─
  {
    files: [
      'src/config/context-config.ts',
      'src/config/theme-vars.ts',
      'src/config/provider-registry.ts',
      'src/config/prompt-format.ts',
      'src/config/regex-patterns.ts',
      'src/config/model-params.ts',
      'src/infrastructure/providers/provider.registry.ts', // canonical PROVIDER_REGISTRY declaration
      'src/personas/persona.registry.ts',
      'src/personas/hitesh.prompt.ts',
      'src/personas/piyush.prompt.ts',
      'src/personas/blended.prompt.ts', // post-sprint Blended Ask-Both fusion composition (AD-22)
      'src/config/product-copy.ts',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // ─── Storage-adapter exemption (AD-6): file that IS the port impl ────
  //     plus the last-active-solo persona tracker in chat/mode surfaces
  //     which persists a non-sensitive UI hint in sessionStorage.
  {
    files: [
      'src/infrastructure/storage/idb-keyval.adapter.ts',
      'src/domain/key-vault/key-vault.service.ts',
      'src/features/chat/chat.component.ts',
      'src/features/mode-switcher/mode-switcher.component.ts',
      'src/features/ask-both/ask-both-mode.service.ts', // post-sprint: persists Ask-Both variant preference (AD-11 semantics)
      'src/features/ask-both/blended-pair.service.ts', // V2: persists Blended pair selection (AD-11 semantics)
      'src/domain/key-vault/model-discovery.service.ts',
      'src/domain/key-vault/model-selection.service.ts',
      'src/domain/key-vault/persona-routing.service.ts',
    ],
    rules: {
      'no-restricted-globals': 'off',
    },
  },

  // ─── App shell may reference concrete adapters for DI wiring ──────────
  {
    files: ['src/app/app.config.ts', 'src/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // ─── Spec files: relax a few strictness knobs for test ergonomics ─────
  {
    files: ['src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-restricted-syntax': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-imports': 'off',
      'boundaries/element-types': 'off',
    },
  },

  // ─── Angular HTML template files ──────────────────────────────────────
  {
    files: ['src/**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
  },
);
