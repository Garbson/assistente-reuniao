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
      timestamp_granularities = null, // Para verbose_json
  filename = 'audio.webm' // Nome do arquivo (com extensão)
    } = options;

    try {
  const fileSizeMB = audioBlob.size / (1024 * 1024);
      console.log(`🎤 Enviando para OpenAI Whisper: ${fileSizeMB.toFixed(1)}MB`);
      console.log(`🔧 Modelo: ${model}`);
      console.log(`🔧 Tipo MIME: ${audioBlob.type}`);
      console.log(`🔧 Nome do arquivo: ${filename}`);

      // Valida tamanho do arquivo (OpenAI permite até 25MB)
      if (fileSizeMB > 25) {
        throw new Error('Arquivo muito grande (máx: 25MB)');
      }

      // Preparação de blob e nome finais (permite alterar caso haja transcode)
      let uploadBlob = audioBlob;
      let uploadFilename = filename;

      // Para maior compatibilidade com o endpoint, convertemos webm/ogg para WAV PCM 16khz mono
      // Isso evita falhas quando o container WebM é composto por sub-blobs concatenados.
      try {
        if (uploadBlob.type && (uploadBlob.type.startsWith('audio/webm') || uploadBlob.type.startsWith('audio/ogg'))) {
          console.log('🔁 Convertendo para WAV (PCM 16kHz mono) para compatibilidade...');
          uploadBlob = await this._transcodeToWav(uploadBlob, 16000);
          // Ajusta extensão do arquivo
          uploadFilename = uploadFilename.replace(/\.[^.]+$/, '.wav');
          if (uploadFilename === filename) {
            // Se o nome original não tinha extensão reconhecida
            uploadFilename = 'audio.wav';
          }
          console.log(`✅ Transcode concluído: ${uploadBlob.type}, ${(uploadBlob.size / (1024 * 1024)).toFixed(1)}MB`);
        }
      } catch (txErr) {
        console.warn('⚠️ Falha ao converter para WAV. Enviando blob original:', txErr?.message || txErr);
        uploadBlob = audioBlob; // fallback
        uploadFilename = filename;
      }

      // Valida tipo MIME final (aceita variações com codecs)
      const isValidAudioType = uploadBlob.type && (
        uploadBlob.type.startsWith('audio/webm') ||
        uploadBlob.type.startsWith('audio/wav') ||
        uploadBlob.type.startsWith('audio/mp3') ||
        uploadBlob.type.startsWith('audio/mpeg') ||
        uploadBlob.type.startsWith('audio/mp4') ||
        uploadBlob.type.startsWith('audio/ogg') ||
        uploadBlob.type.startsWith('audio/m4a') ||
        uploadBlob.type.startsWith('audio/flac')
      );

      if (!isValidAudioType) {
        console.warn(`⚠️ Tipo MIME inválido ou ausente: ${uploadBlob.type}, corrigindo para webm`);
        uploadBlob = new Blob([uploadBlob], { type: 'audio/webm' });
        uploadFilename = uploadFilename.replace(/\.[^.]+$/, '.webm');
        console.log(`✅ Blob convertido para: ${uploadBlob.type}`);
      }

      // Prepara FormData para upload
      const formData = new FormData();
  formData.append('file', uploadBlob, uploadFilename);
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

  // -------- Helpers: Transcoding to WAV --------
  async _transcodeToWav(blob, targetSampleRate = 16000) {
    // Decode to AudioBuffer
    const audioBuffer = await this._decodeToAudioBuffer(blob);
    // Convert to mono and resample
    const mono = this._toMono(audioBuffer);
    const resampled = await this._resampleAudioBuffer(mono, targetSampleRate);
    // Encode to WAV PCM 16-bit
    const wavBlob = this._encodeWav(resampled);
    return wavBlob;
  }

  async _decodeToAudioBuffer(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext || window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API não disponível para decodificar áudio');
    }
    // Use AudioContext to decode
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      return audioBuffer;
    } finally {
      // Try to close context to release resources
      try { ctx.close(); } catch (_) {}
    }
  }

  _toMono(audioBuffer) {
    if (audioBuffer.numberOfChannels === 1) return audioBuffer;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const monoBuffer = new (window.AudioContext || window.webkitAudioContext)().createBuffer(1, length, sampleRate);
    const monoData = monoBuffer.getChannelData(0);
    const channels = audioBuffer.numberOfChannels;
    for (let ch = 0; ch < channels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        monoData[i] += data[i] / channels;
      }
    }
    return monoBuffer;
  }

  async _resampleAudioBuffer(audioBuffer, targetRate) {
    if (audioBuffer.sampleRate === targetRate && audioBuffer.numberOfChannels === 1 && audioBuffer.getChannelData) {
      return audioBuffer;
    }
    const channels = 1;
    const duration = audioBuffer.duration;
    const frameCount = Math.ceil(duration * targetRate);
    const offline = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(channels, frameCount, targetRate);
    const source = offline.createBufferSource();
    const buffer = audioBuffer; // always an AudioBuffer now
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    return rendered;
  }

  _encodeWav(audioBuffer) {
    const numOfChan = 1;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.getChannelData(0);
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this._writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
    view.setUint16(22, numOfChan, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numOfChan * 2, true); // ByteRate
    view.setUint16(32, numOfChan * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // data sub-chunk
    this._writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // PCM conversion
    this._floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
  }

  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  _floatTo16BitPCM(output, offset, input) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, input[i]));
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      output.setInt16(offset, s, true);
    }
  }
}