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
      if (!desktopCapturer) {
        throw new Error('desktopCapturer não disponível');
      }
      const sources = await desktopCapturer.getSources({
        types: types,
        thumbnailSize: { width: 150, height: 150 },
        fetchWindowIcons: false
      });
      return sources;
    } catch (error) {
      console.error('Erro ao obter fontes de captura:', error);
      return []; // Retorna array vazio em vez de throw para não quebrar o app
    }
  }
});

console.log('Script de pré-carregamento executado! API exposta:', Object.keys(window.electronAPI || {}));


