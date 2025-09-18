// Importa os módulos necessários do Electron
const { app, BrowserWindow, ipcMain, Notification, shell, session } = require('electron');
const { exec } = require('child_process');
const path = require('path');

// Importação resiliente do active-win (ESM default export)
let activeWinModule = null;
try {
  activeWinModule = require('active-win');
} catch (e) {
  console.warn('active-win não instalado ou falhou ao carregar.');
}

function getActiveWinFunction() {
  if (!activeWinModule) return null;
  const fn = (typeof activeWinModule === 'function') ? activeWinModule : activeWinModule.default;
  return (typeof fn === 'function') ? fn : null;
}

let lastActiveWinErrorAt = 0;

// Ajustes de linha de comando ANTES do app.whenReady para habilitar recursos necessários ao reconhecimento de voz
try {
  // Permitir tratar o servidor Vite (http://localhost:5173) como seguro para APIs que exigem contexto seguro
  if (process.env.VITE_DEV_SERVER_URL) {
    app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', process.env.VITE_DEV_SERVER_URL);
    app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
  }
  // Em algumas plataformas ajuda a inicializar suporte a voz
  app.commandLine.appendSwitch('enable-speech-dispatcher');
} catch (e) {
  console.warn('Não foi possível aplicar switches de linha de comando:', e);
}

let mainWindow = null;
let meetingMonitorInterval = null;
let overlayWindow = null;
let lastReminderAt = 0;
let lastMeetingTitle = '';

// Configurações de monitoramento de reuniões APRIMORADAS
const MEETING_KEYWORDS = [
  'Google Meet', 'Microsoft Teams', 'Zoom Meeting', 'Zoom', 'Teams',
  'Meet', 'Skype', 'Discord', 'Webex', 'GoToMeeting', 'Reunião'
];

const MEETING_URLS = [
  'meet.google.com', 'teams.microsoft.com', 'zoom.us', 'us02web.zoom.us',
  'teams.live.com', 'discord.com', 'webex.com', 'gotomeeting.com'
];

const MEETING_PROCESSES = [
  'teams.exe', 'zoom.exe', 'skype.exe', 'discord.exe', 'chrome.exe', 'msedge.exe'
];

// Estados de detecção melhorados
let isInMeeting = false;
let teamsPresenceStatus = 'unknown'; // Available, Busy, DoNotDisturb, etc.

// Novos controles para reduzir falsos positivos
const STABLE_THRESHOLD_MS = 6000; // tempo que a janela precisa ficar ativa
let candidateTitle = null;
let candidateSince = 0;
const notifiedTitles = new Set();

// Função NOVA: Detectar status do Teams via processo/registry
async function detectTeamsPresence() {
  return new Promise((resolve) => {
    // Verifica se Teams está em modo ocupado/em reunião via processo Windows
    exec('tasklist /fi "imagename eq ms-teams.exe" /fo csv | findstr "ms-teams.exe"', (err, stdout) => {
      if (err || !stdout.trim()) {
        // Teams não está rodando, verifica Teams clássico
        exec('tasklist /fi "imagename eq teams.exe" /fo csv | findstr "teams.exe"', (err2, stdout2) => {
          if (err2 || !stdout2.trim()) {
            resolve({ running: false, status: 'unknown' });
            return;
          }
          // Teams clássico encontrado, assume disponível
          resolve({ running: true, status: 'available', type: 'classic' });
        });
        return;
      }
      
      // Teams novo encontrado, verifica registry para status (simplificado)
      exec('reg query "HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Office\\Teams" /v PresenceState 2>nul', (regErr, regOut) => {
        let status = 'available';
        if (!regErr && regOut) {
          if (regOut.includes('Busy') || regOut.includes('DoNotDisturb')) {
            status = 'busy';
          } else if (regOut.includes('InACall') || regOut.includes('InAMeeting')) {
            status = 'in_meeting';
          }
        }
        resolve({ running: true, status, type: 'new' });
      });
    });
  });
}

