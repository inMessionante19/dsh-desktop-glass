import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {installNativeGlassIPC,preloadBridge,PATCH_MARKER,readArchive} from '../native/desktop-patch.mjs';

function fixture() {
  let handler;
  const changes=[];
  const frame={url:'dsh-app://app/'};
  const webContents={mainFrame:frame};
  const window={webContents,isDestroyed:()=>false,setBackgroundColor:color=>changes.push(['color',color])};
  installNativeGlassIPC({handle(name,fn){assert.equal(name,'dsh-desktop:glass-v2');handler=fn}},()=>window,()=> '#1b1b1c',(_window,enabled,mode)=>changes.push(['native',enabled,mode]));
  return {handler,changes,frame,window,event:{sender:webContents,senderFrame:frame}};
}

test('native bridge rejects other senders, child frames, foreign origins and invalid arguments',()=>{
  const {handler,event,frame,window,changes}=fixture();
  assert.throws(()=>handler({...event,sender:{}},true),/Untrusted/);
  assert.throws(()=>handler({...event,senderFrame:{url:'dsh-app://app/'}},true),/Untrusted/);
  for(const url of ['https://example.com/','dsh-app://app.example/','dsh-app://other/']) {
    frame.url=url;
    assert.throws(()=>handler(event,true),/Untrusted/);
  }
  frame.url='dsh-app://app/';
  for(const value of [null,{},0,'true']) assert.throws(()=>handler(event,value),/boolean/);
  for(const mode of [null,{},'acrylic','opaque',false]) assert.throws(()=>handler(event,true,mode),/mode/);
  window.isDestroyed=()=>true;
  assert.throws(()=>handler(event,true),/Untrusted/);
  assert.equal(changes.length,0);
});

test('both modes clear the native background and disabling restores the original fill',{skip:process.platform!=='win32'},()=>{
  const {handler,event,changes}=fixture();
  assert.deepEqual(handler(event,true),{supported:true,enabled:true,mode:'glass',material:'acrylic',version:3,persistent:true});
  assert.deepEqual(changes,[['native',true,'glass'],['color','#00000000']]);
  changes.length=0;
  assert.deepEqual(handler(event,true,'transparent'),{supported:true,enabled:true,mode:'transparent',material:'transparent',version:3,persistent:true});
  assert.deepEqual(changes,[['native',true,'transparent'],['color','#00000000']]);
  changes.length=0;
  assert.equal(handler(event,false,'transparent').enabled,false);
  assert.deepEqual(changes,[['native',false,'transparent'],['color','#1b1b1c']]);
});

test('unsupported platforms leave the native window untouched',{skip:process.platform==='win32'},()=>{
  const {handler,event,changes}=fixture();
  assert.deepEqual(handler(event,true,'transparent'),{supported:false,enabled:false});
  assert.deepEqual(changes,[]);
});

test('installer help and argument errors do not inspect or modify an application',()=>{
  const installer=fileURLToPath(new URL('../native/install.mjs',import.meta.url));
  const help=spawnSync(process.execPath,[installer,'--help'],{encoding:'utf8'});
  assert.equal(help.status,0);
  assert.match(help.stdout,/--app-dir/);
  const missing=spawnSync(process.execPath,[installer],{encoding:'utf8'});
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/--app-dir/);
  const malformed=spawnSync(process.execPath,[installer,'--app-dir','--restore'],{encoding:'utf8'});
  assert.notEqual(malformed.status,0);
  assert.match(malformed.stderr,/--app-dir/);
});

test('optional local archive verification checks both installed bridge halves',{skip:!process.env.GLASS_ARCHIVE},async()=>{
  const archive=await readArchive(process.env.GLASS_ARCHIVE);
  try {
    assert.ok((await archive.read('lib/main.js')).toString().includes(PATCH_MARKER));
    assert.ok((await archive.read('lib/preload-app.cjs')).toString().includes(preloadBridge));
  } finally {await archive.handle.close()}
});

test('host entry has no server or file access dependencies',async()=>{
  const host=await import('../lib/index.js');
  assert.deepEqual(host.inject,[]);
  assert.equal(typeof host.apply,'function');
  const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(manifest.dsh.manifestVersion,1);
  assert.ok(manifest.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-renderer'));
});
