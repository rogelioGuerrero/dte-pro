import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const outDir = path.join(projectRoot, 'public', 'catalogos');

function extractArrayLiteral(source, anchor) {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex < 0) {
    throw new Error(`Anchor not found: ${anchor}`);
  }

  const eqIndex = source.indexOf('=', anchorIndex);
  if (eqIndex < 0) {
    throw new Error(`Assignment '=' not found for anchor: ${anchor}`);
  }

  const startIndex = source.indexOf('[', eqIndex);
  if (startIndex < 0) {
    throw new Error(`Array start not found for anchor: ${anchor}`);
  }

  let depth = 0;
  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '[') depth += 1;
    if (ch === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, i + 1);
      }
    }
  }

  throw new Error(`Array end not found for anchor: ${anchor}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const deptosPath = path.join(projectRoot, 'catalogos', 'departamentosMunicipios.ts');
  const actividadesPath = path.join(projectRoot, 'catalogos', 'actividadesEconomicas.ts');

  const deptosSource = await readFile(deptosPath, 'utf8');
  const deptosLiteral = extractArrayLiteral(deptosSource, 'export const departamentos');
  const departamentos = vm.runInNewContext(deptosLiteral, {});

  const actividadesSource = await readFile(actividadesPath, 'utf8');
  const actividadesLiteral = extractArrayLiteral(actividadesSource, 'export const actividadesEconomicas');
  const actividadesEconomicas = vm.runInNewContext(actividadesLiteral, {});

  const comunesLiteral = extractArrayLiteral(actividadesSource, 'export const actividadesComunes');
  const actividadesComunes = vm.runInNewContext(comunesLiteral, {});

  await writeFile(
    path.join(outDir, 'departamentosMunicipios.json'),
    JSON.stringify({ departamentos }, null, 2),
    'utf8'
  );

  await writeFile(
    path.join(outDir, 'actividadesEconomicas.json'),
    JSON.stringify({ actividadesEconomicas, actividadesComunes }, null, 2),
    'utf8'
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
