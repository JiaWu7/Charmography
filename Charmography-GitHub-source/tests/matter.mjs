import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const module={exports:{}};
const source=await readFile(new URL('../web/assets/matter.min.js',import.meta.url),'utf8');
vm.runInThisContext('(function(module,exports){\n'+source+'\n})',{filename:'matter.min.js'})(module,module.exports);
export default module.exports;
