<template>
  <div class="mb-6">
    <!-- Status do BlackHole -->
    <div v-if="blackHoleStatus === 'checking'" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div class="flex items-center">
        <div class="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
        <span class="text-sm text-blue-800">Verificando BlackHole...</span>
      </div>
    </div>

    <!-- BlackHole instalado e funcionando -->
    <div v-else-if="blackHoleStatus === 'available'" class="bg-green-50 border border-green-200 rounded-lg p-4">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-medium text-green-900 mb-1">
            ✅ BlackHole Detectado
          </h3>
          <p class="text-sm text-green-700 mb-3">
            BlackHole está instalado! Agora você pode capturar áudio completo das reuniões.
          </p>
          <button
            @click="configureBlackHole"
            :disabled="isConfiguring"
            class="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {{ isConfiguring ? 'Configurando...' : '🔧 Configurar Automaticamente' }}
          </button>
        </div>
      </div>
    </div>

    <!-- BlackHole não instalado -->
    <div v-else-if="blackHoleStatus === 'not_found'" class="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-medium text-amber-900 mb-2">
            🎵 Instalar BlackHole para Captura Completa
          </h3>
          <p class="text-sm text-amber-700 mb-3">
            Para gravar áudio de TODOS os participantes da reunião (não apenas sua voz),
            instale o BlackHole - é gratuito e leva 2 minutos.
          </p>

          <div class="space-y-3">
            <div class="bg-white rounded-md p-3 border border-amber-200">
              <h4 class="text-sm font-medium text-gray-900 mb-2">📋 Instalação Rápida:</h4>

              <div class="space-y-2 text-sm">
                <div class="flex items-start space-x-2">
                  <span class="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-mono">1</span>
                  <div>
                    <strong>Terminal:</strong>
                    <code class="block bg-gray-100 px-2 py-1 rounded mt-1 font-mono text-xs">
                      brew install blackhole-2ch
                    </code>
                  </div>
                </div>

                <div class="flex items-start space-x-2">
                  <span class="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-mono">2</span>
                  <div>
                    <strong>Configurar macOS:</strong>
                    <span class="text-gray-600">Abrir "Configurações de Som" → Criar "Dispositivo Agregado"</span>
                  </div>
                </div>

                <div class="flex items-start space-x-2">
                  <span class="bg-amber-100 text-amber-800 px-2 py-1 rounded text-xs font-mono">3</span>
                  <div>
                    <strong>Pronto!</strong>
                    <span class="text-gray-600">Reinicie esta aplicação</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex space-x-2">
              <button
                @click="openBlackHoleWebsite"
                class="px-3 py-2 bg-amber-600 text-white text-sm rounded-md hover:bg-amber-700"
              >
                📖 Guia Completo
              </button>

              <button
                @click="recheckBlackHole"
                :disabled="isChecking"
                class="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {{ isChecking ? '...' : '🔄 Verificar Novamente' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Erro ao verificar -->
    <div v-else-if="blackHoleStatus === 'error'" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <div class="flex items-start space-x-3">
        <svg class="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div>
          <h3 class="text-sm font-medium text-red-900 mb-1">Erro ao Verificar BlackHole</h3>
          <p class="text-sm text-red-700">{{ errorMessage }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const blackHoleStatus = ref('checking'); // 'checking', 'available', 'not_found', 'error'
const isConfiguring = ref(false);
const isChecking = ref(false);
const errorMessage = ref('');

const checkBlackHole = async () => {
  try {
    blackHoleStatus.value = 'checking';

    // Verifica se BlackHole está disponível como dispositivo de áudio
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioDevices = devices.filter(device => device.kind === 'audioinput');

    console.log('🎵 Dispositivos de áudio encontrados:', audioDevices.map(d => d.label));

    // Procura por BlackHole nos dispositivos
    const blackHoleDevice = audioDevices.find(device =>
      device.label.toLowerCase().includes('blackhole') ||
      device.label.toLowerCase().includes('black hole')
    );

    if (blackHoleDevice) {
      console.log('✅ BlackHole encontrado:', blackHoleDevice.label);
      blackHoleStatus.value = 'available';
    } else {
      console.log('⚠️ BlackHole não encontrado nos dispositivos');
      blackHoleStatus.value = 'not_found';
    }

  } catch (error) {
    console.error('❌ Erro ao verificar BlackHole:', error);
    blackHoleStatus.value = 'error';
    errorMessage.value = error.message;
  }
};

const configureBlackHole = async () => {
  isConfiguring.value = true;

  try {
    // Tenta configurar automaticamente o BlackHole como fonte de áudio
    const devices = await navigator.mediaDevices.enumerateDevices();
    const blackHoleDevice = devices.find(device =>
      device.kind === 'audioinput' &&
      (device.label.toLowerCase().includes('blackhole') ||
       device.label.toLowerCase().includes('black hole'))
    );

    if (blackHoleDevice) {
      // Testa captura com BlackHole
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: blackHoleDevice.deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 48000
        }
      });

      // Para o stream imediatamente (só estava testando)
      stream.getTracks().forEach(track => track.stop());

      console.log('✅ BlackHole configurado com sucesso!');

      // Emite evento para o componente pai
      emit('blackhole-configured', {
        deviceId: blackHoleDevice.deviceId,
        label: blackHoleDevice.label
      });

    } else {
      throw new Error('BlackHole não encontrado após configuração');
    }

  } catch (error) {
    console.error('❌ Erro ao configurar BlackHole:', error);
    errorMessage.value = `Erro na configuração: ${error.message}`;
    blackHoleStatus.value = 'error';
  } finally {
    isConfiguring.value = false;
  }
};

const recheckBlackHole = async () => {
  isChecking.value = true;
  await checkBlackHole();
  isChecking.value = false;
};

const openBlackHoleWebsite = () => {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal('https://github.com/ExistentialAudio/BlackHole');
  } else {
    window.open('https://github.com/ExistentialAudio/BlackHole', '_blank');
  }
};

// Emits
const emit = defineEmits(['blackhole-configured']);

// Verificar BlackHole ao montar componente
onMounted(() => {
  checkBlackHole();
});
</script>