// Função NOVA: Verificar microfone em uso (indica reunião ativa)
async function isMicrophoneInUse() {
  return new Promise((resolve) => {
    // Windows: verifica processos usando áudio
    exec('powershell "Get-Counter \\"\\\\Process(*)\\\\% Processor Time\\" | Select-Object -ExpandProperty CounterSamples | Where-Object {$_.InstanceName -match \\"teams|zoom|chrome|msedge\\"} | Select-Object InstanceName"', 
    { timeout: 3000 }, (err, stdout) => {
      if (err) {
        resolve(false);
        return;
      }
      // Se encontrar processos de reunião ativos, provável que mic esteja em uso
      const hasActiveProcesses = stdout.includes('teams') || stdout.includes('zoom') || 
                                stdout.includes('chrome') || stdout.includes('msedge');
      resolve(hasActiveProcesses);
    });
  });
}

// Obter janela ativa real (fallback para simulado se falhar)
async function getActiveWindow() {
  const fn = getActiveWinFunction();
  if (fn) {
    try {
      const info = await fn();
      if (info && info.title) return { title: info.title, processName: info.owner?.name || '' };
    } catch (e) {
      // Evita flood de logs: 1 a cada 10s
      if (Date.now() - lastActiveWinErrorAt > 10000) {
        console.warn('Falha active-win (desativando temporariamente):', e.message);
        lastActiveWinErrorAt = Date.now();
      }
      return { title: '', processName: '' };
    }
  }
  return { title: '', processName: '' }; // sem detecção real disponível
}

// Função para verificar se uma janela é de reunião (melhorada)
function isMeetingWindow(windowTitle, processName = '', url = '') {
  const title = windowTitle.toLowerCase();
  const process = processName.toLowerCase();
  const urlLower = url.toLowerCase();
  
  // Verifica keywords no título
  const hasKeyword = MEETING_KEYWORDS.some(keyword =>
    title.includes(keyword.toLowerCase())
  );
  
  // Verifica URLs de reunião
  const hasMeetingUrl = MEETING_URLs.some(meetingUrl =>
    urlLower.includes(meetingUrl)
  );
  
  // Verifica processos específicos + contexto
  const isMeetingProcess = MEETING_PROCESSES.includes(process) && 
    (hasKeyword || hasMeetingUrl || 
     title.includes('reunião') || title.includes('meeting') || 
     title.includes('chamada') || title.includes('call'));
  
  return hasKeyword || hasMeetingUrl || isMeetingProcess;
}

// Função para monitorar janelas ativas (APRIMORADA)
async function monitorActiveWindows() {
  try {
    // 1. Verifica status do Teams primeiro
    const teamsStatus = await detectTeamsPresence();
    teamsPresenceStatus = teamsStatus.status;
    
    // Se Teams indica reunião ativa, dispara imediatamente
    if (teamsStatus.status === 'in_meeting' || teamsStatus.status === 'busy') {
      const meetingTitle = 'Microsoft Teams - Reunião em andamento';
      if (!isInMeeting) {
        console.log('Reunião detectada via Teams presence:', teamsStatus);
        showMeetingNotification(meetingTitle);
        isInMeeting = true;
      }
      return;
    }
    
    // 2. Verifica janela ativa
    const activeWindow = await getActiveWindow();
    const title = (activeWindow && activeWindow.title) ? activeWindow.title.trim() : '';
    const processName = activeWindow.processName || '';
    
    if (!title) {
      isInMeeting = false;
      return; // nada a avaliar
    }

    // Atualiza candidato se título mudou
    if (title !== candidateTitle) {
      candidateTitle = title;
      candidateSince = Date.now();
      return; // aguarda estabilizar
    }

    // Verifica estabilidade
    const stableFor = Date.now() - candidateSince;
    if (stableFor < STABLE_THRESHOLD_MS) return; // ainda não estável

    // Verifica se parece reunião
    if (isMeetingWindow(title, processName)) {
      if (!notifiedTitles.has(title) && !isInMeeting) {
        console.log('Reunião detectada (janela estável):', title);
        showMeetingNotification(title);
        notifiedTitles.add(title);
        isInMeeting = true;
      }
    } else {
      // Se não é mais reunião, resetar estado
      if (isInMeeting && !teamsStatus.running) {
        isInMeeting = false;
      }
    }
  } catch (error) {
    console.error('Erro ao monitorar janelas:', error);
  }
}

