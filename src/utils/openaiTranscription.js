// OpenAI Whisper API integration
export class OpenAITranscription {
  constructor() {
    this.apiKey = null;
    this.baseUrl = 'https://api.openai.com/v1';
    this.organizationId = null;
    this.isInitialized = false;
  }

  async initialize(apiKey, organizationId = null) {
    if (!apiKey) {
      throw new Error('OpenAI API key é necessária');
    }

    this.apiKey = apiKey;
    this.organizationId = organizationId;

    try {
      console.log('🔑 Testando OpenAI API Key:', apiKey.substring(0, 20) + '...');
      console.log('🏢 Organization ID:', organizationId);

      // Testa a conexão com um ping simples
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      console.log('📡 Testando conexão com OpenAI...');
      const testResponse = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers
      });

      console.log('📊 Status da resposta:', testResponse.status);

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error('❌ Erro na resposta:', errorText);
        throw new Error(`Falha na autenticação OpenAI: ${testResponse.status} - ${errorText}`);
      }

      const models = await testResponse.json();
      console.log('✅ Modelos disponíveis:', models.data?.length || 0);

      this.isInitialized = true;
      console.log('✅ OpenAI Whisper inicializado com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao inicializar OpenAI:', error);
      throw new Error(`Falha na inicialização OpenAI: ${error.message}`);
    }
  }

  async transcribe(audioBlob, options = {}) {
    if (!this.isInitialized) {
      throw new Error('OpenAI não está inicializado. Chame initialize() primeiro.');
    }

    const {
      model = 'whisper-1',
      language = 'pt',
      temperature = 0.0,
      response_format = 'json',
      prompt = null,
      timestamp_granularities = null // Para verbose_json
    } = options;

    try {
      const fileSizeMB = audioBlob.size / (1024 * 1024);
      console.log(`🎤 Enviando para OpenAI Whisper: ${fileSizeMB.toFixed(1)}MB`);
      console.log(`🔧 Modelo: ${model}`);

      // Valida tamanho do arquivo (OpenAI permite até 25MB)
      if (fileSizeMB > 25) {
        throw new Error('Arquivo muito grande (máx: 25MB)');
      }

      // Prepara FormData para upload
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', model);
      formData.append('language', language);
      formData.append('temperature', temperature.toString());
      formData.append('response_format', response_format);

      if (prompt) {
        formData.append('prompt', prompt);
      }

      // Adiciona timestamp granularities para verbose_json
      if (response_format === 'verbose_json' && timestamp_granularities) {
        if (Array.isArray(timestamp_granularities)) {
          timestamp_granularities.forEach(granularity => {
            formData.append('timestamp_granularities[]', granularity);
          });
        } else {
          formData.append('timestamp_granularities[]', timestamp_granularities);
        }
      }

      // Prepara headers
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      // Faz a chamada para API
      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers,
        body: formData
      });

      console.log('📊 Status da transcrição:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro OpenAI:', errorText);

        let parsedError;
        try {
          parsedError = JSON.parse(errorText);
          console.error('📋 Detalhes do erro:', parsedError);
        } catch (e) {
          console.error('📋 Erro (texto):', errorText);
        }

        // Tratamento de erros específicos
        if (response.status === 401) {
          throw new Error('API key OpenAI inválida ou expirada');
        } else if (response.status === 413) {
          throw new Error('Arquivo muito grande (máx: 25MB)');
        } else if (response.status === 429) {
          throw new Error('Limite de rate excedido. Tente novamente em alguns minutos.');
        } else if (parsedError?.error?.code === 'insufficient_quota') {
          throw new Error('Cota insuficiente. Verifique seu plano e billing na OpenAI.');
        } else {
          throw new Error(`Erro OpenAI: ${response.status} - ${errorText}`);
        }
      }

      // Processa resposta baseada no formato solicitado
      let result;

      if (response_format === 'text') {
        // Para formato 'text', a resposta é texto puro
        result = await response.text();

        if (!result || !result.trim()) {
          throw new Error('Transcrição vazia retornada pelo OpenAI (text)');
        }

        console.log('✅ Transcrição OpenAI concluída (text)');
        console.log(`📝 Tamanho da transcrição: ${result.length} caracteres`);

        return result.trim();

      } else {
        // Para formatos JSON (json ou verbose_json)
        result = await response.json();

        if (response_format === 'verbose_json') {
          if (!result.text || !result.text.trim()) {
            throw new Error('Transcrição vazia retornada pelo OpenAI (verbose_json)');
          }

          console.log('✅ Transcrição OpenAI concluída (verbose_json)');
          console.log(`📝 Tamanho da transcrição: ${result.text.length} caracteres`);
          console.log(`🕒 Duração detectada: ${result.duration?.toFixed(1)}s`);
          console.log(`🎯 Segmentos: ${result.segments?.length || 0}`);
          console.log(`💬 Palavras: ${result.words?.length || 0}`);

          // Retorna o objeto completo para verbose_json
          return {
            text: result.text.trim(),
            language: result.language,
            duration: result.duration,
            segments: result.segments || [],
            words: result.words || []
          };
        } else {
          // Formato JSON padrão
          if (!result.text || !result.text.trim()) {
            throw new Error('Transcrição vazia retornada pelo OpenAI (json)');
          }

          console.log('✅ Transcrição OpenAI concluída (json)');
          console.log(`📝 Tamanho da transcrição: ${result.text.length} caracteres`);

          return result.text.trim();
        }
      }

    } catch (error) {
      console.error('❌ Erro na transcrição OpenAI:', error);
      throw error;
    }
  }

  // Método para listar modelos disponíveis
  async getAvailableModels() {
    if (!this.isInitialized) {
      throw new Error('OpenAI não está inicializado');
    }

    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar modelos: ${response.status}`);
      }

      const result = await response.json();
      const whisperModels = result.data.filter(model =>
        model.id.includes('whisper')
      );

      return whisperModels.map(model => ({
        id: model.id,
        name: model.id,
        description: `Modelo ${model.id}`
      }));
    } catch (error) {
      console.error('❌ Erro ao buscar modelos:', error);
      return [
        { id: 'whisper-1', name: 'Whisper-1', description: 'Modelo padrão OpenAI Whisper' }
      ];
    }
  }

  // Verifica se a API key está funcionando
  async testConnection() {
    try {
      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.organizationId) {
        headers['OpenAI-Organization'] = this.organizationId;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        headers
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Estima custo da transcrição
  estimateCost(audioDurationMinutes, model = 'whisper-1') {
    // OpenAI Whisper custa $0.006 por minuto
    const ratePerMinute = 0.006;
    const cost = ratePerMinute * audioDurationMinutes;

    return {
      model,
      durationMinutes: audioDurationMinutes,
      durationHours: (audioDurationMinutes / 60).toFixed(2),
      costUSD: cost.toFixed(4),
      costBRL: (cost * 5.5).toFixed(2) // Estimativa USD->BRL
    };
  }

  // Valida qualidade e características do chunk antes da transcrição
  async validateChunk(audioBlob, chunkIndex = 0) {
    const validation = {
      isValid: true,
      warnings: [],
      errors: [],
      metadata: {
        sizeMB: (audioBlob.size / (1024 * 1024)).toFixed(2),
        sizeBytes: audioBlob.size,
        type: audioBlob.type,
        chunkIndex
      }
    };

    try {
      // Validação de tamanho
      const sizeMB = audioBlob.size / (1024 * 1024);
      if (sizeMB > 25) {
        validation.isValid = false;
        validation.errors.push(`Chunk muito grande: ${sizeMB.toFixed(1)}MB (máx: 25MB)`);
      } else if (sizeMB > 24) {
        validation.warnings.push(`Chunk próximo do limite: ${sizeMB.toFixed(1)}MB`);
      }

      // Validação de tamanho mínimo
      if (sizeMB < 0.01) { // 10KB
        validation.warnings.push(`Chunk muito pequeno: ${sizeMB.toFixed(3)}MB - pode ter qualidade ruim`);
      }

      // Validação de tipo MIME
      const supportedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg'];
      if (audioBlob.type && !supportedTypes.includes(audioBlob.type)) {
        validation.warnings.push(`Tipo de áudio não testado: ${audioBlob.type}`);
      }

      // Validação básica de conteúdo (se possível)
      if (window.AudioContext || window.webkitAudioContext) {
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const audioContext = new AudioContextClass();

          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());

          validation.metadata.duration = audioBuffer.duration;
          validation.metadata.sampleRate = audioBuffer.sampleRate;
          validation.metadata.channels = audioBuffer.numberOfChannels;

          // Validação de duração
          if (audioBuffer.duration < 0.5) {
            validation.warnings.push(`Duração muito curta: ${audioBuffer.duration.toFixed(1)}s`);
          }

          if (audioBuffer.duration > 35) { // Whisper recomenda 30s
            validation.warnings.push(`Duração longa para chunk: ${audioBuffer.duration.toFixed(1)}s (ideal: 30s)`);
          }

          // Análise de amplitude média (detecta silêncio total)
          let totalAmplitude = 0;
          let sampleCount = 0;

          for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < Math.min(channelData.length, 44100 * 5); i += 100) { // Amostra 5s
              totalAmplitude += Math.abs(channelData[i]);
              sampleCount++;
            }
          }

          const avgAmplitude = totalAmplitude / sampleCount;
          validation.metadata.avgAmplitude = avgAmplitude;

          if (avgAmplitude < 0.001) {
            validation.warnings.push('Chunk parece conter apenas silêncio');
          }

          audioContext.close();

        } catch (audioError) {
          validation.warnings.push(`Não foi possível analisar o áudio: ${audioError.message}`);
        }
      }

      // Log de validação
      if (validation.errors.length > 0) {
        console.error(`❌ Chunk ${chunkIndex + 1} inválido:`, validation.errors);
      } else if (validation.warnings.length > 0) {
        console.warn(`⚠️ Chunk ${chunkIndex + 1} com avisos:`, validation.warnings);
      } else {
        console.log(`✅ Chunk ${chunkIndex + 1} validado com sucesso`);
      }

      return validation;

    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Erro na validação: ${error.message}`);
      return validation;
    }
  }

  // Método auxiliar para recuperar chunks com problemas
  async retryWithOptimizedSettings(audioBlob, originalOptions = {}, attempt = 1) {
    const optimizedOptions = { ...originalOptions };

    // Estratégias de otimização baseadas na tentativa
    switch (attempt) {
      case 2:
        optimizedOptions.temperature = 0.1; // Temperatura mais alta
        break;
      case 3:
        optimizedOptions.temperature = 0.2;
        optimizedOptions.prompt = null; // Remove prompt que pode estar causando problemas
        break;
      case 4:
        // Última tentativa: configurações mais permissivas
        optimizedOptions.temperature = 0.3;
        optimizedOptions.language = null; // Deixa o Whisper detectar
        optimizedOptions.prompt = null;
        break;
      default:
        break;
    }

    console.log(`🔄 Retry ${attempt} com configurações otimizadas:`, optimizedOptions);
    return await this.transcribe(audioBlob, optimizedOptions);
  }
}