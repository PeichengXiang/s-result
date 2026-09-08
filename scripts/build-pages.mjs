import {renameSync,writeFileSync} from 'node:fs';
renameSync('docs/pages.html','docs/index.html');
writeFileSync('docs/.nojekyll','');
