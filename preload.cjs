// preload.js
const { contextBridge, ipcRenderer } = require('electron');

console.log('✅ Preload iniciado - Electron v', process.versions.electron);

// Expõe APIs seguras para a interface Vue.js
contextBridge.exposeInMainWorld('electronAPI', {
  // Listener para o evento de iniciar gravação (implementação refinada)
  onStartRecording: (callback) => {
    const handleStartRecording = (event, data) => {
      // Chama o callback passando os dados da reunião detectada
      callback(data);
    };

    // Registra o listener para o canal especificado
    ipcRenderer.on('start-recording', handleStartRecording);

    // Retorna função de limpeza para remover o listener
    return () => {
      ipcRenderer.removeListener('start-recording', handleStartRecording);
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

  // Captura de áudio do sistema - MÉTODO EXATO DO NOTION (Loopback Audio)
  captureSystemAudio: async () => {
    try {
      console.log('🎵 Capturando áudio do sistema (método LOOPBACK como Notion)...');

      // MÉTODO EXATO DO NOTION: getDisplayMedia apenas com áudio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,  // Notion NÃO pede tela!
        audio: true    // Apenas áudio do sistema (loopback será fornecido pelo handler)
      });

      console.log('✅ Stream de áudio obtido via getDisplayMedia (método Notion)');
      console.log('🎵 Audio tracks:', stream.getAudioTracks().length);

      // Verificar se tem áudio
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log('🔊 Tracks de áudio detectados:');
        audioTracks.forEach((track, i) => {
          console.log(`  ${i + 1}. ${track.label} (tipo: ${track.kind})`);
        });

        return stream;
      } else {
        throw new Error('Nenhum áudio do sistema disponível - handler loopback pode não estar funcionando');
      }
    } catch (error) {
      console.error('❌ Erro na captura loopback:', error.message);
      throw error;
    }
  },

  // Desktop Capturer para captura de áudio do sistema (BACKUP)
  getDesktopCapturer: async (types = ['screen', 'window']) => {
    try {
      console.log('🔍 Obtendo fontes via IPC...');

      const sources = await ipcRenderer.invoke('get-desktop-sources', types);

      console.log(`✅ ${sources.length} fontes recebidas`);
      return sources;
    } catch (error) {
      console.error('❌ Erro ao obter fontes:', error.message);
      return [];
    }
  },

  // Verificar se desktop capturer está disponível (via IPC)
  hasDesktopCapture: async () => {
    try {
      const isAvailable = await ipcRenderer.invoke('has-desktop-capture');
      console.log('🔍 Desktop Capturer disponível:', isAvailable);
      return isAvailable;
    } catch (error) {
      console.error('❌ Erro ao verificar Desktop Capturer:', error.message);
      return false;
    }
  }
});

console.log('🚀 Preload concluído - APIs expostas');


