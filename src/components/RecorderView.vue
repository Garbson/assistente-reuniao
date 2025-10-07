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
          <StatusIndicator
            :is-active="isRecording"
            :status-text="
              isRecording ? formatDuration(recordingDuration) : 'Parado'
            "
          />
          <AudioCaptureIndicator
            v-if="isRecording || audioCaptureType !== 'unknown'"
            :capture-type="audioCaptureType"
            :is-capturing-full-meeting="isCapturingFullMeeting"
            :source-count="audioSources.length"
            :is-capturing-input="isCapturingInput"
            :is-capturing-output="isCapturingOutput"
            :audio-quality="audioQuality"
          />
          <RecordingControls
            :is-recording="isRecording"
            :is-supported="isSupported"
            :is-processing="isProcessing"
            :transcript="transcript"
            @start-recording="startRecording"
            @stop-recording="stopRecording"
            @clear-transcript="clearTranscript"
          />
        </div>
      </div>
    </div>

    <!-- Conteúdo principal -->
    <div class="flex-1 overflow-y-auto p-6">

      <!-- Sistema Híbrido Ativo: Transcrição após gravação (estilo Notion) -->
      <div v-if="isRecording" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-blue-800">Sistema Híbrido Ativo</h3>
            <p class="text-sm text-blue-600 mt-1">
              Gravação em andamento. A transcrição será processada rapidamente após finalizar (estilo Notion).
            </p>
          </div>
        </div>
      </div>

      <!-- Botão de teste de captura de áudio -->
      <AudioTestButton v-if="!isRecording" />

      <!-- Guia de configuração do Stereo Mix -->
      <StereoMixGuide
        v-if="showStereoMixGuide && !isRecording"
        @close="showStereoMixGuide = false"
      />


      <!-- Alerts -->
      <AlertBox
        v-if="error"
        type="error"
        title="Erro na gravação"
        :message="error"
      />

      <AlertBox
        v-if="!isSupported"
        type="warning"
        title="Captura não suportada"
        message="Nenhuma API de áudio está disponível. Verifique permissões do sistema e reinicie o aplicativo."
      />

      <!-- Alerta quando captura completa está ativa -->
      <AlertBox
        v-if="isRecording && audioCaptureType === 'system'"
        type="success"
        title="✅ Captura completa ativa"
        message="Gravando TODO o áudio do sistema - sua voz + áudio dos outros participantes."
      />

      <!-- Alerta quando captura Notion está ativa -->
      <AlertBox
        v-if="isRecording && audioCaptureType === 'notion'"
        type="success"
        title="🎯 Captura igual ao Notion ativa"
        message="Gravando microfone + sistema mixados em uma única transcrição - sua voz + todos os participantes."
      />

      <!-- Alerta quando apenas microfone -->
      <AlertBox
        v-if="isRecording && audioCaptureType === 'microphone'"
        type="warning"
        title="⚠️ Apenas microfone detectado"
        message="Capturando apenas sua voz. Desktop Capturer não conseguiu acessar o áudio do sistema."
      />

      <!-- Status da API - Simplificado -->
      <AlertBox
        v-if="apiStatus && apiStatus.status === 'error'"
        type="error"
        title="API indisponível"
        :message="apiStatus.message"
      />

      <AlertBox
        v-if="isProcessing"
        type="info"
        title="Processando..."
        :message="!transcript ? 'Transcrevendo áudio' : 'Gerando resumo'"
      />

      <!-- Área de transcrição -->
      <div class="space-y-6">
        <TranscriptDisplay
          :transcript="transcript"
          :is-recording="isRecording"
        />

        <PostRecordingActions
          v-if="transcript && !isRecording && !isProcessing"
          @generate-summary="generateSummary"
          @download-transcript="downloadTranscript"
          @save-transcript="saveWithoutSummary"
        />

      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useConfig } from "../composables/useConfig.js";
import { useHistory } from "../composables/useHistory.js";
import { useRecorder } from "../composables/useRecorder.js";
import {
  downloadFile,
  formatDuration,
  formatTimestamp,
} from "../utils/formatters.js";

// UI Components
import PostRecordingActions from "./recorder/PostRecordingActions.vue";
import RealTimeTranscriptionIndicator from "./recorder/RealTimeTranscriptionIndicator.vue";
import RecordingControls from "./recorder/RecordingControls.vue";
import TranscriptDisplay from "./recorder/TranscriptDisplay.vue";
import AlertBox from "./ui/AlertBox.vue";
import AudioCaptureIndicator from "./ui/AudioCaptureIndicator.vue";
import AudioTestButton from "./ui/AudioTestButton.vue";
import StatusIndicator from "./ui/StatusIndicator.vue";
import StereoMixGuide from "./ui/StereoMixGuide.vue";

// Emits
const emit = defineEmits(["summary-generated"]);

// Composables
const {
  isRecording,
  isProcessing,
  isSupported,
  transcript,
  error,
  startRecording: startRec,
  stopRecording: stopRec,
  clearTranscript,
  transcribeAudio,
  generateSummaryFromTranscript,
  hasAudio,
  audioBlob,
  setOpenAIApiKey,
  testOpenAIConnection,
  estimateTranscriptionCost,
  hasOpenAIConfigured,
  // Novos: estado da captura de áudio
  audioCaptureType,
  isCapturingFullMeeting,
  audioSources,
  isCapturingInput,
  isCapturingOutput,
  audioQuality,
  detectedMeetingApp,
  // Transcrição em tempo real
  realTimeTranscription,
  cache,
} = useRecorder();

