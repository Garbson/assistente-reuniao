<template>
  <div class="h-screen flex bg-gray-100">
    <!-- Sidebar -->
    <div class="w-80 flex-shrink-0">
      <Sidebar
        :selected-meeting="selectedMeeting"
        @meeting-selected="handleMeetingSelected"
        @new-meeting="handleNewMeeting"
      />
    </div>

    <!-- Conteúdo Principal -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Área de Conteúdo -->
      <main class="flex-1 overflow-hidden">
        <!-- Vista de Gravação -->
        <RecorderView
          v-if="currentView === 'recorder'"
          @summary-generated="handleSummaryGenerated"
        />

        <!-- Vista de Resumo -->
        <SummaryView
          v-else-if="currentView === 'summary' && selectedMeeting"
          :meeting="selectedMeeting"
          @new-meeting="handleNewMeeting"
          @delete-meeting="handleDeleteMeeting"
        />

        <!-- Vista Vazia (Estado Inicial) -->
        <div v-else class="h-full flex items-center justify-center bg-white">
          <div class="text-center max-w-md">
            <svg
              class="w-24 h-24 mx-auto mb-6 text-gray-300"
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
            <h2 class="text-2xl font-semibold text-gray-900 mb-2">
              Assistente de Reuniões IA
            </h2>
            <p class="text-gray-600 mb-6">
              Grave suas reuniões, obtenha transcrições em tempo real e gere
              resumos inteligentes com IA.
            </p>
            <button
              @click="handleNewMeeting"
              class="inline-flex items-center px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Começar Nova Reunião
            </button>

            <!-- Informações sobre recursos -->
            <div class="mt-8 text-left">
              <h3 class="text-lg font-medium text-gray-900 mb-4">
                Recursos Disponíveis:
              </h3>
              <ul class="space-y-3 text-sm text-gray-600">
                <li class="flex items-start">
                  <svg
                    class="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0"
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
                  Transcrição em tempo real com reconhecimento de voz
                </li>
                <li class="flex items-start">
                  <svg
                    class="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0"
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
                  Geração automática de resumos estruturados
                </li>
                <li class="flex items-start">
                  <svg
                    class="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0"
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
                  Identificação automática de tarefas e responsáveis
                </li>
                <li class="flex items-start">
                  <svg
                    class="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0"
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
                  Histórico de reuniões com busca e organização
                </li>
                <li class="flex items-start">
                  <svg
                    class="w-4 h-4 text-green-500 mt-0.5 mr-2 flex-shrink-0"
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
                  Exportação em PDF e outros formatos
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
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Detecção automática de reuniões (Google Meet, Teams, Zoom)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Loading overlay global -->
    <div
      v-if="isLoading"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg p-6 max-w-sm mx-4">
        <div class="flex items-center">
          <svg
            class="animate-spin w-6 h-6 text-blue-500 mr-3"
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
            <p class="font-medium text-gray-900">{{ loadingMessage }}</p>
            <p class="text-sm text-gray-500 mt-1">Aguarde um momento...</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import RecorderView from "./components/RecorderView.vue";
import Sidebar from "./components/Sidebar.vue";
import SummaryView from "./components/SummaryView.vue";
import { useHistory } from "./composables/useHistory.js";

// Composables
const { deleteMeeting, selectMeeting, clearSelection } = useHistory();

// Estado da aplicação
const currentView = ref("empty"); // 'empty', 'recorder', 'summary'
const selectedMeeting = ref(null);
const isLoading = ref(false);
const loadingMessage = ref("");

// Métodos de navegação
const handleNewMeeting = () => {
  currentView.value = "recorder";
  selectedMeeting.value = null;
  clearSelection();
};

const handleMeetingSelected = (meeting) => {
  selectedMeeting.value = meeting;
  selectMeeting(meeting);
  currentView.value = "summary";
};

const handleSummaryGenerated = (meeting) => {
  selectedMeeting.value = meeting;
  selectMeeting(meeting);
  currentView.value = "summary";
};

const handleDeleteMeeting = async (meetingId) => {
  const meeting = selectedMeeting.value;
  if (!meeting) return;

  const confirmed = confirm(
    `Tem certeza que deseja excluir a reunião "${meeting.title}"?`
  );
  if (!confirmed) return;

  isLoading.value = true;
  loadingMessage.value = "Excluindo reunião...";

  try {
    // Simula delay para melhor UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deleted = deleteMeeting(meetingId);
    if (deleted) {
      selectedMeeting.value = null;
      clearSelection();
      currentView.value = "empty";

      // Notificação de sucesso
      if (window.electronAPI && window.electronAPI.showNotification) {
        window.electronAPI.showNotification(
          "Reunião Excluída",
          "A reunião foi excluída com sucesso."
        );
      }
    }
  } catch (error) {
    console.error("Erro ao excluir reunião:", error);
    alert("Erro ao excluir reunião. Tente novamente.");
  } finally {
    isLoading.value = false;
  }
};

// Inicialização
onMounted(() => {
  // Verifica se é ambiente Electron
  if (window.electronAPI) {
    console.log("Aplicação rodando no Electron");

    // Pode fazer chamadas específicas do Electron aqui
    if (window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then((version) => {
        console.log("Versão da aplicação:", version);
      });
    }
  } else {
    console.log("Aplicação rodando no navegador");
  }

  // Estado inicial
  console.log("Assistente de Reuniões IA inicializado");
});
</script>

<style>
/* Estilos globais adicionais se necessário */
body {
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    sans-serif;
}

/* Scrollbar personalizada */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f5f9;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Animações suaves */
* {
  transition: all 0.2s ease-in-out;
}

/* Foco personalizado */
button:focus,
input:focus,
textarea:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}
</style>
