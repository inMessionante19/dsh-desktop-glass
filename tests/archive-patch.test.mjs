import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareDesktopPatch,verifyDesktopPatch,readArchive,PATCH_MARKER,preloadBridge} from '../native/desktop-patch.mjs';

// Generated fixtures contain no application binaries or copied application source.
const anchor='\tipcMain.on(DESKTOP_IPC.windowsAppearance, (event, language, color, symbolColor) => {';
const main=`function chromeFallbackFill() { return '#fff'; }\nfunction boot() {\n${anchor}\n\t});\n}\n`;
async function makeArchive(filename,mainSource=main,preload='const electron = {};\n') {
  const files={'lib/main.js':Buffer.from(mainSource),'lib/preload-app.cjs':Buffer.from(preload),'assets/unchanged.txt':Buffer.from('unchanged fixture\n')};
  const header={files:{}},payload=[];
  let offset=0;
  for(const [name,bytes] of Object.entries(files)) {
    const parts=name.split('/');let dir=header;
    for(const segment of parts.slice(0,-1))dir=dir.files[segment]??=( {files:{}} );
    const hash=createHash('sha256').update(bytes).digest('hex');
    dir.files[parts.at(-1)]={size:bytes.length,offset:String(offset),integrity:{algorithm:'SHA256',hash,blockSize:4194304,blocks:[hash]}};
    payload.push(bytes);offset+=bytes.length;
  }
  header.files['external.node']={size:7,unpacked:true};
  header.files['main-link']={link:'lib/main.js'};
  const json=Buffer.from(JSON.stringify(header)),size=Math.ceil((4+json.length)/4)*4;
  const prefix=Buffer.alloc(12+size);
  prefix.writeUInt32LE(4,0);prefix.writeUInt32LE(size+4,4);prefix.writeUInt32LE(size,8);prefix.writeUInt32LE(json.length,12);json.copy(prefix,16);
  await writeFile(filename,Buffer.concat([prefix,...payload]));
}

test('patch updates only the two bridge files and preserves other payloads and metadata',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dsh-glass-test-'));
  try {
    const original=join(dir,'original.asar'),patched=join(dir,'patched.asar');
    await makeArchive(original);
    const before=await readFile(original);
    assert.equal((await prepareDesktopPatch(original,patched)).alreadyPatched,false);
    assert.deepEqual(await readFile(original),before);
    assert.deepEqual(await verifyDesktopPatch(original,patched),{unchangedPackedFilesVerified:1,changed:['lib/main.js','lib/preload-app.cjs']});
    const archive=await readArchive(patched);
    try {
      const source=(await archive.read('lib/main.js')).toString();
      assert.ok(source.includes(PATCH_MARKER));
      assert.ok((await archive.read('lib/preload-app.cjs')).toString().includes(preloadBridge));
      assert.equal((await archive.read('assets/unchanged.txt')).toString(),'unchanged fixture\n');
      assert.deepEqual(archive.header.files['external.node'],{size:7,unpacked:true});
      assert.deepEqual(archive.header.files['main-link'],{link:'lib/main.js'});
      for(const key of ['lib/main.js','lib/preload-app.cjs']) {
        const bytes=await archive.read(key),entry=archive.entries.find(e=>e.key===key).entry;
        assert.equal(entry.integrity.hash,createHash('sha256').update(bytes).digest('hex'));
      }
    } finally {await archive.handle.close()}
    assert.deepEqual(await prepareDesktopPatch(patched,join(dir,'duplicate.asar')),{alreadyPatched:true});
    await assert.rejects(stat(join(dir,'duplicate.asar')),{code:'ENOENT'});
  } finally {await rm(dir,{recursive:true,force:true})}
});

test('upgrading a prior bridge replaces it instead of registering duplicate handlers',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dsh-glass-test-'));
  try {
    const original=join(dir,'prior.asar'),patched=join(dir,'next.asar');
    await makeArchive(original,main.replace(anchor,'\t// __DSH_NATIVE_GLASS_021__\n\tlegacyHandler();\n'+anchor),'const electron = {};\n// __DSH_NATIVE_GLASS_021__\nlegacyPreload();\n');
    await prepareDesktopPatch(original,patched);
    const archive=await readArchive(patched);
    try {
      const source=(await archive.read('lib/main.js')).toString(),preload=(await archive.read('lib/preload-app.cjs')).toString();
      assert.ok(!source.includes('legacyHandler'));
      assert.ok(!preload.includes('legacyPreload'));
      assert.equal(source.split(PATCH_MARKER).length,2);
      assert.equal(preload.split(PATCH_MARKER).length,2);
    } finally {await archive.handle.close()}
  } finally {await rm(dir,{recursive:true,force:true})}
});

test('unsupported desktop layouts stop before creating output or changing input',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'dsh-glass-test-'));
  try {
    const original=join(dir,'unsupported.asar'),patched=join(dir,'output.asar');
    await makeArchive(original,'function unrelatedBuild() {}');
    const before=await readFile(original);
    await assert.rejects(prepareDesktopPatch(original,patched),/Unsupported desktop build/);
    assert.deepEqual(await readFile(original),before);
    await assert.rejects(stat(patched),{code:'ENOENT'});
  } finally {await rm(dir,{recursive:true,force:true})}
});
