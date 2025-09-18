// preload.js
const { contextBridge, ipcRenderer, desktopCapturer } = require('electron');

// Expõe APIs seguras para a interface Vue.js
contextBridge.exposeInMainWorld('electronAPI', {
  // Listener para o evento de iniciar gravação (implementação refinada)
  onStartRecording: (callback) => {
    const handleStartRecording = (event, data) => {
      // Chama o callback passando os dados da reunião detectada
      callback(data);
    };
    
    // Registra o listener para o canal especificado
    ipcRenderer.on('start-recording-from-main', handleStartRecording);
    
    // Retorna função de limpeza para remover o listener
    return () => {
      ipcRenderer.removeListener('start-recording-from-main', handleStartRecording);
    };
  },

  // Obter versão da aplicação
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },

  // Mostrar notificação nativa
  showNotification: (title, body) => {
    return ipcRenderer.invoke('show-notification', { title, body });
  },

  // Abrir link externo
  openExternal: (url) => {
    return ipcRenderer.invoke('open-external', url);
  },

  // Verificar se é ambiente Electron
  isElectron: true,

  // Debug da detecção de reuniões
  getMeetingDebug: () => {
    return ipcRenderer.invoke('get-meeting-debug');
  },


  // Informações da plataforma
  platform: process.platform,

  // Injetar dados de reunião no localStorage
  injectMeetingData: (meetingData) => ipcRenderer.invoke('inject-meeting-data', meetingData),

  // Desktop Capturer para captura de áudio do sistema
  getDesktopCapturer: async (types = ['screen', 'window']) => {
    try {
      // Verifica se desktopCapturer está disponível
      if (typeof desktopCapturer === 'undefined' || !desktopCapturer) {
        console.warn('desktopCapturer não está disponível nesta versão do Electron');
        return [];
      }

      const sources = await desktopCapturer.getSources({
        types: types,
        thumbnailSize: { width: 150, height: 150 },
        fetchWindowIcons: false
      });

      console.log(`📺 ${sources.length} fontes de captura encontradas`);
      return sources;
    } catch (error) {
      console.warn('Desktop capture não disponível:', error.message);
      return []; // Retorna array vazio em vez de throw para não quebrar o app
    }
  },

  // Verificar se desktop capturer está disponível
  hasDesktopCapture: () => {
    return typeof desktopCapturer !== 'undefined' && !!desktopCapturer;
  }
});

console.log('Script de pré-carregamento executado! API exposta:', Object.keys(window.electronAPI || {}));