// Função para exibir notificação de reunião
function showMeetingNotification(windowTitle) {
  // Verifica se já não há uma notificação sendo exibida
  if (!Notification.isSupported()) {
    console.log('Notificações não são suportadas neste sistema');
    return;
  }

  const notification = new Notification({
    title: 'Assistente de Reuniões IA',
    body: 'Reunião detectada! Deseja iniciar a gravação?',
    icon: path.join(__dirname, 'public/favicon.ico'),
    actions: [
      {
        type: 'button',
        text: 'Iniciar Gravaçãoooo'
      },
      {
        type: 'button',
        text: 'Ignorar'
      }
    ],
    urgency: 'normal',
    timeoutType: 'default'
  });

  notification.on('action', (event, index) => {
    if (index === 0) { // Iniciar Gravação
      // Envia comando para a interface Vue.js
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('start-recording');
        mainWindow.focus(); // Traz a janela para frente
      }
    }
    notification.close();
  });

  notification.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
    notification.close();
  });

  notification.show();
  showOverlayReminder(windowTitle);
}

function showOverlayReminder(meetingTitle) {
  const now = Date.now();
  if (now - lastReminderAt < 120000 && meetingTitle === lastMeetingTitle) return; // máx 1 a cada 2min mesmo título
  lastReminderAt = now;
  lastMeetingTitle = meetingTitle;

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }

  overlayWindow = new BrowserWindow({
    width: 360,
    height: 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: false,
    hasShadow: false,
    webPreferences: { contextIsolation: true }
  });

  const safeTitle = meetingTitle.replace(/"/g,'&quot;').slice(0,80);
  const html = `<!DOCTYPE html><html><head><meta charset='utf-8'>
  <style>
  body{margin:0;font-family:system-ui,Arial} .card{backdrop-filter:blur(8px);background:rgba(15,23,42,.82);color:#fff;padding:16px 18px;border-radius:18px;width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;font-size:14px}
  h1{margin:0 0 4px;font-size:16px;font-weight:600} p{margin:0 0 10px;line-height:1.35;opacity:.85;font-size:12px}
  .tag{display:inline-block;background:#f59e0b;color:#1e293b;font-size:11px;font-weight:600;padding:3px 10px;border-radius:999px;margin-bottom:8px;letter-spacing:.3px}
  button{cursor:pointer;border:none;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;transition:.2s}
  button.primary{background:#2563eb;color:#fff;} button.primary:hover{background:#1d4ed8}
  button.sec{background:rgba(255,255,255,.15);color:#fff;} button.sec:hover{background:rgba(255,255,255,.25)}
  .row{display:flex;gap:8px}
  </style></head><body>
   <div class='card'>
     <div>
       <div class='tag'>Reunião Detectada</div>
       <h1>Gravar agora?</h1>
       <p>${safeTitle}</p>
     </div>
     <div class='row'>
       <button class='primary' onclick="parent.postMessage('start-rec','*')">Gravar</button>
       <button class='sec' onclick="window.close()">Fechar</button>
     </div>
   </div>
   <script>window.addEventListener('message',e=>{ if(e.data==='start-rec'){ /* placeholder */ }});</script>
  </body></html>`;
  overlayWindow.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));

  // Fecha automático após 25s
  setTimeout(()=>{ if(overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close(); },25000);

  // Canal para clicar em Gravar: escuta eventos de console (hack simples) via polling
  // Alternativamente poderíamos usar ipc da preload se empacotássemos arquivo.
  overlayWindow.webContents.executeJavaScript(`
    window.addEventListener('message', (e)=>{
      if(e.data==='start-rec'){
        require('electron').ipcRenderer.send('overlay-start-recording');
      }
    });
    document.querySelector('button.primary').addEventListener('click',()=>{
      require('electron').ipcRenderer.send('overlay-start-recording');
    });
  `).catch(()=>{});
}

ipcMain.on('overlay-start-recording', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('start-recording');
    mainWindow.focus();
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close();
});

// Função para iniciar o monitoramento
function startMeetingMonitoring() {
  if (!meetingMonitorInterval) {
    console.log('Iniciando monitoramento INTELIGENTE de reuniões...');
    meetingMonitorInterval = setInterval(monitorActiveWindows, 3000); // um pouco mais responsivo
  }
}

