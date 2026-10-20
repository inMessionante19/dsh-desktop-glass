import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareDesktopPatch, verifyDesktopPatch } from './desktop-patch.mjs';

const execute = promisify(execFile);
const flags = process.argv.slice(2);
const argument = (name, fallback) => { const index = flags.indexOf(name); return index < 0 ? fallback : flags[index + 1]; };
const appDir = resolve(argument('--app-dir', 'D:/deepseekHARNESS/dsh'));
const backupDir = resolve(argument('--backup-dir', join(dirname(fileURLToPath(import.meta.url)), '..', 'backups')));
const archive = join(appDir, 'resources', 'app.asar');
const executable = join(appDir, 'DeepSeek Harness.exe');
const ledgerFile = join(backupDir, 'native-glass-install.json');
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
async function requireClosed() {
  const script = "[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false); @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | ForEach-Object { $_.Path }) | ConvertTo-Json -Compress";
  const { stdout } = await execute('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 10000 });
  const paths = stdout.trim() ? JSON.parse(stdout) : [];
  if ([].concat(paths || []).some(path => typeof path === 'string' && resolve(path).toLowerCase() === executable.toLowerCase())) throw new Error('请先从托盘完全退出 DeepSeek Harness，再安装原生适配。');
}

await requireClosed();
await mkdir(backupDir, { recursive: true });
if (flags.includes('--restore')) {
  const ledger = JSON.parse(await readFile(ledgerFile, 'utf8'));
  if (ledger.appDir !== appDir || await hash(archive) !== ledger.patchedHash) throw new Error('桌面程序已变化，停止恢复以保护新版本。');
  if (await hash(ledger.backupPath) !== ledger.originalHash) throw new Error('原始备份校验失败。');
  await requireClosed();
  await copyFile(ledger.backupPath, archive);
  console.log(JSON.stringify({ restored: true, archive }));
} else {
  const bytes = await readFile(executable);
  const offset = bytes.indexOf(Buffer.from('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX'));
  if (offset < 0 || bytes[offset + 32] !== 1 || bytes[offset + 33] < 5 || bytes[offset + 38] !== 48) throw new Error('此桌面版启用了不同的归档保护，不安装补丁，也不修改程序保护设置。');
  const prepared = join(backupDir, 'app.native-prepared.asar');
  const result = await prepareDesktopPatch(archive, prepared);
  if (result.alreadyPatched) console.log(JSON.stringify({ installed: true, alreadyPatched: true }));
  else {
    const verification = await verifyDesktopPatch(archive, prepared);
    const sourceHash = await hash(archive);
    const rollbackPath = join(backupDir, `app.original-${sourceHash.slice(0, 16)}.asar`);
    await copyFile(archive, rollbackPath);
    let originalHash = sourceHash, backupPath = rollbackPath;
    try {
      const previous = JSON.parse(await readFile(ledgerFile, 'utf8'));
      if (previous.appDir === appDir && previous.patchedHash === sourceHash && await hash(previous.backupPath) === previous.originalHash) {
        originalHash = previous.originalHash;
        backupPath = previous.backupPath;
      }
    } catch { /* First installation has no prior ledger. */ }
    const patchedHash = await hash(prepared);
    await requireClosed();
    if (await hash(archive) !== sourceHash) throw new Error('安装期间桌面程序发生变化，已停止。');
    await copyFile(prepared, archive);
    if (await hash(archive) !== patchedHash) { await copyFile(rollbackPath, archive); throw new Error('安装校验失败，已恢复安装前版本。'); }
    await writeFile(ledgerFile, JSON.stringify({ appDir, archive, backupPath, originalHash, patchedHash, version: '0.2.1' }, null, 2));
    console.log(JSON.stringify({ installed: true, backupPath, ...verification }));
  }
}
