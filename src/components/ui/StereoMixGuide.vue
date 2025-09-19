<template>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
    <div class="flex items-start">
      <div class="flex-shrink-0">
        <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="ml-3 flex-1">
        <h3 class="text-lg font-medium text-blue-800">
          🔧 Como capturar áudio completo da reunião
        </h3>
        <div class="mt-2 text-sm text-blue-700">
          <p class="mb-3">
            <strong>Esta aplicação usa captura DIRETA de áudio</strong> (como Notion, OBS, etc.). Se você está vendo apenas "microfone", siga os passos:
          </p>

          <div class="space-y-3">
            <div class="bg-green-50 rounded-md p-3 border border-green-200">
              <div class="font-semibold text-green-800 mb-2">✅ MÉTODO AUTOMÁTICO (Recomendado):</div>
              <ol class="list-decimal list-inside space-y-2 text-sm">
                <li>Reinicie a aplicação (<strong>feche e abra novamente</strong>)</li>
                <li>Clique em <strong>"Iniciar Gravação"</strong></li>
                <li>Quando aparecer a janela do Electron, ele deve capturar <strong>automaticamente</strong> o áudio do sistema</li>
                <li>Verifique se o status mostra <strong>"Capturando áudio completo"</strong></li>
              </ol>
            </div>

            <div class="bg-blue-50 rounded-md p-3 border border-blue-200">
              <div class="font-semibold text-blue-800 mb-2">� Se o método automático falhar:</div>
              <ol class="list-decimal list-inside space-y-2 text-sm">
                <li>Clique com o <strong>botão direito</strong> no ícone de som na barra de tarefas</li>
                <li>Selecione <strong>"Sons"</strong> no menu</li>
                <li>Vá para a aba <strong>"Gravação"</strong></li>
                <li>Clique com o botão direito em uma área vazia e marque <strong>"Mostrar dispositivos desabilitados"</strong></li>
                <li>Encontre <strong>"Stereo Mix"</strong> ou <strong>"What U Hear"</strong> na lista</li>
                <li>Clique com o botão direito nele e selecione <strong>"Habilitar"</strong></li>
                <li>Reinicie a aplicação</li>
              </ol>
            </div>

            <div class="bg-yellow-50 rounded-md p-3 border border-yellow-200">
              <div class="font-semibold text-yellow-800 mb-2">⚠️ Observações importantes:</div>
              <ul class="list-disc list-inside space-y-1 text-sm text-yellow-700">
                <li>O <strong>Desktop Capturer</strong> funciona melhor que Stereo Mix</li>
                <li>Se nenhum método funcionar, pode ser limitação da placa de som</li>
                <li>Algumas empresas bloqueiam captura de áudio por política de segurança</li>
              </ul>
            </div>

            <div class="bg-gray-50 rounded-md p-3 border border-gray-200">
              <div class="font-semibold text-gray-800 mb-2">🔍 Como verificar se está funcionando:</div>
              <ul class="list-disc list-inside space-y-1 text-sm text-gray-700">
                <li>Status deve mostrar: <strong>"Capturando áudio completo"</strong></li>
                <li>Indicador de áudio deve piscar quando outros falam</li>
                <li>Logs no console devem mostrar: <strong>"✅ ÁUDIO COMPLETO CAPTURADO"</strong></li>
              </ul>
            </div>
          </div>

          <div class="mt-4 flex space-x-2">
            <button
              @click="openAudioSettings"
              class="inline-flex items-center px-3 py-2 border border-blue-300 shadow-sm text-sm leading-4 font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              🔊 Abrir Configurações de Som
            </button>
            <button
              @click="$emit('close')"
              class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Emits
defineEmits(['close']);

// Função para abrir configurações de som do Windows
const openAudioSettings = () => {
  if (window.electronAPI?.openExternal) {
    // Tenta abrir as configurações de som do Windows
    window.electronAPI.openExternal('ms-settings:sound');
  } else {
    // Fallback para web
    alert('Para abrir as configurações de som:\n\n1. Clique no ícone de som na barra de tarefas\n2. Selecione "Sons"\n3. Vá para a aba "Gravação"');
  }
};
</script>