// Função para parar o monitoramento
function stopMeetingMonitoring() {
  if (meetingMonitorInterval) {
    console.log('Parando monitoramento de reuniões...');
    clearInterval(meetingMonitorInterval);
    meetingMonitorInterval = null;
  }
}

// Função para criar a janela principal do aplicativo
function createWindow() {
  // Cria uma nova janela do navegador.
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      // O script de pré-carregamento contém código que é executado antes da sua página web
      // ser carregada na janela. Ele tem acesso tanto às APIs do DOM quanto às do Node.js.
      preload: path.join(__dirname, 'preload.cjs'),
      // É recomendado manter a integração com o Node.js desativada por segurança
      // e usar o preload.js para expor funcionalidades específicas.
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'public/favicon.ico'),
    titleBarStyle: 'default',
    show: false, // Não mostra a janela imediatamente
  });

  // Carrega a URL do servidor de desenvolvimento do Vite (para desenvolvimento)
  // ou o arquivo index.html (para produção).
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Abre as Ferramentas de Desenvolvedor automaticamente no modo de desenvolvimento.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Mostra a janela quando estiver pronta
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    startMeetingMonitoring(); // Inicia o monitoramento quando a janela estiver pronta
  });

  // Eventos da janela
  mainWindow.on('closed', () => {
    mainWindow = null;
    stopMeetingMonitoring();
  });

  mainWindow.on('minimize', () => {
    // Continua monitoramento mesmo quando minimizada
  });

  mainWindow.on('focus', () => {
    // Janela ganhou foco
  });
}

// Manipuladores IPC
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, 'public/favicon.ico')
    });
    notification.show();
    return true;
  }
  return false;
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});


// Handler para debug de reuniões (corrige o erro no Sidebar)
ipcMain.handle('get-meeting-debug', () => {
  return {
    detectionActive: !!meetingMonitorInterval,
    lastMeetingTitle: lastMeetingTitle || 'Nenhuma',
    teamsStatus: teamsPresenceStatus || 'unknown',
    monitoringInterval: meetingMonitorInterval ? 3000 : 0,
    isInMeeting: isInMeeting || false
  };
});

// Handler para injetar dados de reunião diretamente no localStorage
ipcMain.handle('inject-meeting-data', async (event, meetingData) => {
  try {
    // Envia comando para a página principal executar a injeção
    mainWindow.webContents.executeJavaScript(`
      try {
        // Pega as reuniões existentes
        const existingMeetings = JSON.parse(localStorage.getItem("assistente-reunioes-history") || "[]");
        
        // Adiciona a nova reunião no início da lista
        existingMeetings.unshift(${JSON.stringify(meetingData)});
        
        // Salva de volta no localStorage
        localStorage.setItem("assistente-reunioes-history", JSON.stringify(existingMeetings));
        
        console.log("✅ Reunião adicionada com sucesso!");
        console.log("Total de reuniões:", existingMeetings.length);
        
        // Retorna sucesso
        true;
      } catch (error) {
        console.error("❌ Erro ao adicionar reunião:", error);
        false;
      }
    `);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Erro ao injetar dados:', error);
    return { success: false, error: error.message };
  }
});


// Este método será chamado quando o Electron tiver finalizado
// a inicialização e estiver pronto para criar janelas do navegador.
app.whenReady().then(() => {
  // Tratamento de permissões (microfone / câmera)
  try {
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((wc, permission, callback) => {
      if (permission === 'media') {
        console.log('[Permissões] Aprovando acesso a mídia (microfone/câmera)');
        return callback(true);
      }
      callback(false);
    });

    // Política de segurança básica para evitar bloqueios de mixed content
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = details.responseHeaders || {};
      // Permitir uso interno (sem CSP estrito que possa bloquear APIs)
      callback({ responseHeaders: headers });
    });
  } catch (e) {
    console.warn('Falha ao configurar permission handler:', e);
  }

  createWindow();

  // Garante que o aplicativo seja reativado no macOS.
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Encerra o aplicativo quando todas as janelas forem fechadas, exceto no macOS.
app.on('window-all-closed', function () {
  stopMeetingMonitoring();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Limpeza antes de encerrar
app.on('before-quit', () => {
  stopMeetingMonitoring();
});
