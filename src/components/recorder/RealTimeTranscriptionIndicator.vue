<template>
  <div v-if="showIndicator" class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center space-x-2">
        <div class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        <h3 class="text-sm font-medium text-blue-900">Transcrição em Tempo Real</h3>
        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
          Whisper
        </span>
      </div>
      <button
        @click="toggleDetails"
        class="text-blue-600 hover:text-blue-800 text-xs underline"
      >
        {{ showDetails ? 'Ocultar' : 'Detalhes' }}
      </button>
    </div>

    <!-- Estatísticas resumidas -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-xs">
      <div class="bg-white rounded p-2 text-center">
        <div class="font-semibold text-blue-900">{{ processedChunks }}</div>
        <div class="text-gray-600">Processados</div>
      </div>
      <div class="bg-white rounded p-2 text-center">
        <div class="font-semibold text-orange-600">{{ activeChunks }}</div>
        <div class="text-gray-600">Processando</div>
      </div>
      <div class="bg-white rounded p-2 text-center">
        <div class="font-semibold text-green-600">{{ cacheHits }}</div>
        <div class="text-gray-600">Cache</div>
      </div>
      <div class="bg-white rounded p-2 text-center">
        <div class="font-semibold text-gray-900">{{ transcriptLength }}</div>
        <div class="text-gray-600">Caracteres</div>
      </div>
    </div>

    <!-- Barra de progresso da queue -->
    <div v-if="processingQueue > 0" class="mb-3">
      <div class="flex justify-between text-xs text-gray-600 mb-1">
        <span>Queue de processamento</span>
        <span>{{ processingQueue }} pendentes</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-blue-500 h-2 rounded-full transition-all duration-300"
          :style="{ width: `${Math.max(10, Math.min(100, (activeChunks / maxParallelChunks) * 100))}%` }"
        ></div>
      </div>
    </div>

    <!-- Detalhes expandidos -->
    <div v-if="showDetails" class="space-y-3 pt-3 border-t border-blue-200">
      <!-- Chunks ativos -->
      <div v-if="activeChunks > 0">
        <h4 class="text-xs font-medium text-blue-900 mb-2">Processando agora:</h4>
        <div class="space-y-1">
          <div
            v-for="(chunk, index) in activeChunksList"
            :key="index"
            class="flex items-center justify-between bg-orange-50 rounded px-2 py-1 text-xs"
          >
            <span>Chunk {{ chunk.index + 1 }}</span>
            <div class="flex items-center space-x-2">
              <div class="w-1 h-1 bg-orange-500 rounded-full animate-pulse"></div>
              <span class="text-orange-600">
                {{ Math.floor((Date.now() - chunk.startTime) / 1000) }}s
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Últimos chunks processados -->
      <div v-if="recentChunks.length > 0">
        <h4 class="text-xs font-medium text-blue-900 mb-2">Últimos processados:</h4>
        <div class="space-y-1">
          <div
            v-for="chunk in recentChunks.slice(0, 3)"
            :key="chunk.chunkIndex"
            class="bg-green-50 rounded px-2 py-1 text-xs"
          >
            <div class="flex items-center justify-between">
              <span>Chunk {{ chunk.chunkIndex + 1 }}</span>
              <div class="flex items-center space-x-1">
                <span v-if="chunk.fromCache" class="text-blue-600">Cache</span>
                <span v-else class="text-green-600">Whisper</span>
                <span class="text-gray-500">
                  {{ formatTime(chunk.processedAt) }}
                </span>
              </div>
            </div>
            <div class="text-gray-600 truncate">
              "{{ chunk.text.substring(0, 60) }}..."
            </div>
          </div>
        </div>
      </div>

      <!-- Estatísticas de cache -->
      <div class="bg-gray-50 rounded p-2 text-xs">
        <div class="flex justify-between items-center">
          <span class="font-medium">Cache:</span>
          <span>{{ cacheHitRate }}% hit rate</span>
        </div>
        <div class="text-gray-600 mt-1">
          {{ savedAPICalls }} chamadas economizadas
        </div>
      </div>
    </div>

    <!-- Ações rápidas -->
    <div class="flex justify-between items-center pt-3 border-t border-blue-200">
      <div class="flex space-x-2">
        <button
          @click="clearCache"
          class="text-xs text-gray-600 hover:text-gray-800 underline"
        >
          Limpar Cache
        </button>
        <button
          @click="toggleRealTime"
          class="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          {{ realTimeEnabled ? 'Pausar' : 'Retomar' }}
        </button>
      </div>
      <div class="text-xs text-gray-500">
        Sessão: {{ sessionId.substring(8, 16) }}...
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  realTimeTranscription: {
    type: Object,
    required: true
  },
  cache: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['toggle-real-time', 'clear-cache']);

const showDetails = ref(false);

// Computed properties para extrair dados do estado
const showIndicator = computed(() => {
  return props.realTimeTranscription.sessionId && (
    props.realTimeTranscription.activeChunks.size > 0 ||
    props.realTimeTranscription.processedChunks.size > 0 ||
    props.realTimeTranscription.processingQueue.length > 0
  );
});

const processedChunks = computed(() =>
  props.realTimeTranscription.processedChunks.size
);

const activeChunks = computed(() =>
  props.realTimeTranscription.activeChunks.size
);

const processingQueue = computed(() =>
  props.realTimeTranscription.processingQueue.length
);

const maxParallelChunks = computed(() =>
  props.realTimeTranscription.maxParallelChunks
);

const transcriptLength = computed(() =>
  props.realTimeTranscription.partialTranscript.length
);

const sessionId = computed(() =>
  props.realTimeTranscription.sessionId || 'no-session'
);

const realTimeEnabled = computed(() =>
  props.realTimeTranscription.enabled
);

// Cache stats
const cacheStats = computed(() => props.cache.getCacheStats());
const cacheHits = computed(() => cacheStats.value.hits);
const cacheHitRate = computed(() => cacheStats.value.hitRate);
const savedAPICalls = computed(() => cacheStats.value.savedAPICalls);

// Active chunks list para exibição
const activeChunksList = computed(() => {
  return Array.from(props.realTimeTranscription.activeChunks.entries())
    .map(([index, data]) => ({
      index,
      startTime: data.startTime,
      status: data.status
    }))
    .sort((a, b) => a.index - b.index);
});

// Recent chunks
const recentChunks = computed(() => {
  return Array.from(props.realTimeTranscription.processedChunks.values())
    .filter(chunk => !chunk.error)
    .sort((a, b) => (b.processedAt || 0) - (a.processedAt || 0));
});

// Métodos
const toggleDetails = () => {
  showDetails.value = !showDetails.value;
};

const toggleRealTime = () => {
  emit('toggle-real-time');
};

const clearCache = () => {
  if (confirm('Tem certeza que deseja limpar o cache de transcrições?')) {
    emit('clear-cache');
  }
};

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'agora';
  if (diff < 60000) return `${Math.floor(diff/1000)}s`;
  return `${Math.floor(diff/60000)}m`;
};

// Auto-collapse detalhes se não há atividade
watch([activeChunks, processingQueue], ([active, queue]) => {
  if (active === 0 && queue === 0 && showDetails.value) {
    setTimeout(() => {
      if (activeChunks.value === 0 && processingQueue.value === 0) {
        showDetails.value = false;
      }
    }, 5000);
  }
});
</script>