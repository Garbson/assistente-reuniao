// Importa os módulos necessários do Electron
const { app, BrowserWindow, ipcMain, Notification, shell, session } = require('electron');
const { exec } = require('child_process');
const path = require('path');
// Importação resiliente do active-win (ESM default export)
let activeWinModule = null;
let activeWindowFunction = null;

async function initActiveWin() {
  try {
    activeWinModule = await import('active-win');
    activeWindowFunction = activeWinModule.activeWindow;
    console.log('✅ active-win carregado com sucesso');
  } catch (e) {
    console.warn('❌ active-win não pôde ser carregado:', e.message);
  }
}

function getActiveWinFunction() {
  return activeWindowFunction;
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
// Novos controles para reduzir falsos positivos
const STABLE_THRESHOLD_MS = 10000; // 10 segundos para ter certeza
let candidateTitle = null;
let candidateSince = 0;
const notifiedTitles = new Set();

// Configurações de monitoramento de reuniões REFINADAS
const MEETING_DETECTION_INTERVAL = 7000; // 7 segundos conforme especificação

// Mapa para rastrear notificações já enviadas
const notifiedMeetings = new Map();

// Função refinada para detectar reuniões com lógica específica por aplicativo
function detectMeetingFromWindow(activeWindow) {
  if (!activeWindow || !activeWindow.title || activeWindow.title.trim() === '') {
    return { isMeeting: false, reason: 'Janela inválida ou sem título' };
  }

  // Verifica se owner existe e tem name, senão usa string vazia
  const ownerName = activeWindow.owner?.name || activeWindow.owner?.processName || '';
  const processName = ownerName.toLowerCase();
  const windowTitle = activeWindow.title.toLowerCase();
  
  // Não logga se não há processo definido para evitar spam
  if (processName && process.env.NODE_ENV === 'development') {
    console.log(`🔍 Analisando: Processo="${processName}" Título="${windowTitle.substring(0, 50)}..."`);
  }
  
  // Se não há processo identificado, tenta identificar pelo título
  if (!processName) {
    // Tentativa de identificar pelo título se não temos processo
    if (windowTitle.includes('microsoft teams') || windowTitle.includes('teams -')) {
      if (windowTitle.includes('reunião') || windowTitle.includes('chamada') || 
          windowTitle.includes('meeting') || windowTitle.includes('call')) {
        return { 
          isMeeting: true, 
          app: 'Teams (by title)',
          reason: `Teams meeting detected by title: ${activeWindow.title}` 
        };
      }
    }
    return { isMeeting: false, reason: 'Processo não identificado e título não corresponde' };
  }
  
  // 1. Verificação Microsoft Teams - Melhorada para diferentes padrões
  if (processName.includes('teams') || processName === 'ms-teams.exe') {
    console.log('🔍 TEAMS DEBUG:', {
      titulo: windowTitle,
      temSala: windowTitle.includes('sala '),
      temPipe: windowTitle.includes(' | '),
      regexMatch: /^.+ - .+ \| .+/.test(windowTitle),
      naoETeamsApp: !windowTitle.includes('microsoft teams')
    });
    
    // Padrões específicos do Teams
    const isTeamsMeeting = 
      // Padrões tradicionais
      windowTitle.includes('| reunião') || 
      windowTitle.includes('| chamada') ||
      windowTitle.includes('| meeting') ||
      windowTitle.includes('| call') ||
      // Padrão de reunião com nome da sala/empresa (como seu caso)
      (windowTitle.includes('sala ') && windowTitle.includes(' | ')) ||
      (windowTitle.includes('room ') && windowTitle.includes(' | ')) ||
      // Qualquer título com estrutura "Nome - Algo | Organização"
      (/^.+ - .+ \| .+/.test(windowTitle) && !windowTitle.includes('microsoft teams'));
      
    if (isTeamsMeeting) {
      return { 
        isMeeting: true, 
        app: 'Teams',
        reason: `Teams meeting detected: ${activeWindow.title}` 
      };
    }
  }
  
  // 2. Verificação Zoom
  if (processName.includes('zoom')) {
    if (windowTitle.includes('zoom meeting') || 
        windowTitle.includes('reunião zoom') ||
        windowTitle.includes('zoom webinar')) {
      return { 
        isMeeting: true, 
        app: 'Zoom',
        reason: `Zoom meeting detected: ${activeWindow.title}` 
      };
    }
  }
  
  // 3. Verificação Google Meet (Navegador) - Melhorada
  const browserProcesses = ['chrome.exe', 'msedge.exe', 'firefox.exe', 'safari', 'opera.exe'];
  const isBrowser = browserProcesses.some(browser => processName.includes(browser.toLowerCase()));
  
  if (isBrowser) {
    // Padrões específicos do Google Meet
    if (windowTitle.includes('meet.google.com') || 
        windowTitle.startsWith('meet: ') ||
        (windowTitle.includes('meet:') && windowTitle.includes('google chrome'))) {
      return { 
        isMeeting: true, 
        app: 'Google Meet',
        reason: `Google Meet detected: ${activeWindow.title}` 
      };
    }
    
    // 4. Verificações para Teams/Zoom web (após Google Meet)
    if (windowTitle.includes('teams.microsoft.com') && 
        (windowTitle.includes('call') || windowTitle.includes('meeting'))) {
      return { 
        isMeeting: true, 
        app: 'Teams Web',
        reason: `Teams Web meeting detected: ${activeWindow.title}` 
      };
    }
    
    if (windowTitle.includes('zoom.us') && windowTitle.includes('meeting')) {
      return { 
        isMeeting: true, 
        app: 'Zoom Web',
        reason: `Zoom Web meeting detected: ${activeWindow.title}` 
      };
    }
  }
  
  return { isMeeting: false, reason: 'Não corresponde aos padrões de reunião' };
}

// Estados de detecção melhorados
let isInMeeting = false;
let teamsPresenceStatus = 'unknown'; // Available, Busy, DoNotDisturb, etc.

// Função para detectar status do Teams via processos Windows
async function detectTeamsPresence() {
  return new Promise((resolve) => {
    // Verifica se Teams (novo) está rodando
    exec('tasklist /fi "imagename eq ms-teams.exe" /fo csv | findstr "ms-teams.exe"', (err, stdout) => {
      if (err || !stdout.trim()) {
        // Teams novo não encontrado, verifica Teams clássico
        exec('tasklist /fi "imagename eq teams.exe" /fo csv | findstr "teams.exe"', (err2, stdout2) => {
          if (err2 || !stdout2.trim()) {
            resolve({ running: false, status: 'unknown' });
            return;
          }
          // Teams clássico encontrado
          resolve({ running: true, status: 'available', type: 'classic' });
        });
        return;
      }
      
      // Teams novo encontrado, assume disponível por padrão
      // Em versões futuras podemos implementar detecção mais sofisticada
      resolve({ running: true, status: 'available', type: 'new' });
    });
  });
}

// Função para verificar se aplicativos de reunião estão ativos
async function isMeetingAppActive() {
  return new Promise((resolve) => {
    exec('tasklist /fi "imagename eq teams.exe" && tasklist /fi "imagename eq ms-teams.exe" && tasklist /fi "imagename eq zoom.exe"', 
    { timeout: 3000 }, (err, stdout) => {
      if (err) {
        resolve(false);
        return;
      }
      const hasActiveApps = stdout.includes('teams.exe') || 
                           stdout.includes('ms-teams.exe') || 
                           stdout.includes('zoom.exe');
      resolve(hasActiveApps);
    });
  });
}

// Função para obter a janela ativa do sistema (simulada)
async function getActiveWindow() {
  const fn = getActiveWinFunction();
  if (fn) {
    try {
      const info = await fn();
      
      // Log para debug apenas quando há dados relevantes
      if (info && info.title && info.owner && process.env.NODE_ENV === 'development') {
        console.log('🔍 Active-win info:', JSON.stringify({
          title: info.title.substring(0, 50) + '...',
          owner: info.owner,
          platform: process.platform
        }, null, 2));
      }
      
      if (info && info.title) {
        // Retorna todas as informações disponíveis
        return {
          title: info.title,
          owner: info.owner || { name: '', processName: '', pid: null },
          bounds: info.bounds || {},
          memoryUsage: info.memoryUsage || 0
        };
      }
    } catch (e) {
      // Evita flood de logs: 1 a cada 10s
      if (Date.now() - lastActiveWinErrorAt > 10000) {
        console.warn('Falha active-win (desativando temporariamente):', e.message);
        lastActiveWinErrorAt = Date.now();
      }
      return { title: '', owner: { name: '', processName: '', pid: null } };
    }
  }
  return { title: '', owner: { name: '', processName: '', pid: null } }; // sem detecção real disponível
}

// Função para verificar se uma janela é de reunião (melhorada)
function isMeetingWindow(windowTitle, processName = '', url = '') {
  const title = windowTitle.toLowerCase();
  const process = processName.toLowerCase();
  const urlLower = url.toLowerCase();
  
  // Padrões mais específicos para evitar falsos positivos
  const meetingPatterns = [
    /google meet/i,
    /microsoft teams.*meeting/i,
    /zoom meeting/i,
    /meet\.google\.com/i,
    /teams\.microsoft\.com.*call/i,
    /zoom\.us.*meeting/i,
    /reunião.*teams/i,
    /^teams.*reunião/i,
    /^meet -/i,
    /^zoom -/i
  ];
  
  // Verifica se o título corresponde a padrões específicos de reunião
  const matchesPattern = meetingPatterns.some(pattern => pattern.test(title));
  
  // Verifica URLs de reunião específicas
  const meetingUrlPatterns = [
    'meet.google.com/lookup/',
    'meet.google.com/xxx-',
    'teams.microsoft.com/l/meetup-join/',
    'zoom.us/j/',
    'us02web.zoom.us/j/'
  ];
  
  const hasMeetingUrl = meetingUrlPatterns.some(pattern =>
    urlLower.includes(pattern)
  );
  
  // Só considera reunião se houver padrão específico OU URL de reunião
  return matchesPattern || hasMeetingUrl;
}

// Função para monitorar janelas ativas
// Função principal de monitoramento refinada
async function monitorActiveWindows() {
  try {
    const activeWindow = await getActiveWindow();
    
    if (!activeWindow || !activeWindow.title || activeWindow.title.trim() === '') {
      // Se não há janela ou título, não logga para evitar spam
      return;
    }
    
    const detection = detectMeetingFromWindow(activeWindow);
    
    // Log mais informativo apenas quando há dados relevantes
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔍 Monitorando: ${detection.isMeeting ? '✅' : '❌'} "${activeWindow.owner?.name || 'unknown'}" - "${activeWindow.title.substring(0, 50)}..."`);
    }
    
    if (detection.isMeeting) {
      // Gera uma chave única para esta reunião
      const meetingKey = `${activeWindow.owner?.name || 'unknown'}-${activeWindow.title}`;
      
      // Verifica se já notificamos esta reunião
      if (!notifiedMeetings.has(meetingKey)) {
        console.log('🎯 REUNIÃO DETECTADA!');
        console.log('📱 App:', detection.app);
        console.log('📋 Título:', activeWindow.title);
        console.log('💡 Razão:', detection.reason);
        console.log('🔑 Chave:', meetingKey);
        
        // Registra que notificamos esta reunião
        notifiedMeetings.set(meetingKey, {
          timestamp: Date.now(),
          app: detection.app,
          title: activeWindow.title
        });
        
        // Exibe notificação do sistema
        showMeetingNotificationRefined(detection.app, activeWindow.title);
        
        // Limpa notificações antigas (mais de 30 minutos)
        cleanOldNotifications();
      } else {
        console.log('🔄 Reunião já notificada:', detection.app);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro no monitoramento:', error.message);
  }
}

// Função para limpar notificações antigas
function cleanOldNotifications() {
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  
  for (const [key, data] of notifiedMeetings.entries()) {
    if (data.timestamp < thirtyMinutesAgo) {
      notifiedMeetings.delete(key);
    }
  }
}

// Função de notificação refinada conforme especificação
function showMeetingNotificationRefined(app, windowTitle) {
  if (!Notification.isSupported()) {
    console.log('⚠️ Notificações não são suportadas neste sistema');
    return;
  }

  const notification = new Notification({
    title: 'Reunião Detectada!',
    body: `${app} - Clique para iniciar a gravação`,
    icon: path.join(__dirname, 'public/favicon.ico'),
    actions: [
      {
        type: 'button',
        text: '▶️ Iniciar Gravação'
      }
    ],
    timeoutType: 'never', // Não remove automaticamente
  });

  // Evento quando a notificação é clicada
  notification.on('click', () => {
    console.log('🎬 Usuário clicou para iniciar gravação');
    
    // Foca a janela principal
    if (mainWindow) {
      mainWindow.focus();
      mainWindow.show();
    }
    
    // Envia evento IPC para a interface
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('start-recording-from-main', {
        app,
        title: windowTitle,
        timestamp: new Date().toISOString()
      });
    }
    
    notification.close();
  });

  // Evento quando o botão de ação é clicado
  notification.on('action', (index) => {
    if (index === 0) { // Botão "Iniciar Gravação"
      console.log('🎬 Usuário clicou no botão de iniciar gravação');
      
      // Foca a janela principal
      if (mainWindow) {
        mainWindow.focus();
        mainWindow.show();
      }
      
      // Envia evento IPC para a interface
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('start-recording-from-main', {
          app,
          title: windowTitle,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    notification.close();
  });

  notification.show();
  
  console.log(`📢 Notificação exibida para: ${app}`);
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
    console.log('Iniciando monitoramento de reuniões (detecção real)...');
    meetingMonitorInterval = setInterval(monitorActiveWindows, MEETING_DETECTION_INTERVAL); // 7 segundos conforme especificação
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

// Handler para debug da detecção de reuniões (atualizado)
ipcMain.handle('get-meeting-debug', async () => {
  try {
    const activeWindow = await getActiveWindow();
    
    let debugInfo = {
      activeWindow: {
        title: activeWindow?.title || 'Nenhuma',
        owner: activeWindow?.owner?.name || activeWindow?.owner?.processName || 'unknown',
        pid: activeWindow?.owner?.pid || 'unknown',
        bounds: activeWindow?.bounds || 'unknown'
      },
      notifiedMeetings: Array.from(notifiedMeetings.keys()),
      totalNotifications: notifiedMeetings.size,
      monitoringActive: !!meetingMonitorInterval
    };
    
    if (activeWindow) {
      const detection = detectMeetingFromWindow(activeWindow);
      debugInfo.detection = detection;
    }
    
    return debugInfo;
  } catch (error) {
    return { error: error.message };
  }
});

// Este método será chamado quando o Electron tiver finalizado
// a inicialização e estiver pronto para criar janelas do navegador.
app.whenReady().then(async () => {
  // Inicializa active-win primeiro
  await initActiveWin();
  
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
