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
  console.log('🧪 Iniciando testes de captura (SEGURO)...');

  isTesting.value = true;
  testResults.value = [];

  try {
    // Teste 1: Desktop Capturer (Electron) - COM TIMEOUT
    await safeTest('Desktop Capturer', testDesktopCapturer);

    // Teste 2: getUserMedia microfone - SIMPLIFICADO
    await safeTest('Microfone', testMicrophone);

    // Teste 3: Verificar permissões
    await safeTest('Permissões', testPermissions);

    // REMOVIDO: getDisplayMedia porque pode causar crashes

  } catch (globalError) {
    console.error('❌ Erro global nos testes:', globalError);
    testResults.value.push({
      method: '❌ Erro Global',
      success: false,
      message: `Teste interrompido: ${globalError.message}`
    });
  } finally {
    isTesting.value = false;
  }
};

// Função wrapper para executar testes com timeout e proteção
const safeTest = async (testName, testFunction) => {
  try {
    console.log(`🧪 Testando ${testName}...`);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout em ${testName}`)), 10000);
    });

    await Promise.race([testFunction(), timeoutPromise]);

  } catch (error) {
    console.warn(`⚠️ ${testName} falhou:`, error.message);
    testResults.value.push({
      method: `❌ ${testName}`,
      success: false,
      message: `Erro: ${error.message}`
    });
  }
};

const testDesktopCapturer = async () => {
  console.log('🧪 SKIP: Desktop Capturer temporariamente desabilitado para evitar crashes');

  testResults.value.push({
    method: '🖥️ Desktop Capturer (TEMPORARIAMENTE DESABILITADO)',
    success: false,
    message: '⚠️ Desabilitado temporariamente - usando getDisplayMedia'
  });
  return;

  try {
    // Timeout específico para Desktop Capturer
    const sourcesPromise = window.electronAPI.getDesktopCapturer(['screen', 'window']);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout ao buscar fontes')), 5000);
    });

    const sources = await Promise.race([sourcesPromise, timeoutPromise]);

    if (!sources || sources.length === 0) {
      testResults.value.push({
        method: '🖥️ Desktop Capturer (Electron)',
        success: false,
        message: '❌ Nenhuma fonte de captura encontrada'
      });
      return;
    }

    console.log(`🧪 ${sources.length} fontes encontradas, testando primeira...`);

    // TESTE SUPER SEGURO: Tenta apenas a primeira fonte com proteções extremas
    console.log(`🧪 ${sources.length} fontes encontradas, testando primeira com proteções...`);

    try {
      // Proteção extrema: timeout muito curto e validação rápida
      const capturePromise = navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sources[0].id
          }
        },
        video: false
      });

      const testTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout teste (1.5s)')), 1500);
      });

      console.log('⏱️ Teste com timeout ultra-curto (1.5s)...');
      const stream = await Promise.race([capturePromise, testTimeout]);

      // Validação imediata e cleanup
      const audioTracks = stream.getAudioTracks();
      const hasAudio = audioTracks.length > 0;

      console.log(`🔍 Resultado: ${hasAudio ? 'COM áudio' : 'SEM áudio'}`);

      // Cleanup super rápido
      stream.getTracks().forEach(track => {
        if (track.readyState !== 'ended') {
          track.stop();
        }
      });

      testResults.value.push({
        method: '🖥️ Desktop Capturer (Electron)',
        success: hasAudio,
        message: hasAudio
          ? `✅ Funcionou! ${audioTracks.length} track(s) de áudio`
          : '⚠️ Fonte sem áudio (apenas vídeo)',
        details: hasAudio ? `Fonte: ${sources[0].name}` : `Testada: ${sources[0].name}`
      });

    } catch (testError) {
      console.warn('⚠️ Teste rápido falhou:', testError.message);

      // Se teste rápido falhar, mostra info das fontes
      const sourceNames = sources.slice(0, 3).map(s => s.name).join(', ');
      testResults.value.push({
        method: '🖥️ Desktop Capturer (Electron)',
        success: false,
        message: `⚠️ Teste falhou: ${testError.message}`,
        details: `${sources.length} fontes: ${sourceNames}${sources.length > 3 ? '...' : ''}`
      });
    }

  } catch (error) {
    console.warn('⚠️ Desktop Capturer falhou:', error.message);
    testResults.value.push({
      method: '🖥️ Desktop Capturer (Electron)',
      success: false,
      message: `❌ Erro: ${error.message}`
    });
  }
};

// REMOVIDO: testDisplayMedia porque pode causar crashes no Electron

const testMicrophone = async () => {
  console.log('🧪 Testando microfone...');

  try {
    // Teste SIMPLES do microfone com timeout
    const streamPromise = navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout no microfone')), 5000);
    });

    const stream = await Promise.race([streamPromise, timeoutPromise]);

    // Verificação RÁPIDA
    const audioTracks = stream.getAudioTracks();
    const hasAudio = audioTracks.length > 0;

    // Cleanup imediato
    stream.getTracks().forEach(track => {
      if (track.readyState !== 'ended') {
        track.stop();
      }
    });

    testResults.value.push({
      method: '🎤 getUserMedia (Microfone)',
      success: hasAudio,
      message: hasAudio
        ? `✅ Funcionou! ${audioTracks.length} track(s)`
        : '❌ Sem acesso ao microfone',
      details: hasAudio ? `Device: ${audioTracks[0].label || 'Microfone padrão'}` : null
    });

  } catch (error) {
    console.warn('⚠️ Microfone falhou:', error.message);
    testResults.value.push({
      method: '🎤 getUserMedia (Microfone)',
      success: false,
      message: `❌ Erro: ${error.message}`
    });
  }
};

const testPermissions = async () => {
  console.log('🧪 Testando permissões...');

  try {
    // Verificação simples de APIs disponíveis
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
    const hasMediaRecorder = !!window.MediaRecorder;

    let permissionState = 'unknown';
    try {
      if (navigator.permissions) {
        const micPermission = await navigator.permissions.query({ name: 'microphone' });
        permissionState = micPermission.state;
      }
    } catch (permError) {
      console.warn('⚠️ Permissions API não disponível:', permError.message);
    }

    const allGood = hasMediaDevices && hasGetUserMedia && hasMediaRecorder;

    testResults.value.push({
      method: '🔐 APIs e Permissões',
      success: allGood,
      message: allGood ? '✅ Todas as APIs disponíveis' : '❌ APIs em falta',
      details: `MediaDevices: ${hasMediaDevices ? '✅' : '❌'}, getUserMedia: ${hasGetUserMedia ? '✅' : '❌'}, MediaRecorder: ${hasMediaRecorder ? '✅' : '❌'}, Permissão: ${permissionState}`
    });

  } catch (error) {
    console.warn('⚠️ Teste de permissões falhou:', error.message);
    testResults.value.push({
      method: '🔐 APIs e Permissões',
      success: false,
      message: `❌ Erro: ${error.message}`
    });
  }
};
</script>