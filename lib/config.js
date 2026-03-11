import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'spt');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_KEYBINDINGS = {
  quit: 'q',
  help: '?',
  search: '/',
  playPause: ' ',
  next: 'n',
  previous: 'b',
  volumeUp: '+',
  volumeDown: '-',
  enterSearch: 'i',
  focusPlaylists: 'a',
  focusArtists: 's',
  focusPlayer: 'd',
  focusSearch: 'f',
  shuffle: 'z'
};

/**
 * 設定ファイルを読み込む、または存在しない場合は新規作成（プロンプト）する
 */
export async function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    const art = `
                                                                                    ___   ___ 
    //   ) )                                 //  ) )          /__  ___/ //   / /   / /    
   ((         ___      ___    __  ___ ( ) __//__                / /    //   / /   / /     
     \\     //   ) ) //   ) )  / /   / /   //   //   / / ____  / /    //   / /   / /      
       ) ) //___/ / //   / /  / /   / /   //   ((___/ /       / /    //   / /   / /       
((___ / / //       ((___/ /  / /   / /   //        / /       / /    ((___/ / __/ /___     
    `;
    console.log(art);
    console.log('Spotify Developer Dashboard (https://developer.spotify.com/dashboard) でアプリを作成し、以下の情報を取得してください。');
    console.log('Redirect URI には http://127.0.0.1:8888/callback を設定してください。\n');

    const clientId = await askQuestion('Client ID: ');
    const clientSecret = await askQuestion('Client Secret: ');

    const config = {
      clientId,
      clientSecret,
      redirectUri: 'http://127.0.0.1:8888/callback',
      keybindings: DEFAULT_KEYBINDINGS
    };

    saveConfig(config);
    return config;
  }

  const data = fs.readFileSync(CONFIG_FILE, 'utf8');
  const config = JSON.parse(data);

  // デフォルトキーとマージ（将来的なキー追加への対応）
  config.keybindings = { ...DEFAULT_KEYBINDINGS, ...config.keybindings };

  return config;
}

/**
 * 設定を保存する
 */
export function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * ターミナルで入力を促す
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}
