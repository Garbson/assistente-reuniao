<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">Nova Reunião</h2>
          <p class="text-sm text-gray-500 mt-1">
            {{
              isRecording ? "Gravação em andamento..." : "Pronto para gravar"
            }}
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <!-- Status da gravação -->
          <div class="flex items-center space-x-2">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                isRecording
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-gray-300',
              ]"
            ></div>
            <span class="text-sm text-gray-600">
              {{
                isRecording
                  ? `${formatDuration(recordingDuration)}`
                  : "Parado"
              }}
            </span>
          </div>

          <!-- Botões de controle -->
          <div class="flex space-x-2">
            <button
              v-if="!isRecording"
              @click="startRecording"
              :disabled="!isSupported || isProcessing"
              class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                class="w-4 h-4 mr-2"
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
              Iniciar Gravação
            </button>

            <button
              v-if="isRecording"
              @click="stopRecording"
              class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              <svg
                class="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              Parar Gravação
            </button>

            <button
              v-if="transcript && !isRecording"
              @click="clearTranscript"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              title="Limpar transcrição"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Conteúdo principal -->
    <div class="flex-1 overflow-y-auto p-6">
      <!-- Mensagem de erro -->
      <div v-if="error" class="mb-6">
        <div class="bg-red-50 border border-red-200 rounded-md p-4">
          <div class="flex">
            <svg
              class="w-5 h-5 text-red-400 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-red-800">Erro na gravação</h3>
              <p class="text-sm text-red-700 mt-1">{{ error }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Aviso de suporte -->
  <div v-if="!isSupported" class="mb-6">
        <div class="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div class="flex">
            <svg
              class="w-5 h-5 text-yellow-400 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-yellow-800">
                Captura não suportada
              </h3>
              <p class="text-sm text-yellow-700 mt-1">
                Nenhuma API de áudio está disponível. Verifique permissões do
                sistema e reinicie o aplicativo.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Status da API -->
  <div v-if="apiStatus && apiStatus.status && apiStatus.status !== 'success'" class="mb-6">
        <div
          :class="[
            'border rounded-md p-4',
            apiStatus.status === 'error'
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200',
          ]"
        >
          <div class="flex">
            <svg
              :class="[
                'w-5 h-5 mt-0.5',
                apiStatus.status === 'error'
                  ? 'text-red-400'
                  : 'text-yellow-400',
              ]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div class="ml-3">
              <h3
                :class="[
                  'text-sm font-medium',
                  apiStatus.status === 'error'
                    ? 'text-red-800'
                    : 'text-yellow-800',
                ]"
              >
                {{
                  apiStatus.status === "error"
                    ? "Problema com a API"
                    : "Aviso da API"
                }}
              </h3>
              <p
                :class="[
                  'text-sm mt-1',
                  apiStatus.status === 'error'
                    ? 'text-red-700'
                    : 'text-yellow-700',
                ]"
              >
                {{ apiStatus.message }}
              </p>
              <p
                :class="[
                  'text-sm mt-1',
                  apiStatus.status === 'error'
                    ? 'text-red-600'
                    : 'text-yellow-600',
                ]"
              >
                {{
                  apiStatus.status === "error"
                    ? "A geração de resumos com IA estará indisponível, mas você ainda pode gravar e salvar transcrições."
                    : "A geração de resumos pode não funcionar corretamente."
                }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Estado de processamento -->
      <div v-if="isProcessing" class="mb-6">
        <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div class="flex items-center">
            <svg
              class="animate-spin w-5 h-5 text-blue-500 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <div>
              <h3 class="text-sm font-medium text-blue-800">
                Processando com IA...
              </h3>
              <p class="text-sm text-blue-700 mt-1">
                Gerando resumo da reunião. Isso pode levar alguns segundos.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Área de transcrição -->
      <div class="space-y-6">
        <!-- Transcrição em tempo real -->
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
            <div v-if="!transcript && !isRecording" class="text-center text-gray-500 py-16">
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

            <div v-if="!transcript && isRecording" class="text-center text-gray-500 py-16">
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

        <!-- Ações após gravação -->
  <div v-if="transcript && !isRecording && !isProcessing" class="bg-white border border-gray-200 rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            Próximos Passos
          </h3>
          <div class="space-y-3">
            <button
              @click="generateSummary"
              class="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              <svg
                class="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Gerar Resumo com IA
            </button>

            <div class="grid grid-cols-2 gap-3">
              <button
                @click="downloadTranscript"
                class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <svg
                  class="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                  />
                </svg>
                Baixar TXT
              </button>

              <button
                @click="saveWithoutSummary"
                class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              >
                <svg
                  class="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                Salvar Apenas Transcrição
              </button>
            </div>
          </div>
        </div>

        <!-- Mensagem de fallback -->
        <!-- Processar áudio gravado (novo fluxo simplificado) -->
        <div v-if="hasAudio && !transcript && !isProcessing" class="bg-white border border-gray-200 rounded-lg p-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Processar Áudio Gravado</h3>
          <button @click="processAudio" class="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Transcrever & Resumir com IA
          </button>
        </div>

        <!-- Dicas de uso -->
  <div v-if="!transcript && !isRecording" class="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 class="text-lg font-medium text-blue-900 mb-4">
            Dicas para uma boa gravação
          </h3>
          <ul class="space-y-2 text-sm text-blue-800">
            <li class="flex items-start">
              <svg
                class="w-4 h-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Fale de forma clara e pausada
            </li>
            <li class="flex items-start">
              <svg
                class="w-4 h-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Mantenha-se próximo ao microfone
            </li>
            <li class="flex items-start">
              <svg
                class="w-4 h-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Evite ruídos de fundo
            </li>
            <li class="flex items-start">
              <svg
                class="w-4 h-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              A transcrição será gerada após processar o áudio gravado
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useConfig } from "../composables/useConfig.js";
import { useHistory } from "../composables/useHistory.js";
import { useRecorder } from "../composables/useRecorder.js";

