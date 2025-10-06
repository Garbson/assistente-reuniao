<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header -->
    <div class="border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-gray-900">
            {{ displayTitle }}
          </h2>
          <p class="text-sm text-gray-500 mt-1">
            {{ formatDate(meeting.createdAt) }} •
            {{ formatTime(meeting.createdAt) }}
          </p>
        </div>

        <div class="flex items-center space-x-3">
          <!-- Dropdown de Download -->
          <div class="relative">
            <button
              @click="showDownloadMenu = !showDownloadMenu"
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
              title="Opções de download"
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
              Download
              <svg
                class="w-4 h-4 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <!-- Menu Dropdown -->
            <div
              v-if="showDownloadMenu"
              class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10"
              @click="showDownloadMenu = false"
            >
              <div class="py-1">
                <button
                  @click="downloadPDF"
                  class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Baixar como PDF
                </button>
                <button
                  @click="downloadText"
                  class="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <svg class="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Baixar como Texto
                </button>
              </div>
            </div>
          </div>

          <!-- Botão Regenerar Resumo -->
          <button
            v-if="meeting.transcript"
            @click="showRegenerateModal = true"
            :disabled="isRegenerating"
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-600 bg-white border border-purple-300 rounded-md hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Regenerar resumo no novo formato estruturado"
          >
            <svg
              v-if="isRegenerating"
              class="w-4 h-4 mr-2 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <svg
              v-else
              class="w-4 h-4 mr-2"
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
            {{ isRegenerating ? 'Regenerando...' : 'Regenerar Resumo' }}
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
        <!-- Formato Estruturado (Novo) -->
        <template v-if="isStructuredFormat">
          <!-- Contexto e Objetivo -->
          <section
            v-if="meeting.summary.contexto_e_objetivo"
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 class="text-lg font-semibold text-blue-900">Contexto e Objetivo</h3>
            </div>
            <p class="text-blue-800 leading-relaxed">
              {{ meeting.summary.contexto_e_objetivo }}
            </p>
          </section>

          <!-- Pontos Principais -->
          <section
            v-if="meeting.summary.pontos_principais && meeting.summary.pontos_principais.length > 0"
            class="space-y-6"
          >
            <div
              v-for="(ponto, index) in meeting.summary.pontos_principais"
              :key="index"
              class="bg-white border border-gray-200 rounded-lg p-6"
            >
              <div class="flex items-center mb-4">
                <div
                  class="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3"
                >
                  <span class="text-sm font-medium text-blue-600">{{
                    index + 1
                  }}</span>
                </div>
                <h3 class="text-lg font-semibold text-gray-900">
                  {{ ponto.subtitulo }}
                </h3>
              </div>

              <div v-if="ponto.pontos_abordados && ponto.pontos_abordados.length > 0">
                <ul class="space-y-2">
                  <li
                    v-for="(ponto_abordado, pontoIndex) in ponto.pontos_abordados"
                    :key="pontoIndex"
                    class="flex items-start"
                  >
                    <div
                      class="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full mt-2 mr-3"
                    ></div>
                    <p class="text-gray-700 leading-relaxed">{{ ponto_abordado }}</p>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </template>

        <!-- Formato Antigo (Compatibilidade) -->
        <template v-else>
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
        </template>

        <!-- Pontos Discutidos (Formato Antigo) -->
        <section
          v-if="!isStructuredFormat && meeting.summary && meeting.summary.pontos_discutidos && !meeting.summary.pontos_principais"
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

        <!-- Action Items (Formato Estruturado) -->
        <section
          v-if="currentTasks && currentTasks.length > 0"
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
                {{ isStructuredFormat ? 'Action Items' : 'Tarefas e Ações' }}
              </h3>
            </div>
            <div class="text-sm text-gray-500">
              {{ completedTasksCount }}/{{ currentTasks.length }}
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
              v-for="(tarefa, index) in currentTasks"
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
                    v-if="tarefa.prazo && tarefa.prazo !== 'Não definido'"
                    class="text-xs text-gray-500"
                  >
                    {{ tarefa.prazo }}
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

        <!-- Decisões Tomadas -->
        <section
          v-if="meeting.summary && meeting.summary.decisoes_tomadas && meeting.summary.decisoes_tomadas.length > 0"
          class="bg-orange-50 border border-orange-200 rounded-lg p-6"
        >
          <div class="flex items-center mb-4">
            <svg
              class="w-5 h-5 text-orange-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 class="text-lg font-semibold text-orange-900">
              Decisões Tomadas
            </h3>
          </div>
          <ul class="space-y-2">
            <li
              v-for="(decisao, index) in meeting.summary.decisoes_tomadas"
              :key="index"
              class="flex items-start"
            >
              <div
                class="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center mt-0.5 mr-3"
              >
                <span class="text-xs font-medium text-orange-600">{{
                  index + 1
                }}</span>
              </div>
              <p class="text-orange-800 leading-relaxed">{{ decisao }}</p>
            </li>
          </ul>
        </section>

        <!-- Próximos Passos -->
        <section
          v-if="meeting.summary && meeting.summary.proximos_passos && meeting.summary.proximos_passos.length > 0"
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
                d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 class="text-lg font-semibold text-blue-900">
              Próximos Passos
            </h3>
          </div>
          <ul class="space-y-2">
            <li
              v-for="(passo, index) in meeting.summary.proximos_passos"
              :key="index"
              class="flex items-start"
            >
              <div
                class="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5 mr-3"
              >
                <span class="text-xs font-medium text-blue-600">{{
                  index + 1
                }}</span>
              </div>
              <p class="text-blue-800 leading-relaxed">{{ passo }}</p>
            </li>
          </ul>
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

    <!-- Modal de Confirmação para Regenerar Resumo -->
    <div
      v-if="showRegenerateModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="showRegenerateModal = false"
    >
      <div
        class="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        @click.stop
      >
        <div class="flex items-center mb-4">
          <svg
            class="w-6 h-6 text-purple-500 mr-3"
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
          <h3 class="text-lg font-semibold text-gray-900">
            Regenerar Resumo
          </h3>
        </div>

        <div class="mb-6">
          <p class="text-gray-600 mb-3">
            Esta ação irá regenerar o resumo da reunião no novo formato estruturado estilo Notion.
          </p>
          <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <div class="flex">
              <svg
                class="w-4 h-4 text-yellow-400 mt-0.5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <div class="text-sm text-yellow-800">
                <p class="font-medium">Nota:</p>
                <p>O status das tarefas será preservado quando possível.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button
            @click="showRegenerateModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
          >
            Cancelar
          </button>
          <button
            @click="handleRegenerateConfirm"
            :disabled="isRegenerating"
            class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ isRegenerating ? 'Regenerando...' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de Erro -->
    <div
      v-if="regenerateError"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="regenerateError = null"
    >
      <div
        class="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        @click.stop
      >
        <div class="flex items-center mb-4">
          <svg
            class="w-6 h-6 text-red-500 mr-3"
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
          <h3 class="text-lg font-semibold text-red-900">
            Erro na Regeneração
          </h3>
        </div>

        <div class="mb-6">
          <p class="text-gray-600">{{ regenerateError }}</p>
        </div>

        <div class="flex justify-end">
          <button
            @click="regenerateError = null"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useHistory } from "../composables/useHistory.js";
