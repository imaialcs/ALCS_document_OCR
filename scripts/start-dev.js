const { spawn } = require('child_process');
const waitOn = require('wait-on');

const DEFAULT_PORT = process.env.VITE_DEV_SERVER_PORT || '5173';
const VITE_ARGS = ['vite', '--port', DEFAULT_PORT];

const stripAnsi = (value) => value.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

const vite = spawn('npx', VITE_ARGS, { stdio: ['inherit', 'pipe', 'pipe'], shell: true });
let electronProcess;
let shuttingDown = false;
let desiredExitCode = 0;
let resolved = false;

const stopVite = () => {
  if (!vite.killed) {
    vite.kill();
  }
};

const stopElectron = () => {
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill();
  }
};

const exitWithCode = (code) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  desiredExitCode = typeof code === 'number' ? code : 0;
  stopElectron();
  stopVite();
};

const startElectron = (devServerUrl) => {
  electronProcess = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devServerUrl,
    },
  });

  electronProcess.on('close', (code) => {
    shuttingDown = true;
    desiredExitCode = typeof code === 'number' ? code : 0;
    stopVite();
  });

  electronProcess.on('error', (error) => {
    console.error('Failed to start Electron:', error);
    exitWithCode(1);
  });
};

const awaitDevServer = (rawUrl) => {
  if (resolved) {
    return;
  }

  resolved = true;
  const cleanUrl = stripAnsi(rawUrl).replace(/\s+$/, '').replace(/\/$/, '');

  let parsed;
  try {
    parsed = new URL(cleanUrl);
  } catch (error) {
    console.error('Failed to parse Vite dev server URL:', cleanUrl, error);
    exitWithCode(1);
    return;
  }

  const resource = `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol === 'https:' ? '443' : '80')}`;

  waitOn({
    resources: [resource],
    delay: 100,
    interval: 100,
    timeout: 60000,
    validateStatus: (status) => status >= 200 && status < 400,
  })
    .then(() => startElectron(parsed.origin))
    .catch((error) => {
      console.error('Vite dev server failed to start in time:', error);
      exitWithCode(1);
    });
};

vite.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);

  if (!resolved) {
    const match = text.match(/https?:\/\/[^\s]+/);
    if (match) {
      awaitDevServer(match[0]);
    }
  }
});

vite.stderr.on('data', (data) => {
  process.stderr.write(data);
});

vite.on('error', (error) => {
  console.error('Failed to start Vite:', error);
  exitWithCode(1);
});

vite.on('close', (code, signal) => {
  if (shuttingDown) {
    process.exit(desiredExitCode ?? (typeof code === 'number' ? code : 0));
    return;
  }

  const reason = signal ? `signal ${signal}` : `code ${code}`;
  console.error(`Vite process exited unexpectedly (${reason})`);
  stopElectron();
  process.exit(typeof code === 'number' ? code : 1);
});

const handleExit = (code = 0) => exitWithCode(code);

process.on('SIGINT', () => handleExit(0));
process.on('SIGTERM', () => handleExit(0));