// Emits
const emit = defineEmits(["summary-generated"]);

// Composables
const { isRecording, isProcessing, isSupported, transcript, error, startRecording: startRec, stopRecording: stopRec, clearTranscript, generateSummaryFromAI, hasAudio, audioBlob } = useRecorder();

const { saveMeeting } = useHistory();
const { apiStatus } = useConfig();

// Estado local
const recordingDuration = ref(0);
let durationInterval = null;

// Listener para iniciar gravação automaticamente (nova implementação)
let removeStartRecordingListener = null;

onMounted(() => {
  // Registra listener para detecção automática de reunião
  if (window.electronAPI?.onStartRecording) {
    removeStartRecordingListener = window.electronAPI.onStartRecording((meetingData) => {
      console.log('🎬 Reunião detectada automaticamente:', meetingData);
      
      // Inicia gravação automaticamente se não estiver gravando
      if (!isRecording.value && !isProcessing.value) {
        console.log('🚀 Iniciando gravação automática...');
        startRecording();
        
        // Mostra notificação de feedback
        if (window.electronAPI?.showNotification) {
          window.electronAPI.showNotification(
            'Gravação Iniciada',
            `Gravação automática iniciada para ${meetingData.app}`
          );
        }
      } else {
        console.log('⚠️ Gravação já em andamento, ignorando...');
      }
    });
  }
});

// Limpa listener quando o componente é desmontado
onUnmounted(() => {
  if (removeStartRecordingListener) {
    removeStartRecordingListener();
  }
  if (durationInterval) {
    clearInterval(durationInterval);
  }
});

// Computed
const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

// Métodos
const startRecording = async () => {
  await startRec();
  if (isRecording.value) {
    recordingDuration.value = 0;
    durationInterval = setInterval(() => {
      recordingDuration.value++;
    }, 1000);
  }
};

const stopRecording = () => {
  stopRec();
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
};

const processAudio = async () => {
  if (!audioBlob.value) {
    alert("Nenhum áudio capturado.");
    return;
  }
  try {
    const summary = await generateSummaryFromAI();
    const meeting = saveMeeting(transcript.value, summary);
    emit("summary-generated", meeting);
    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification("Resumo Gerado", "Resumo criado com sucesso!");
    }
  } catch (err) {
    console.error("Erro ao processar áudio:", err);
    alert("Erro ao processar áudio. Verifique a chave da API e tente novamente.");
  }
};

const copyTranscript = async () => {
  try {
    await navigator.clipboard.writeText(transcript.value);
    // Feedback visual temporário
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = "Copiado!";
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error("Erro ao copiar:", err);
    alert("Erro ao copiar transcrição.");
  }
};

const downloadTranscript = () => {
  const blob = new Blob([transcript.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transcricao-${new Date()
    .toISOString()
    .slice(0, 19)
    .replace(/:/g, "-")}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const saveWithoutSummary = () => {
  if (!transcript.value.trim()) {
    alert("Não há transcrição para salvar.");
    return;
  }

  const meeting = saveMeeting(transcript.value, null);
  emit("summary-generated", meeting);

  // Notificação de sucesso
  if (window.electronAPI && window.electronAPI.showNotification) {
    window.electronAPI.showNotification(
      "Reunião Salva",
      "A transcrição foi salva com sucesso!"
    );
  }
};

// Watchers
watch(isRecording, (newValue) => {
  if (!newValue) {
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  }
});

// Opcional: iniciar processamento automático ao parar (comente se quiser somente manual)
watch(hasAudio, (val) => {
  if (val && !transcript.value) {
    // Auto-processamento; remover se preferir manual
    processAudio();
  }
});

// Cleanup
onMounted(() => {
  return () => {
    if (durationInterval) {
      clearInterval(durationInterval);
    }
  };
});
</script>
