<template>
  <div class="h-full bg-gray-50 border-r border-gray-200 flex flex-col">
    <!-- Header da Sidebar -->
    <div class="p-4 border-b border-gray-200">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-lg font-semibold text-gray-900">Reuniões</h1>
        <button
          @click="$emit('new-meeting')"
          class="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
          title="Nova Reunião"
        >
          <svg
            class="w-4 h-4 mr-1"
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
          Nova
        </button>
      </div>

      <!-- Estatísticas -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div class="bg-white p-2 rounded border">
          <div class="text-gray-500">Total</div>
          <div class="font-semibold text-gray-900">{{ totalMeetings }}</div>
        </div>
        <div class="bg-white p-2 rounded border">
          <div class="text-gray-500">Esta semana</div>
          <div class="font-semibold text-gray-900">{{ meetingsThisWeek }}</div>
        </div>
      </div>
    </div>

    <!-- Lista de Reuniões -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="totalMeetings === 0" class="p-4 text-center text-gray-500">
        <svg
          class="w-12 h-12 mx-auto mb-2 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <p class="text-sm">Nenhuma reunião gravada ainda</p>
        <p class="text-xs text-gray-400 mt-1">Clique em "Nova" para começar</p>
      </div>

      <div v-for="(meetings, date) in meetingsByDate" :key="date" class="mb-4">
        <!-- Cabeçalho da Data -->
        <div class="px-4 py-2 bg-gray-100 border-b border-gray-200">
          <h3 class="text-sm font-medium text-gray-700">{{ date }}</h3>
        </div>

        <!-- Reuniões do Dia -->
        <div class="space-y-1">
          <div
            v-for="meeting in meetings"
            :key="meeting.id"
            @click="selectMeeting(meeting)"
            :class="[
              'group cursor-pointer p-3 hover:bg-blue-50 border-b border-gray-100 transition-colors relative',
              selectedMeeting && selectedMeeting.id === meeting.id
                ? 'bg-blue-50 border-l-4 border-l-blue-500'
                : 'hover:border-l-4 hover:border-l-blue-300',
            ]"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-gray-900 truncate">
                  {{ meeting.title }}
                </h4>
                <p class="text-xs text-gray-500 mt-1">
                  {{ formatTime(meeting.createdAt) }}
                </p>

                <!-- Indicadores de conteúdo -->
                <div class="flex items-center mt-2 space-x-2">
                  <span
                    v-if="meeting.transcript"
                    class="inline-flex items-center text-xs text-gray-500"
                  >
                    <svg
                      class="w-3 h-3 mr-1"
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
                    Gravação
                  </span>

                  <span
                    v-if="meeting.summary"
                    class="inline-flex items-center text-xs text-gray-500"
                  >
                    <svg
                      class="w-3 h-3 mr-1"
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
                    Resumo
                  </span>

                  <span
                    v-if="getTaskCount(meeting) > 0"
                    class="inline-flex items-center text-xs text-gray-500"
                  >
                    <svg
                      class="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                      />
                    </svg>
                    {{ getCompletedTaskCount(meeting) }}/{{
                      getTaskCount(meeting)
                    }}
                  </span>
                </div>
              </div>

              <!-- Menu de ações -->
              <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  @click.stop="showMeetingMenu(meeting, $event)"
                  class="p-1 text-gray-400 hover:text-gray-600 rounded"
                  title="Mais opções"
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
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer com estatísticas de tarefas -->
    <div v-if="totalTasks > 0" class="p-4 border-t border-gray-200 bg-white">
      <div class="text-xs text-gray-500 mb-1">Progresso das Tarefas</div>
      <div class="flex items-center space-x-2">
        <div class="flex-1 bg-gray-200 rounded-full h-2">
          <div
            class="bg-green-500 h-2 rounded-full transition-all duration-300"
            :style="{ width: `${taskCompletionPercentage}%` }"
          ></div>
        </div>
        <span class="text-xs font-medium text-gray-700">
          {{ completedTasks }}/{{ totalTasks }}
        </span>
      </div>
    </div>

    <!-- Menu contextual -->
    <Teleport to="body">
      <div
        v-if="contextMenu.show"
        :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }"
        class="fixed z-50 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[160px]"
        @click.stop
      >
        <button
          @click="exportMeeting(contextMenu.meeting)"
          class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <svg
            class="w-4 h-4 inline mr-2"
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
          Exportar
        </button>
        <button
          @click="duplicateMeeting(contextMenu.meeting)"
          class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <svg
            class="w-4 h-4 inline mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Duplicar
        </button>
        <hr class="my-1" />
        <button
          @click="deleteMeeting(contextMenu.meeting)"
          class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          <svg
            class="w-4 h-4 inline mr-2"
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
          Excluir
        </button>
      </div>
    </Teleport>

    <!-- Backdrop para fechar menu contextual -->
    <div
      v-if="contextMenu.show"
      @click="contextMenu.show = false"
      class="fixed inset-0 z-40"
    ></div>

    <!-- Seção de Debug (apenas em desenvolvimento) -->
    <div v-if="debugInfo" class="p-4 border-t border-gray-200 mt-auto">
      <button
        @click="showDebug = !showDebug"
        class="text-xs text-gray-500 hover:text-gray-700 mb-2"
      >
        {{ showDebug ? 'Ocultar' : 'Mostrar' }} Debug
      </button>
      
      <div v-if="showDebug" class="text-xs space-y-2">
        <div>
          <strong>Janela Ativa:</strong>
          <div class="text-gray-600">{{ debugInfo.activeWindow?.title || 'Nenhuma' }}</div>
          <div class="text-gray-500">Processo: {{ debugInfo.activeWindow?.owner || 'unknown' }}</div>
        </div>
        
        <div v-if="debugInfo.detection">
          <strong>Detecção:</strong>
          <span :class="debugInfo.detection.isMeeting ? 'text-green-600' : 'text-red-600'">
            {{ debugInfo.detection.isMeeting ? `✅ ${debugInfo.detection.app}` : '❌ Não é reunião' }}
          </span>
          <div class="text-gray-500 text-xs">{{ debugInfo.detection.reason }}</div>
        </div>
        
        <div>
          <strong>Notificações Ativas:</strong>
          <span class="text-blue-600">{{ debugInfo.totalNotifications || 0 }}</span>
        </div>
        
        <div v-if="debugInfo.notifiedMeetings && debugInfo.notifiedMeetings.length > 0">
          <strong>Reuniões Notificadas:</strong>
          <div class="max-h-20 overflow-y-auto">
            <div v-for="meeting in debugInfo.notifiedMeetings" :key="meeting" class="text-gray-500 text-xs truncate">
              {{ meeting }}
            </div>
          </div>
        </div>
        
        <div v-if="debugInfo.error" class="text-red-600">
          <strong>Erro:</strong> {{ debugInfo.error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useHistory } from "../composables/useHistory.js";

// Props
defineProps({
  selectedMeeting: Object,
});

// Emits
const emit = defineEmits(["meeting-selected", "new-meeting"]);

// Composables
const {
  meetings,
  meetingsByDate,
  totalMeetings,
  meetingsThisWeek,
  totalTasks,
  completedTasks,
  selectMeeting: selectMeetingHistory,
  deleteMeeting: deleteMeetingHistory,
  exportMeeting: exportMeetingHistory,
  saveMeeting,
} = useHistory();

// Estado local
const contextMenu = reactive({
  show: false,
  meeting: null,
  x: 0,
  y: 0,
});

// Estado do debug
const debugInfo = ref(null);
const showDebug = ref(false);

// Computed
const taskCompletionPercentage = computed(() => {
  if (totalTasks.value === 0) return 0;
  return Math.round((completedTasks.value / totalTasks.value) * 100);
});

// Métodos
const selectMeeting = (meeting) => {
  selectMeetingHistory(meeting);
  emit("meeting-selected", meeting);
};

const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTaskCount = (meeting) => {
  return meeting.summary?.tarefas?.length || 0;
};

const getCompletedTaskCount = (meeting) => {
  return (
    meeting.summary?.tarefas?.filter((task) => task.concluida)?.length || 0
  );
};

const showMeetingMenu = (meeting, event) => {
  event.preventDefault();
  event.stopPropagation();

  contextMenu.meeting = meeting;
  contextMenu.x = event.clientX;
  contextMenu.y = event.clientY;
  contextMenu.show = true;
};

const exportMeeting = (meeting) => {
  exportMeetingHistory(meeting);
  contextMenu.show = false;
};

const duplicateMeeting = (meeting) => {
  const duplicated = {
    ...meeting,
    title: `${meeting.title} (Cópia)`,
    id: undefined, // Será gerado um novo ID
  };

  saveMeeting(duplicated.transcript, duplicated.summary);
  contextMenu.show = false;
};

const deleteMeeting = (meeting) => {
  if (confirm(`Tem certeza que deseja excluir a reunião "${meeting.title}"?`)) {
    deleteMeetingHistory(meeting.id);
  }
  contextMenu.show = false;
};

// Função para atualizar debug
const updateDebugInfo = async () => {
  if (window.electronAPI?.getMeetingDebug) {
    try {
      debugInfo.value = await window.electronAPI.getMeetingDebug();
    } catch (error) {
      console.error('Erro ao obter debug info:', error);
    }
  }
};

// Event listeners
const handleClickOutside = (event) => {
  if (contextMenu.show && !event.target.closest(".context-menu")) {
    contextMenu.show = false;
  }
};

let debugInterval;

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
  
  // Inicia debug apenas em ambiente Electron
  if (window.electronAPI?.getMeetingDebug) {
    updateDebugInfo();
    debugInterval = setInterval(updateDebugInfo, 3000);
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  if (debugInterval) {
    clearInterval(debugInterval);
  }
});
</script>
