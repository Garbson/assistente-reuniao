<template>
  <div class="mb-4">
    <button
      @click="testAllCaptureMethods"
      :disabled="isTesting"
      class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {{ isTesting ? 'Testando...' : '🔍 Testar Captura de Áudio' }}
    </button>

    <div v-if="testResults.length > 0" class="mt-4 space-y-2">
      <h4 class="text-sm font-medium text-gray-900">Resultados dos Testes:</h4>
      <div
        v-for="(result, index) in testResults"
        :key="index"
        :class="[
          'p-3 rounded-md text-sm',
          result.success
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        ]"
      >
        <div class="font-medium">{{ result.method }}</div>
        <div class="text-xs mt-1">{{ result.message }}</div>
        <div v-if="result.details" class="text-xs mt-1 opacity-75">
          {{ result.details }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const isTesting = ref(false);
const testResults = ref([]);

const testAllCaptureMethods = async () => {
  isTesting.value = true;
  testResults.value = [];

  // Teste 1: Desktop Capturer (Electron)
  await testDesktopCapturer();

  // Teste 2: getDisplayMedia híbrido
  await testDisplayMedia();

  // Teste 3: getUserMedia microfone
  await testMicrophone();

  // Teste 4: Verificar permissões
  await testPermissions();

  isTesting.value = false;
};

const testDesktopCapturer = async () => {
  try {
    if (window.electronAPI?.getDesktopCapturer) {
      const sources = await window.electronAPI.getDesktopCapturer(['screen', 'window']);

      if (sources && sources.length > 0) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sources[0].id
            }
          },
          video: false
        });

        const audioTracks = stream.getAudioTracks();
        stream.getTracks().forEach(track => track.stop());

        testResults.value.push({
          method: '🖥️ Desktop Capturer (Electron)',
          success: audioTracks.length > 0,
          message: audioTracks.length > 0
            ? `✅ Funcionou! ${audioTracks.length} track(s) de áudio`
            : '❌ Sem tracks de áudio',
          details: audioTracks.length > 0 ? `Label: ${audioTracks[0].label}` : null
        });
      } else {
        testResults.value.push({
          method: '🖥️ Desktop Capturer (Electron)',
          success: false,
          message: '❌ Nenhuma fonte de captura encontrada'
        });
      }
    } else {
      testResults.value.push({
        method: '🖥️ Desktop Capturer (Electron)',
        success: false,
        message: '❌ API não disponível'
      });
    }
  } catch (error) {
    testResults.value.push({
      method: '🖥️ Desktop Capturer (Electron)',
      success: false,
      message: `❌ Erro: ${error.message}`
    });
  }
};

const testDisplayMedia = async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const audioTracks = stream.getAudioTracks();
    const videoTracks = stream.getVideoTracks();

    stream.getTracks().forEach(track => track.stop());

    testResults.value.push({
      method: '🖥️ getDisplayMedia (Compartilhar Tela)',
      success: audioTracks.length > 0,
      message: audioTracks.length > 0
        ? `✅ Funcionou! Vídeo: ${videoTracks.length}, Áudio: ${audioTracks.length}`
        : `❌ Só vídeo (${videoTracks.length}), sem áudio`,
      details: audioTracks.length > 0 ? `Audio Label: ${audioTracks[0].label}` : null
    });
  } catch (error) {
    testResults.value.push({
      method: '🖥️ getDisplayMedia (Compartilhar Tela)',
      success: false,
      message: `❌ Erro: ${error.message}`
    });
  }
};

const testMicrophone = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const audioTracks = stream.getAudioTracks();
    stream.getTracks().forEach(track => track.stop());

    testResults.value.push({
      method: '🎤 getUserMedia (Microfone)',
      success: audioTracks.length > 0,
      message: audioTracks.length > 0
        ? `✅ Funcionou! ${audioTracks.length} track(s)`
        : '❌ Sem acesso ao microfone',
      details: audioTracks.length > 0 ? `Label: ${audioTracks[0].label}` : null
    });
  } catch (error) {
    testResults.value.push({
      method: '🎤 getUserMedia (Microfone)',
      success: false,
      message: `❌ Erro: ${error.message}`
    });
  }
};

const testPermissions = async () => {
  try {
    const micPermission = await navigator.permissions.query({ name: 'microphone' });

    testResults.value.push({
      method: '🔐 Permissões do Sistema',
      success: micPermission.state === 'granted',
      message: `Microfone: ${micPermission.state}`,
      details: `Estado: ${micPermission.state} (granted/denied/prompt)`
    });
  } catch (error) {
    testResults.value.push({
      method: '🔐 Permissões do Sistema',
      success: false,
      message: `❌ Erro ao verificar: ${error.message}`
    });
  }
};
</script>