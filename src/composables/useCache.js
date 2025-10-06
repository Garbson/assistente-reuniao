import { ref } from 'vue';

// Sistema de cache inteligente para chunks de transcrição
export function useCache() {
  const cacheEnabled = ref(true);
  const cacheStats = ref({
    hits: 0,
    misses: 0,
    size: 0,
    savedAPICalls: 0
  });

  // Gerar hash simples para identificar chunks únicos
  const generateChunkHash = async (audioBlob, startTime, endTime) => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Hash simples baseado em tamanho, tempo e primeiros bytes
      const sizeHash = audioBlob.size.toString(36);
      const timeHash = `${startTime.toFixed(1)}-${endTime.toFixed(1)}`;
      const contentHash = Array.from(uint8Array.slice(0, 100))
        .reduce((hash, byte) => ((hash << 5) - hash + byte) & 0xffffffff, 0)
        .toString(36);

      return `chunk_${sizeHash}_${timeHash}_${contentHash}`;
    } catch (e) {
      console.warn('Erro ao gerar hash do chunk:', e);
      return `chunk_${Date.now()}_${Math.random().toString(36)}`;
    }
  };

  // Salvar chunk transcrito no cache
  const cacheChunk = async (audioBlob, startTime, endTime, transcription, metadata = {}) => {
    if (!cacheEnabled.value) return;

    try {
      const hash = await generateChunkHash(audioBlob, startTime, endTime);
      const cacheKey = `transcription_chunk_${hash}`;

      const cacheData = {
        hash,
        startTime,
        endTime,
        transcription,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          size: audioBlob.size,
          type: audioBlob.type,
          version: '1.0'
        }
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheData));

      // Atualiza estatísticas
      cacheStats.value.size++;
      console.log(`💾 Chunk em cache: ${cacheKey.substring(0, 50)}...`);

      return hash;
    } catch (e) {
      console.warn('Erro ao salvar chunk no cache:', e);
    }
  };

  // Recuperar chunk do cache
  const getCachedChunk = async (audioBlob, startTime, endTime) => {
    if (!cacheEnabled.value) return null;

    try {
      const hash = await generateChunkHash(audioBlob, startTime, endTime);
      const cacheKey = `transcription_chunk_${hash}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        const data = JSON.parse(cached);

        // Verificar se cache é válido (não muito antigo)
        const age = Date.now() - data.metadata.timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias

        if (age < maxAge) {
          cacheStats.value.hits++;
          cacheStats.value.savedAPICalls++;
          console.log(`⚡ Cache hit: ${cacheKey.substring(0, 50)}...`);
          return data;
        } else {
          // Remove cache expirado
          localStorage.removeItem(cacheKey);
          console.log(`🗑️ Cache expirado removido: ${cacheKey.substring(0, 50)}...`);
        }
      }

      cacheStats.value.misses++;
      return null;
    } catch (e) {
      console.warn('Erro ao recuperar chunk do cache:', e);
      return null;
    }
  };

  // Limpar cache antigo
  const cleanOldCache = () => {
    try {
      const keys = Object.keys(localStorage).filter(key =>
        key.startsWith('transcription_chunk_')
      );

      let removed = 0;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias

      keys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          const age = Date.now() - data.metadata.timestamp;

          if (age > maxAge) {
            localStorage.removeItem(key);
            removed++;
          }
        } catch (e) {
          // Remove entradas corrompidas
          localStorage.removeItem(key);
          removed++;
        }
      });

      if (removed > 0) {
        console.log(`🧹 Cache limpo: ${removed} entradas antigas removidas`);
      }

      // Atualiza estatísticas
      cacheStats.value.size = keys.length - removed;

    } catch (e) {
      console.warn('Erro ao limpar cache:', e);
    }
  };

  // Cache para a sessão atual (não persiste entre recargas)
  const sessionCache = new Map();

  // Cache de sessão para chunks sendo processados
  const cacheSessionChunk = (sessionId, chunkIndex, data) => {
    const key = `${sessionId}_${chunkIndex}`;
    sessionCache.set(key, {
      ...data,
      timestamp: Date.now()
    });
  };

  const getSessionChunk = (sessionId, chunkIndex) => {
    const key = `${sessionId}_${chunkIndex}`;
    return sessionCache.get(key);
  };

  // Limpar cache da sessão
  const clearSessionCache = (sessionId = null) => {
    if (sessionId) {
      const keysToDelete = Array.from(sessionCache.keys()).filter(key =>
        key.startsWith(sessionId)
      );
      keysToDelete.forEach(key => sessionCache.delete(key));
    } else {
      sessionCache.clear();
    }
  };

  // Estatísticas do cache
  const getCacheStats = () => {
    const localStorageSize = Object.keys(localStorage)
      .filter(key => key.startsWith('transcription_chunk_'))
      .length;

    return {
      ...cacheStats.value,
      size: localStorageSize,
      sessionSize: sessionCache.size,
      hitRate: cacheStats.value.hits + cacheStats.value.misses > 0
        ? (cacheStats.value.hits / (cacheStats.value.hits + cacheStats.value.misses) * 100).toFixed(1)
        : 0
    };
  };

  // Limpar todo o cache
  const clearAllCache = () => {
    const keys = Object.keys(localStorage).filter(key =>
      key.startsWith('transcription_chunk_')
    );

    keys.forEach(key => localStorage.removeItem(key));
    sessionCache.clear();

    cacheStats.value = {
      hits: 0,
      misses: 0,
      size: 0,
      savedAPICalls: 0
    };

    console.log(`🗑️ Cache completamente limpo: ${keys.length} entradas removidas`);
  };

  // Auto-limpeza na inicialização
  cleanOldCache();

  return {
    cacheEnabled,
    cacheStats,
    cacheChunk,
    getCachedChunk,
    cleanOldCache,
    cacheSessionChunk,
    getSessionChunk,
    clearSessionCache,
    getCacheStats,
    clearAllCache
  };
}