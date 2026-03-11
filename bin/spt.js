#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tsxPath = path.join(__dirname, '..', 'node_modules', '.bin', 'tsx');
const mainPath = path.join(__dirname, '..', 'index.js');

spawn(tsxPath, [mainPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true
}).on('exit', (code) => process.exit(code || 0));
