<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">
            {{ meeting.title }}
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            {{ formatDate(meeting.createdAt) }} •
            {{ formatTime(meeting.createdAt) }}
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <button
            @click="downloadPDF"
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            title="Baixar PDF"
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
            Baixar PDF
          </button>

          <button
            @click="$emit('new-meeting')"
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nova Reunião
          </button>

          <button
            @click="$emit('delete-meeting', meeting.id)"
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            title="Excluir reunião"
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

    <!-- Conteúdo -->
    <div class="flex-1 overflow-y-auto">
      <div class="max-w-4xl mx-auto p-6 space-y-8">
        <!-- Resumo Geral -->
        <section
          v-if="meeting.summary && meeting.summary.geral"
          class="bg-blue-50 border border-blue-200 rounded-lg p-6"
        >
          <div class="flex items-center mb-4">
            <svg
              class="w-5 h-5 text-blue-500 mr-2"
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
            <h3 class="text-lg font-semibold text-blue-900">Resumo Geral</h3>
          </div>
          <p class="text-blue-800 leading-relaxed">
            {{ meeting.summary.geral }}
          </p>
        </section>

        <!-- Pontos Discutidos -->
        <section
          v-if="meeting.summary && meeting.summary.pontos_discutidos"
          class="bg-white border border-gray-200 rounded-lg p-6"
        >
          <div class="flex items-center mb-4">
            <svg
              class="w-5 h-5 text-gray-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900">
              Pontos Discutidos
            </h3>
          </div>
          <ul class="space-y-3">
            <li
              v-for="(ponto, index) in meeting.summary.pontos_discutidos"
              :key="index"
              class="flex items-start"
            >
              <div
                class="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mt-0.5 mr-3"
              >
                <span class="text-xs font-medium text-gray-600">{{
                  index + 1
                }}</span>
              </div>
              <p class="text-gray-700 leading-relaxed">{{ ponto }}</p>
            </li>
          </ul>
        </section>

        <!-- Tarefas e Ações -->
        <section
          v-if="meeting.summary && meeting.summary.tarefas"
          class="bg-white border border-gray-200 rounded-lg p-6"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <svg
                class="w-5 h-5 text-green-500 mr-2"
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
              <h3 class="text-lg font-semibold text-gray-900">
                Tarefas e Ações
              </h3>
            </div>
            <div class="text-sm text-gray-500">
              {{ completedTasksCount }}/{{
                meeting.summary.tarefas.length
              }}
              concluídas
            </div>
          </div>

          <!-- Barra de progresso -->
          <div class="mb-6">
            <div
              class="flex items-center justify-between text-sm text-gray-600 mb-2"
            >
              <span>Progresso</span>
              <span>{{ taskCompletionPercentage }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-green-500 h-2 rounded-full transition-all duration-300"
                :style="{ width: `${taskCompletionPercentage}%` }"
              ></div>
            </div>
          </div>

          <!-- Lista de tarefas -->
          <div class="space-y-3">
            <div
              v-for="(tarefa, index) in meeting.summary.tarefas"
              :key="index"
              :class="[
                'flex items-start p-3 rounded-lg border transition-colors',
                tarefa.concluida
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100',
              ]"
            >
              <button
                @click="toggleTask(index)"
                :class="[
                  'flex-shrink-0 w-5 h-5 rounded border-2 mr-3 mt-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
                  tarefa.concluida
                    ? 'bg-green-500 border-green-500 text-white focus:ring-green-500'
                    : 'border-gray-300 hover:border-gray-400 focus:ring-blue-500',
                ]"
              >
                <svg
                  v-if="tarefa.concluida"
                  class="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              <div class="flex-1 min-w-0">
                <p
                  :class="[
                    'text-sm leading-relaxed',
                    tarefa.concluida
                      ? 'text-green-800 line-through'
                      : 'text-gray-900',
                  ]"
                >
                  {{ tarefa.descricao }}
                </p>
                <div class="flex items-center mt-2 space-x-3">
                  <span
                    :class="[
                      'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full',
                      tarefa.concluida
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800',
                    ]"
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
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    {{ tarefa.responsavel }}
                  </span>

                  <span
                    :class="[
                      'text-xs',
                      tarefa.concluida ? 'text-green-600' : 'text-gray-500',
                    ]"
                  >
                    {{ tarefa.concluida ? "Concluída" : "Pendente" }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Transcrição Completa -->
        <section
          v-if="meeting.transcript"
          class="bg-white border border-gray-200 rounded-lg p-6"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <svg
                class="w-5 h-5 text-gray-500 mr-2"
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
              <h3 class="text-lg font-semibold text-gray-900">
                Transcrição Completa
              </h3>
            </div>

            <div class="flex items-center space-x-2">
              <span class="text-sm text-gray-500">
                {{ meeting.transcript.length }} caracteres
              </span>
              <button
                @click="copyTranscript"
                class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                title="Copiar transcrição"
              >
                Copiar
              </button>
              <button
                @click="downloadTranscript"
                class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                title="Baixar transcrição"
              >
                Baixar
              </button>
            </div>
          </div>

          <div class="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <div class="prose max-w-none">
              <p class="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {{ meeting.transcript }}
              </p>
            </div>
          </div>
        </section>

        <!-- Informações Adicionais -->
        <section class="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            Informações da Reunião
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="font-medium text-gray-600">Data de Criação:</span>
              <span class="text-gray-900 ml-2">{{
                formatDateTime(meeting.createdAt)
              }}</span>
            </div>
            <div v-if="meeting.updatedAt !== meeting.createdAt">
              <span class="font-medium text-gray-600">Última Atualização:</span>
              <span class="text-gray-900 ml-2">{{
                formatDateTime(meeting.updatedAt)
              }}</span>
            </div>
            <div v-if="meeting.summary && meeting.summary.duracao_minutos">
              <span class="font-medium text-gray-600">Duração:</span>
              <span class="text-gray-900 ml-2">{{
                formatDuration(meeting.summary.duracao_minutos)
              }}</span>
            </div>
            <div>
              <span class="font-medium text-gray-600">ID da Reunião:</span>
              <span class="text-gray-500 ml-2 font-mono text-xs">{{
                meeting.id
              }}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useHistory } from "../composables/useHistory.js";