const { saveMeeting } = useHistory();
const { apiStatus } = useConfig();

// Estado local
const recordingDuration = ref(0);
const showStereoMixGuide = ref(false);
let durationInterval = null;

// Listener para iniciar gravação automaticamente (nova implementação)
let removeStartRecordingListener = null;

onMounted(() => {
  // Registra listener para detecção automática de reunião
  if (window.electronAPI?.onStartRecording) {
    removeStartRecordingListener = window.electronAPI.onStartRecording(
      (meetingData) => {
        console.log("🎬 Reunião detectada automaticamente:", meetingData);

        // Inicia gravação automaticamente se não estiver gravando
        if (!isRecording.value && !isProcessing.value) {
          console.log("🚀 Iniciando gravação automática...");
          startRecording();

          // Mostra notificação de feedback
          if (window.electronAPI?.showNotification) {
            window.electronAPI.showNotification(
              "Gravação Iniciada",
              `Gravação automática iniciada para ${meetingData.app}`
            );
          }
        } else {
          console.log("⚠️ Gravação já em andamento, ignorando...");
        }
      }
    );
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

// Usando função utilitaria importada

// Métodos
const startRecording = async () => {
  try {
    console.log('🔴 [RecorderView] Iniciando gravação...');

    // Reset do estado antes de iniciar
    error.value = null;
    recordingDuration.value = 0;

    // Chama a função do composable
    await startRec();

    if (isRecording.value) {
      console.log('✅ [RecorderView] Gravação iniciada, configurando timer...');
      recordingDuration.value = 0;
      durationInterval = setInterval(() => {
        recordingDuration.value++;
      }, 1000);
    } else {
      console.warn('⚠️ [RecorderView] Gravação não iniciou (isRecording ainda false)');
    }
  } catch (startError) {
    console.error('❌ [RecorderView] Erro ao iniciar gravação:', startError);
    error.value = `Erro ao iniciar: ${startError.message}`;
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
    const fileSizeMB = audioBlob.value.size / (1024 * 1024);
    const durationMinutes = (recordingDuration.value || 0) / 60;

    // Mostrar info do arquivo para o usuário
    console.log(
      `🎵 Processando áudio: ${fileSizeMB.toFixed(
        1
      )}MB, ${durationMinutes.toFixed(1)} minutos`
    );

    await transcribeAudio();

    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification(
        "Transcrição Concluída",
        `Áudio de ${durationMinutes.toFixed(1)} min processado com sucesso!`
      );
    }
  } catch (err) {
    console.error("Erro ao transcrever áudio:", err);

    // Mensagens de erro mais específicas
    let errorMessage = "Erro ao transcrever áudio. ";

    if (err.message.includes("limit") || err.message.includes("grande")) {
      errorMessage += "Processando reunião longa em partes menores. Aguarde...";
    } else if (
      err.message.includes("timeout") ||
      err.message.includes("Timeout")
    ) {
      errorMessage += "A API demorou muito para processar. Tente novamente.";
    } else if (err.message.includes("API ausente")) {
      errorMessage += "Chave da API não configurada. Verifique o arquivo .env";
    } else if (err.message.includes("upload")) {
      errorMessage += "Falha no upload do arquivo. Verifique sua conexão.";
    } else {
      errorMessage += err.message;
    }

    alert(errorMessage);
  }
};

const generateSummary = async () => {
  if (!transcript.value) {
    alert("Nenhuma transcrição disponível.");
    return;
  }
  try {
    const summary = await generateSummaryFromTranscript();
    const meeting = saveMeeting(transcript.value, summary);
    emit("summary-generated", meeting);
    if (window.electronAPI?.showNotification) {
      window.electronAPI.showNotification(
        "Resumo Gerado",
        "Resumo criado com sucesso!"
      );
    }
  } catch (err) {
    console.error("Erro ao gerar resumo:", err);
    alert("Erro ao gerar resumo. Verifique a chave da API e tente novamente.");
  }
};

const downloadTranscript = () => {
  const filename = `transcricao-${formatTimestamp()}.txt`;
  downloadFile(transcript.value, filename);
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

// Funções de controle da transcrição em tempo real
const toggleRealTimeTranscription = () => {
  realTimeTranscription.value.enabled = !realTimeTranscription.value.enabled;
  console.log('🔄 Transcrição em tempo real:', realTimeTranscription.value.enabled ? 'Ativada' : 'Desativada');
};

const clearTranscriptionCache = () => {
  cache.clearAllCache();
  console.log('🗑️ Cache de transcrições limpo');
};

// Watchers
watch(isRecording, (newValue) => {
  if (!newValue) {
    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }
  }
});// Processamento automático da transcrição após parar gravação
watch(hasAudio, (val) => {
  if (val && !transcript.value && !isProcessing.value) {
    // Auto-transcrição após parar gravação
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
