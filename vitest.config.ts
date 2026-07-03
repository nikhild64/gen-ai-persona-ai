import { defineConfig } from 'vitest/config';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Vitest-only pre-transform that inlines Angular `templateUrl` / `styleUrls`
 * back into `template` / `styles` for `*.component.ts` sources. Vanilla
 * `bunx vitest run` does not go through `@angular/build`'s unit-test
 * builder, which is what normally resolves external component resources at
 * TestBed compileComponents() time — so specs that import components with
 * external URLs would fail with "Component X is not resolved". Rewriting
 * decorator metadata to inline literals sidesteps that entirely and keeps
 * runtime behavior identical to the pre-refactor inline-only source.
 *
 * `ng test` (via `@angular/build:unit-test`) and production `ng build`
 * pipelines are untouched — they read the external `.html` / `.scss`
 * files directly.
 */
function inlineAngularComponentResources() {
  const escapeForTemplateLiteral = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

  return {
    name: 'inline-angular-component-resources',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      if (!id.endsWith('.ts') || id.endsWith('.spec.ts') || id.endsWith('.d.ts')) {
        return null;
      }
      if (!code.includes('templateUrl') && !code.includes('styleUrl')) {
        return null;
      }

      const dir = dirname(id);
      let out = code;
      let changed = false;

      const tplRe = /templateUrl:\s*(['"])([^'"]+)\1/;
      const tplMatch = out.match(tplRe);
      if (tplMatch) {
        const fullPath = resolve(dir, tplMatch[2]);
        const content = await fs.readFile(fullPath, 'utf8');
        out = out.replace(
          tplRe,
          `template: \`${escapeForTemplateLiteral(content)}\``,
        );
        changed = true;
      }

      const styleUrlsRe = /styleUrls:\s*\[([\s\S]*?)\]/;
      const styleUrlsMatch = out.match(styleUrlsRe);
      if (styleUrlsMatch) {
        const urls = Array.from(
          styleUrlsMatch[1].matchAll(/(['"])([^'"]+)\1/g),
        ).map((m) => m[2]);
        const contents = await Promise.all(
          urls.map(async (u) => await fs.readFile(resolve(dir, u), 'utf8')),
        );
        const literals = contents
          .map((c) => `\`${escapeForTemplateLiteral(c)}\``)
          .join(', ');
        out = out.replace(styleUrlsRe, `styles: [${literals}]`);
        changed = true;
      }

      // `styleUrl:` (singular, no array) — used by @angular/build's schematic
      // for single-stylesheet components (e.g., src/app/app.ts).
      const styleUrlRe = /styleUrl:\s*(['"])([^'"]+)\1/;
      const styleUrlMatch = out.match(styleUrlRe);
      if (styleUrlMatch) {
        const fullPath = resolve(dir, styleUrlMatch[2]);
        const content = await fs.readFile(fullPath, 'utf8');
        out = out.replace(
          styleUrlRe,
          `styles: [\`${escapeForTemplateLiteral(content)}\`]`,
        );
        changed = true;
      }

      if (!changed) return null;
      return { code: out, map: null };
    },
  };
}

export default defineConfig({
  plugins: [inlineAngularComponentResources()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    globals: false,
  },
});
