import { open, readFile, writeFile, copyFile, mkdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

export const PATCH_MARKER = '__DSH_NATIVE_GLASS_021__';

// Independent compositor blur; never takes keyboard focus or changes z-order.
export function createPersistentAcrylic(koffi, isDark = () => false) {
  const user32 = koffi.load('user32.dll');
  const dataType = koffi.struct('DSH_GLASS_WCA_DATA', { Attribute: 'int', Data: 'void *', Size: 'size_t' });
  const set = user32.func('int __stdcall SetWindowCompositionAttribute(void *window, DSH_GLASS_WCA_DATA *data)');
  return (window, enabled) => {
    const policy = Buffer.alloc(16);
    policy.writeInt32LE(enabled ? 4 : 0, 0);
    policy.writeUInt32LE(isDark() ? 0x20191919 : 0x20ffffff, 8);
    const bytes = window.getNativeWindowHandle();
    const handle = bytes.length === 8 ? bytes.readBigUInt64LE(0) : BigInt(bytes.readUInt32LE(0));
    window.setBackgroundMaterial('none');
    if (enabled) window.setBackgroundColor('#00000000');
    if (!set(handle, { Attribute: 19, Data: policy, Size: 16 })) throw new Error('Native glass appearance could not be updated');
  };
}

// Serialized into the desktop main process; keep this function self-contained.
export function installNativeGlassIPC(ipcMain, getWindow, getFallbackFill, applyPersistent) {
  ipcMain.handle('dsh-desktop:glass-v2', (event, enabled) => {
    const window = getWindow();
    if (!window || window.isDestroyed() || event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame ||
        !event.senderFrame.url.startsWith('dsh-app://app/')) throw new Error('Untrusted native glass caller');
    if (typeof enabled !== 'boolean') throw new TypeError('enabled must be boolean');
    if (process.platform !== 'win32') return { supported: false, enabled: false };
    applyPersistent(window, enabled);
    window.setBackgroundColor(enabled ? '#00000000' : getFallbackFill());
    return { supported: true, enabled, material: enabled ? 'acrylic' : 'none', version: 2, persistent: true };
  });
}

export const preloadBridge = `
// ${PATCH_MARKER}
if (location.protocol === 'dsh-app:' && location.hostname === 'app' && process.isMainFrame) {
  electron.contextBridge.exposeInMainWorld('__DSH_NATIVE_GLASS__', {
    version: 2,
    setEnabled: (enabled) => {
      if (typeof enabled !== 'boolean') return Promise.reject(new TypeError('enabled must be boolean'));
      return electron.ipcRenderer.invoke('dsh-desktop:glass-v2', enabled);
    }
  });
}
`;

export async function readArchive(filename) {
  const handle = await open(filename, 'r');
  const prefix = Buffer.alloc(16);
  await handle.read(prefix, 0, 16, 0);
  const headerSize = prefix.readUInt32LE(4);
  const jsonSize = prefix.readUInt32LE(12);
  if (jsonSize < 2 || jsonSize > 64 * 1024 * 1024 || headerSize < jsonSize + 8) throw new Error('Invalid ASAR header');
  const data = Buffer.alloc(jsonSize);
  await handle.read(data, 0, data.length, 16);
  const header = JSON.parse(data.toString('utf8'));
  const entries = [];
  const walk = (node, prefix = '') => {
    for (const [name, value] of Object.entries(node.files || {})) {
      const key = prefix ? `${prefix}/${name}` : name;
      if (value.files) walk(value, key);
      else entries.push({ key, entry: value });
    }
  };
  walk(header);
  return { handle, header, entries, dataStart: 8 + headerSize, async read(key) {
    const value = entries.find(e => e.key === key)?.entry;
    if (!value || value.unpacked || value.link) throw new Error('Not a packed file: ' + key);
    const bytes = Buffer.alloc(value.size);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 8 + headerSize + Number(value.offset));
    if (bytesRead !== bytes.length) throw new Error('Incomplete ASAR read');
    return bytes;
  } };
}

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function integrity(bytes, blockSize = 4 * 1024 * 1024) {
  const blocks = [];
  for (let offset = 0; offset < bytes.length; offset += blockSize) blocks.push(sha256(bytes.subarray(offset, offset + blockSize)));
  return { algorithm: 'SHA256', hash: sha256(bytes), blockSize, blocks };
}

