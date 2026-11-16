/**
 * Gera docs/legal/termos.md e docs/legal/privacidade.md a partir dos textos do app,
 * para publicar em um site (as lojas exigem um link público). Rode: npm run legal:export
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LEGAL_DOCUMENTS, VERSAO } from '../apps/mobile/src/legal/documents';

const outDir = path.resolve(import.meta.dirname, '..', 'docs', 'legal');
mkdirSync(outDir, { recursive: true });

for (const doc of Object.values(LEGAL_DOCUMENTS)) {
  const body = [
    `# ${doc.title}`,
    '',
    `_Versão de ${VERSAO}_`,
    '',
    doc.intro,
    '',
    ...doc.sections.flatMap((s) => [`## ${s.title}`, '', ...s.paragraphs.flatMap((p) => [p, '']), '']),
  ].join('\n');
  writeFileSync(path.join(outDir, `${doc.slug}.md`), body.trimEnd() + '\n');
  console.log(`  ✔ docs/legal/${doc.slug}.md`);
}