// Props
const props = defineProps({
  meeting: {
    type: Object,
    required: true,
  },
});

// Emits
const emit = defineEmits(["new-meeting", "delete-meeting"]);

// Composables
const { toggleTask: toggleTaskHistory } = useHistory();

// Computed
const completedTasksCount = computed(() => {
  if (!props.meeting.summary || !props.meeting.summary.tarefas) return 0;
  return props.meeting.summary.tarefas.filter((task) => task.concluida).length;
});

const taskCompletionPercentage = computed(() => {
  if (
    !props.meeting.summary ||
    !props.meeting.summary.tarefas ||
    props.meeting.summary.tarefas.length === 0
  )
    return 0;
  return Math.round(
    (completedTasksCount.value / props.meeting.summary.tarefas.length) * 100
  );
});

// Métodos
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return `${hours}h ${remainingMinutes}min`;
};

const toggleTask = (taskIndex) => {
  toggleTaskHistory(props.meeting.id, taskIndex);
};

const copyTranscript = async () => {
  try {
    await navigator.clipboard.writeText(props.meeting.transcript);
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
  const blob = new Blob([props.meeting.transcript], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transcricao-${props.meeting.title
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadPDF = () => {
  // Simula a geração de PDF
  // Em um ambiente real, você usaria uma biblioteca como jsPDF ou html2pdf

  const content = generatePDFContent();
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `resumo-${props.meeting.title
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const generatePDFContent = () => {
  let content = `RESUMO DA REUNIÃO\n`;
  content += `===================\n\n`;
  content += `Título: ${props.meeting.title}\n`;
  content += `Data: ${formatDateTime(props.meeting.createdAt)}\n\n`;

  if (props.meeting.summary && props.meeting.summary.geral) {
    content += `RESUMO GERAL\n`;
    content += `------------\n`;
    content += `${props.meeting.summary.geral}\n\n`;
  }

  if (props.meeting.summary && props.meeting.summary.pontos_discutidos) {
    content += `PONTOS DISCUTIDOS\n`;
    content += `-----------------\n`;
    props.meeting.summary.pontos_discutidos.forEach((ponto, index) => {
      content += `${index + 1}. ${ponto}\n`;
    });
    content += `\n`;
  }

  if (props.meeting.summary && props.meeting.summary.tarefas) {
    content += `TAREFAS E AÇÕES\n`;
    content += `---------------\n`;
    props.meeting.summary.tarefas.forEach((tarefa, index) => {
      const status = tarefa.concluida ? "[x]" : "[ ]";
      content += `${status} ${tarefa.descricao} (${tarefa.responsavel})\n`;
    });
    content += `\n`;
  }

  if (props.meeting.transcript) {
    content += `TRANSCRIÇÃO COMPLETA\n`;
    content += `--------------------\n`;
    content += `${props.meeting.transcript}\n`;
  }

  return content;
};
</script>
