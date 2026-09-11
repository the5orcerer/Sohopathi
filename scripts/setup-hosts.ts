import fs from 'fs';
import os from 'os';

const HOSTS_ENTRY = '127.0.0.1 www.biddyapith.local app.biddyapith.local api.biddyapith.local biddyapith.local';
const isWindows = process.platform === 'win32';
const hostsPath = isWindows
  ? 'C:\\Windows\\System32\\drivers\\etc\\hosts'
  : '/etc/hosts';

function main() {
  console.log(`Checking hosts file at: ${hostsPath}`);

  try {
    const content = fs.readFileSync(hostsPath, 'utf8');
    if (content.includes('biddyapith.local')) {
      console.log('✅ biddyapith.local entries are already present in hosts file.');
      return;
    }

    console.log('Appending biddyapith.local entries to hosts file...');
    const appendContent = `\n# Biddyapith Local Development Domains\n${HOSTS_ENTRY}\n`;
    fs.appendFileSync(hostsPath, appendContent, 'utf8');
    console.log('✅ Successfully added entries to hosts file:');
    console.log(`   ${HOSTS_ENTRY}`);
  } catch (err: any) {
    console.warn(`\n⚠️  Could not write to hosts file automatically (${err.message}).`);
    console.log(`Please manually append the following line to ${hostsPath} using Administrator/sudo privileges:\n`);
    console.log(`  ${HOSTS_ENTRY}\n`);
    if (!isWindows) {
      console.log(`Quick command:`);
      console.log(`  echo "${HOSTS_ENTRY}" | sudo tee -a /etc/hosts\n`);
    }
  }
}

main();