import { useRecorder } from "../composables/useRecorder.js";

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
const { toggleTask: toggleTaskHistory, regenerateMeetingSummary } = useHistory();
const { regenerateSummaryWithNewFormat } = useRecorder();

// Estado do modal de regeneração
const showRegenerateModal = ref(false);
const isRegenerating = ref(false);
const regenerateError = ref(null);

// Estado do menu de download
const showDownloadMenu = ref(false);

// Computed
const isStructuredFormat = computed(() => {
  return props.meeting.summary && (
    props.meeting.summary.formato_estruturado === true ||
    (props.meeting.summary.pontos_principais && props.meeting.summary.pontos_principais.length > 0)
  );
});

const currentTasks = computed(() => {
  if (!props.meeting.summary) return [];

  // Prioridade: action_items > tarefas_e_acoes > tarefas
  return props.meeting.summary.action_items ||
         props.meeting.summary.tarefas_e_acoes ||
         props.meeting.summary.tarefas ||
         [];
});

const completedTasksCount = computed(() => {
  return currentTasks.value.filter((task) => task.concluida).length;
});

const taskCompletionPercentage = computed(() => {
  if (currentTasks.value.length === 0) return 0;
  return Math.round((completedTasksCount.value / currentTasks.value.length) * 100);
});

const displayTitle = computed(() => {
  // Se for formato estruturado e tiver título gerado pela IA, usar esse
  if (isStructuredFormat.value && props.meeting.summary.titulo_reuniao) {
    return props.meeting.summary.titulo_reuniao;
  }
  // Senão, usar o título original da reunião
  return props.meeting.title;
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

const copyTranscript = async (event) => {
  try {
    // Tenta usar a API moderna do clipboard
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(props.meeting.transcript);
    } else {
      // Fallback para ambientes sem suporte à API moderna
      const textArea = document.createElement('textarea');
      textArea.value = props.meeting.transcript;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (!successful) {
        throw new Error('Falha ao copiar usando execCommand');
      }
    }

    // Feedback visual temporário
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = "Copiado!";
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  } catch (err) {
    console.error("Erro ao copiar:", err);

    // Última opção: mostrar modal com texto para cópia manual
    const textarea = document.createElement('textarea');
    textarea.value = props.meeting.transcript;
    textarea.style.width = '100%';
    textarea.style.height = '200px';
    textarea.readOnly = true;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 8px;
      max-width: 80%;
      max-height: 80%;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Copie o texto abaixo:';
    title.style.marginBottom = '10px';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar';
    closeBtn.style.cssText = `
      margin-top: 10px;
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;
    closeBtn.onclick = () => document.body.removeChild(modal);

    content.appendChild(title);
    content.appendChild(textarea);
    content.appendChild(closeBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);

    textarea.select();
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
  // Simula a geração de PDF com o resumo completo
  // Em um ambiente real, você usaria uma biblioteca como jsPDF ou html2pdf

  const content = generateCompleteSummaryContent();
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName = displayTitle.value.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  link.download = `resumo-${fileName}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadText = () => {
  const content = generateCompleteSummaryContent();
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const fileName = displayTitle.value.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  link.download = `resumo-${fileName}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};


const generateCompleteSummaryContent = () => {
  let content = `RESUMO DA REUNIÃO\n`;
  content += `===================\n\n`;
  content += `Título: ${displayTitle.value}\n`;
  content += `Data: ${formatDateTime(props.meeting.createdAt)}\n\n`;

  // Formato estruturado (novo)
  if (isStructuredFormat.value) {
    if (props.meeting.summary.contexto_e_objetivo) {
      content += `CONTEXTO E OBJETIVO\n`;
      content += `-------------------\n`;
      content += `${props.meeting.summary.contexto_e_objetivo}\n\n`;
    }

    if (props.meeting.summary.pontos_principais && props.meeting.summary.pontos_principais.length > 0) {
      content += `PONTOS PRINCIPAIS\n`;
      content += `-----------------\n`;
      props.meeting.summary.pontos_principais.forEach((ponto, index) => {
        content += `${index + 1}. ${ponto.subtitulo}\n`;
        if (ponto.pontos_abordados && ponto.pontos_abordados.length > 0) {
          ponto.pontos_abordados.forEach((item) => {
            content += `   • ${item}\n`;
          });
        }
        content += `\n`;
      });
    }
  } else {
    // Formato antigo (compatibilidade)
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
  }

  // Action Items/Tarefas (comum aos dois formatos)
  if (currentTasks.value && currentTasks.value.length > 0) {
    content += `ACTION ITEMS\n`;
    content += `------------\n`;
    currentTasks.value.forEach((tarefa, index) => {
      const status = tarefa.concluida ? "[x]" : "[ ]";
      content += `${status} ${tarefa.descricao}`;
      if (tarefa.responsavel) {
        content += ` (${tarefa.responsavel})`;
      }
      if (tarefa.prazo && tarefa.prazo !== 'Não definido') {
        content += ` - Prazo: ${tarefa.prazo}`;
      }
      content += `\n`;
    });
    content += `\n`;
  }

  // Decisões tomadas
  if (props.meeting.summary && props.meeting.summary.decisoes_tomadas && props.meeting.summary.decisoes_tomadas.length > 0) {
    content += `DECISÕES TOMADAS\n`;
    content += `----------------\n`;
    props.meeting.summary.decisoes_tomadas.forEach((decisao, index) => {
      content += `${index + 1}. ${decisao}\n`;
    });
    content += `\n`;
  }

  // Próximos passos
  if (props.meeting.summary && props.meeting.summary.proximos_passos && props.meeting.summary.proximos_passos.length > 0) {
    content += `PRÓXIMOS PASSOS\n`;
    content += `---------------\n`;
    props.meeting.summary.proximos_passos.forEach((passo, index) => {
      content += `${index + 1}. ${passo}\n`;
    });
    content += `\n`;
  }

  return content;
};

const handleRegenerateConfirm = async () => {
  if (isRegenerating.value) return;

  isRegenerating.value = true;
  regenerateError.value = null;

  try {
    await regenerateMeetingSummary(props.meeting.id, regenerateSummaryWithNewFormat);
    showRegenerateModal.value = false;
    console.log('✅ Resumo regenerado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao regenerar resumo:', error);
    regenerateError.value = error.message || 'Erro desconhecido ao regenerar resumo.';
    showRegenerateModal.value = false;
  } finally {
    isRegenerating.value = false;
  }
};
</script>
