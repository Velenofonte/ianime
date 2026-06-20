import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const versionPath = path.join(__dirname, '..', 'client', 'src', 'version.json');

const mode = process.argv[2] ?? 'build';

const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
data.major = Number(data.major) || 1;
data.minor = Number(data.minor) || 0;
data.build = Number(data.build) || 0;

if (mode === 'major') {
  data.major += 1;
  data.minor = 0;
  data.build = 1;
} else if (mode === 'minor') {
  data.minor += 1;
  data.build = 1;
} else if (mode === 'build') {
  if (data.build >= 99) {
    console.error(
      'Build al massimo (99). Aumenta minor o major manualmente (npm run version:minor / version:major) oppure modifica client/src/version.json.'
    );
    process.exit(1);
  }
  data.build += 1;
} else {
  console.error('Uso: node scripts/bump-version.mjs [build|minor|major]');
  process.exit(1);
}

fs.writeFileSync(versionPath, `${JSON.stringify(data, null, 2)}\n`);

const label = `v.${data.major}.${data.minor}.${String(data.build).padStart(2, '0')}`;
console.log(label);
