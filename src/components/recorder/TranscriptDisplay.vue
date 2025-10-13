<template>
  <div class="bg-gray-50 rounded-lg p-6 border border-gray-200">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium text-gray-900">Transcrição</h3>
      <div class="flex items-center space-x-2">
        <span class="text-sm text-gray-500">
          {{ transcript.length }} caracteres
        </span>
        <button
          v-if="transcript"
          @click="copyTranscript"
          class="text-sm text-blue-600 hover:text-blue-800 font-medium"
          title="Copiar transcrição"
        >
          Copiar
        </button>
      </div>
    </div>

    <div class="min-h-[200px] max-h-[400px] overflow-y-auto">
      <!-- Estado vazio -->
      <div
        v-if="!transcript && !isRecording"
        class="text-center text-gray-500 py-16"
      >
        <svg
          class="w-16 h-16 mx-auto mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        <p class="text-lg font-medium">
          Inicie a gravação para ver a transcrição
        </p>
        <p class="text-sm text-gray-400 mt-1">
          O texto aparecerá aqui conforme você fala
        </p>
      </div>

      <!-- Estado gravando -->
      <div
        v-if="!transcript && isRecording"
        class="text-center text-gray-500 py-16"
      >
        <div class="animate-pulse">
          <svg
            class="w-16 h-16 mx-auto mb-4 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        </div>
        <p class="text-lg font-medium">Ouvindo...</p>
        <p class="text-sm text-gray-400 mt-1">
          Comece a falar para ver a transcrição
        </p>
      </div>

      <!-- Transcrição -->
      <div v-if="transcript" class="prose max-w-none">
        <p class="text-gray-900 whitespace-pre-wrap leading-relaxed">
          {{ transcript }}
          <span
            v-if="isRecording"
            class="inline-block w-0.5 h-5 bg-red-500 animate-pulse ml-1"
          ></span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  transcript: {
    type: String,
    default: ''
  },
  isRecording: {
    type: Boolean,
    default: false
  }
});

const copyTranscript = async () => {
  try {
    // Tenta API moderna do clipboard
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(props.transcript || '');
    } else {
      // Fallback com textarea oculto
      const textArea = document.createElement('textarea');
      textArea.value = props.transcript || '';
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (!successful) throw new Error('Falha ao copiar usando execCommand');
    }
    console.log('Transcrição copiada!');
  } catch (err) {
    console.error('Erro ao copiar:', err);
    // Último fallback: modal simples para cópia manual
    const textarea = document.createElement('textarea');
    textarea.value = props.transcript || '';
    textarea.style.width = '100%';
    textarea.style.height = '200px';
    textarea.readOnly = true;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    const content = document.createElement('div');
    content.style.cssText = 'background:white;padding:20px;border-radius:8px;max-width:80%;max-height:80%;';
    const title = document.createElement('h3');
    title.textContent = 'Copie o texto abaixo:';
    title.style.marginBottom = '10px';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar';
    closeBtn.style.cssText = 'margin-top:10px;padding:8px 16px;background:#3b82f6;color:white;border:none;border-radius:4px;cursor:pointer;';
    closeBtn.onclick = () => document.body.removeChild(modal);
    content.appendChild(title);
    content.appendChild(textarea);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
    textarea.select();
  }
};
</script>