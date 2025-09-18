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

      <!-- Alerta sobre captura limitada -->
      <AlertBox
        v-if="audioCaptureType === 'microphone' && isRecording"
        type="warning"
        title="⚠️ Captura limitada"
        message="Gravando apenas seu áudio. Para capturar todos os participantes, configure captura de áudio do sistema ou use um dispositivo de áudio virtual."
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
import RecordingControls from "./recorder/RecordingControls.vue";
import TranscriptDisplay from "./recorder/TranscriptDisplay.vue";
import AlertBox from "./ui/AlertBox.vue";
import AudioCaptureIndicator from "./ui/AudioCaptureIndicator.vue";
import StatusIndicator from "./ui/StatusIndicator.vue";

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
} = useRecorder();

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