export async function prepareDesktopPatch(archivePath, outputPath) {
  const archive = await readArchive(archivePath);
  let output;
  try {
    let main = (await archive.read('lib/main.js')).toString('utf8');
    let preload = (await archive.read('lib/preload-app.cjs')).toString('utf8');
    if (main.includes(PATCH_MARKER) && preload.includes(PATCH_MARKER)) return { alreadyPatched: true };
    main = main.replace(/\t\/\/ __DSH_NATIVE_GLASS_\d+__\n[\s\S]*?(?=\tipcMain\.on\(DESKTOP_IPC\.windowsAppearance,)/, '');
    preload = preload.replace(/\n\/\/ __DSH_NATIVE_GLASS_\d+__[\s\S]*$/, '');
    const anchor = '\tipcMain.on(DESKTOP_IPC.windowsAppearance, (event, language, color, symbolColor) => {';
    if (main.split(anchor).length !== 2 || !main.includes('function chromeFallbackFill()')) throw new Error('Unsupported desktop build; native bridge was not installed.');
    const persistent = `(() => { let apply; return (window, enabled) => { apply ??= (${createPersistentAcrylic.toString()})(createRequire(import.meta.url)('../dsh/node_modules/koffi'), () => nativeTheme.shouldUseDarkColors); apply(window, enabled); }; })()`;
    const patchedMain = main.replace(anchor, `\t// ${PATCH_MARKER}\n\t(${installNativeGlassIPC.toString()})(ipcMain, () => mainWindow, chromeFallbackFill, ${persistent});\n${anchor}`);
    const replacements = new Map([
      ['lib/main.js', Buffer.from(patchedMain)],
      ['lib/preload-app.cjs', Buffer.from(preload + preloadBridge)]
    ]);
    const packed = archive.entries.filter(({entry}) => !entry.unpacked && !entry.link && entry.offset !== undefined)
      .sort((a, b) => Number(a.entry.offset) - Number(b.entry.offset));
    const positions = new Map(packed.map(({key, entry}) => [key, { offset: Number(entry.offset), size: entry.size }]));
    let offset = 0;
    for (const {key, entry} of packed) {
      const replacement = replacements.get(key);
      entry.offset = String(offset);
      if (replacement) { entry.size = replacement.length; entry.integrity = integrity(replacement, entry.integrity?.blockSize); }
      offset += entry.size;
    }
    const json = Buffer.from(JSON.stringify(archive.header));
    const payloadSize = Math.ceil((4 + json.length) / 4) * 4;
    const header = Buffer.alloc(12 + payloadSize);
    header.writeUInt32LE(4, 0);
    header.writeUInt32LE(payloadSize + 4, 4);
    header.writeUInt32LE(payloadSize, 8);
    header.writeUInt32LE(json.length, 12);
    json.copy(header, 16);
    await mkdir(dirname(outputPath), { recursive: true });
    output = await open(outputPath, 'w');
    await output.write(header);
    const chunk = Buffer.alloc(4 * 1024 * 1024);
    for (const {key} of packed) {
      const replacement = replacements.get(key);
      if (replacement) { await output.write(replacement); continue; }
      const old = positions.get(key);
      for (let at = 0; at < old.size;) {
        const wanted = Math.min(chunk.length, old.size - at);
        const {bytesRead} = await archive.handle.read(chunk, 0, wanted, archive.dataStart + old.offset + at);
        if (bytesRead !== wanted) throw new Error('ASAR source changed during patching');
        await output.write(chunk, 0, bytesRead);
        at += bytesRead;
      }
    }
    await output.sync();
    return { alreadyPatched: false, changedFiles: [...replacements.keys()], originalSize: (await stat(archivePath)).size, patchedSize: header.length + offset };
  } finally { await output?.close(); await archive.handle.close(); }
}

export async function verifyDesktopPatch(originalPath, patchedPath) {
  const original = await readArchive(originalPath);
  const patched = await readArchive(patchedPath);
  try {
    const changed = [];
    if (original.entries.length !== patched.entries.length) throw new Error('ASAR entry count changed');
    for (const {key, entry} of original.entries) {
      if (entry.unpacked || entry.link) continue;
      const oldData = await original.read(key);
      const newData = await patched.read(key);
      if (!oldData.equals(newData)) changed.push(key);
    }
    if (JSON.stringify(changed.sort()) !== JSON.stringify(['lib/main.js', 'lib/preload-app.cjs'])) throw new Error('Unexpected archive modifications: ' + changed.join(', '));
    return { unchangedPackedFilesVerified: original.entries.filter(e => !e.entry.unpacked && !e.entry.link).length - changed.length, changed };
  } finally { await original.handle.close(); await patched.handle.close(); }
}
