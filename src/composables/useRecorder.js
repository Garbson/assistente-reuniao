import { onMounted, onUnmounted, ref } from 'vue';
import { OpenAITranscription } from '../utils/openaiTranscription.js';

// Composable OTIMIZADO: grava áudio do sistema + microfone e usa OpenAI Whisper + Gemini para transcrever e resumir
export function useRecorder() {
  const isRecording = ref(false);
  const isProcessing = ref(false);
  const transcript = ref('');
  const error = ref(null);
  const isSupported = ref(false);
  const hasAudio = ref(false);
  const audioBlob = ref(null);

  // Estados para progress tracking
  const chunkProgress = ref({
    isProcessingChunks: false,
    currentChunk: 0,
    totalChunks: 0,
    currentPhase: '', // 'splitting', 'transcribing', 'merging'
    chunkDetails: [],
    estimatedTimeRemaining: 0,
    startTime: null
  });

  // Estado da captura de áudio
  const audioCaptureType = ref('unknown'); // 'system', 'microfone', 'hybrid', 'unknown'
  const isCapturingFullMeeting = ref(false); // true se capturando áudio de todos
  const audioSources = ref([]); // fontes disponíveis

  // Detalhes específicos da captura
  const isCapturingInput = ref(false); // microfone/entrada
  const isCapturingOutput = ref(false); // sistema/saída
  const audioQuality = ref({ input: 0, output: 0 }); // níveis de áudio detectados
  const detectedMeetingApp = ref(''); // Teams, Meet, Zoom detectado


  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let removeElectronListener = null;
  // Configurações de API - Whisper como prioridade
  const GEMINI_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
  let OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || localStorage.getItem('openai_api_key') || '';
  let OPENAI_ORG_ID = localStorage.getItem('openai_org_id') || null;

  let openaiTranscription = null;
  let audioAnalyzer = null;
  let analysisInterval = null;

  const checkSupport = () => {
    isSupported.value = !!(navigator.mediaDevices && window.MediaRecorder);
    if (!isSupported.value) error.value = 'Captura de áudio não suportada neste ambiente.';
    return isSupported.value;
  };

  // Função SEGURA para analisar qualidade do áudio em tempo real
  const analyzeAudioStream = (stream) => {
    // DESABILITADO TEMPORARIAMENTE para evitar crashes
    console.log('🔊 Análise de áudio DESABILITADA (evitando crashes)');
    return;

  };

  // Função para parar análise
  const stopAudioAnalysis = () => {
    if (analysisInterval) {
      clearInterval(analysisInterval);
      analysisInterval = null;
    }
    if (audioAnalyzer) {
      audioAnalyzer.audioContext.close();
      audioAnalyzer = null;
    }
  };

  // Função para detectar aplicativo de reunião ativo
  const detectMeetingApp = async () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();

    // Detecta por URL (quando executado em browser)
    if (currentUrl.includes('teams.microsoft.com') || currentUrl.includes('teams.live.com')) {
      detectedMeetingApp.value = 'Microsoft Teams';
      return 'teams';
    } else if (currentUrl.includes('meet.google.com')) {
      detectedMeetingApp.value = 'Google Meet';
      return 'meet';
    } else if (currentUrl.includes('zoom.us')) {
      detectedMeetingApp.value = 'Zoom';
      return 'zoom';
    }

    // Detecta por título da janela (quando executado em Electron)
    if (window.electronAPI && window.electronAPI.getMeetingDebug) {
      try {
        const debug = await window.electronAPI.getMeetingDebug();
        const title = debug.lastMeetingTitle?.toLowerCase() || '';

        if (title.includes('teams') || title.includes('microsoft teams')) {
          detectedMeetingApp.value = 'Microsoft Teams';
          return 'teams';
        } else if (title.includes('meet') || title.includes('google meet')) {
          detectedMeetingApp.value = 'Google Meet';
          return 'meet';
        } else if (title.includes('zoom')) {
          detectedMeetingApp.value = 'Zoom';
          return 'zoom';
        }
      } catch (error) {
        console.warn('Falha ao detectar app de reunião:', error);
      }
    }

    return 'unknown';
  };

  // Variáveis para streams separados (como Notion)
  let microphoneStream = null;
  let systemAudioStream = null;
  let audioContext = null;

  const startRecording = async () => {
    if (!checkSupport() || isRecording.value) return;
    console.log('🎬 Iniciando captura: system(loopback) + microfone');
    try {
      // Captura do sistema (mantém lógica atual funcionando) – prioriza handler loopback do preload
      let systemStream = null;
      if (window.electronAPI?.captureSystemAudio) {
        try {
          const s = await window.electronAPI.captureSystemAudio();
          if (s && typeof s.getAudioTracks === 'function' && s.getAudioTracks().length) {
            systemStream = s;
            console.log('🖥️ Loopback OK:', s.getAudioTracks()[0].label);
          }
        } catch (e) {
          console.warn('⚠️ loopback falhou:', e.message);
        }
      }
      // Tentativa 1: somente áudio (ideal para handler)
      if (!systemStream) {
        try {
          console.log('🧪 Tentativa 1: getDisplayMedia({audio:true, video:false})');
          const pureAudio = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false });
          if (pureAudio.getAudioTracks().length) {
            systemStream = pureAudio;
            console.log('�️ System audio (pure) OK:', systemStream.getAudioTracks()[0].label);
          } else {
            pureAudio.getTracks().forEach(t => t.stop());
          }
        } catch (e) {
          console.warn('⚠️ Tentativa 1 falhou:', e.message);
        }
      }
      if (!systemStream) {
        console.log('�🔄 Fallback loopback via getDisplayMedia...');
        try {
          const fallback = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          fallback.getVideoTracks().forEach(t => { t.stop(); fallback.removeTrack(t); });
          if (fallback.getAudioTracks().length) {
            systemStream = fallback;
            console.log('🖥️ Fallback system OK:', systemStream.getAudioTracks()[0].label);
          }
        } catch (e) {
          console.warn('⚠️ getDisplayMedia sem system audio:', e.message);
        }
      }
      if (!systemStream) {
        console.warn('❌ Nenhum áudio do sistema obtido após todas as tentativas. Prosseguindo só com microfone.');
      }

      // Captura microfone
      try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log('🎤 Microfone OK:', microphoneStream.getAudioTracks()[0]?.label);
        isCapturingInput.value = true;
      } catch (e) {
        console.warn('⚠️ Microfone indisponível:', e.message);
        microphoneStream = null;
      }

      if (systemStream) {
        systemAudioStream = systemStream;
        isCapturingOutput.value = true;
        // Heurística: alguns ambientes retornam track do próprio mic como "default" / "communications" quando loopback falha
        const label = systemStream.getAudioTracks()[0]?.label?.toLowerCase() || '';
        if (label && (label.includes('microphone') || label.includes('mic') || label.includes('input'))) {
          console.warn('⚠️ A track de "system" parece ser microfone (label heurística).');
        }
      }

      if (!systemAudioStream && !microphoneStream) {
        error.value = 'Nenhuma fonte de áudio disponível';
        return;
      }

      let finalStream;
      if (systemAudioStream && microphoneStream) {
        audioCaptureType.value = 'hybrid';
        isCapturingFullMeeting.value = true;
        finalStream = await mixStreamsHybrid(microphoneStream, systemAudioStream);
        console.log('✅ Híbrido ativo (mix system + mic)');
      } else if (systemAudioStream) {
        audioCaptureType.value = 'system';
        isCapturingFullMeeting.value = true;
        finalStream = systemAudioStream;
        console.log('🎧 Apenas system audio');
      } else {
        audioCaptureType.value = 'microphone';
        isCapturingFullMeeting.value = false;
        finalStream = microphoneStream;
        console.log('🎤 Apenas microfone');
      }

      await setupRecording(finalStream);
    } catch (e) {
      console.error('❌ Erro na captura combinada:', e);
      await cleanupStreams();
      throw e;
    }
  };

  // Função para limpar recursos
  const cleanupStreams = async () => {
    console.log('🧹 Limpando streams...');

    stopAudioAnalysis();

    if (microphoneStream) {
      microphoneStream.getTracks().forEach(track => track.stop());
      microphoneStream = null;
    }

    if (systemAudioStream) {
      systemAudioStream.getTracks().forEach(track => track.stop());
      systemAudioStream = null;
    }

    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close();
      audioContext = null;
    }

    resetCaptureState();
  };

  // Mixagem híbrida (microfone + sistema) com Web Audio
  const mixStreamsHybrid = async (micStream, sysStream) => {
    try {
      if (!micStream || !sysStream) return micStream || sysStream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('⚠️ AudioContext indisponível, usando fallback simples.');
        // Fallback: junta tracks em novo MediaStream (se suportado)
        const merged = new MediaStream();
        micStream.getAudioTracks().forEach(t => merged.addTrack(t));
        sysStream.getAudioTracks().forEach(t => merged.addTrack(t));
        return merged;
      }

      audioContext = new AudioContextClass({ latencyHint: 'interactive' });
      const destination = audioContext.createMediaStreamDestination();

      const micSource = audioContext.createMediaStreamSource(micStream);
      const sysSource = audioContext.createMediaStreamSource(sysStream);

      // Ganhos equilibrados (sistema normalmente já vem mais alto)
      const micGain = audioContext.createGain();
      const sysGain = audioContext.createGain();
      micGain.gain.value = 1.2; // Leve boost no microfone
      sysGain.gain.value = 0.9; // Leve redução no sistema

      micSource.connect(micGain).connect(destination);
      sysSource.connect(sysGain).connect(destination);

      console.log('🔗 Mixagem híbrida criada (mic + system)');
      return destination.stream;
    } catch (e) {
      console.error('❌ Falha na mixagem híbrida:', e.message);
      // Fallback: retorna system se existir, senão mic
      return sysStream || micStream;
    }
  };

  // Função simplificada para configurar MediaRecorder (método Notion)
  const setupRecording = async (stream) => {
    try {
      if (!stream || stream.getAudioTracks().length === 0) {
        throw new Error('Stream de áudio inválido');
      }

      console.log('🎬 Configurando gravação (tipo:', audioCaptureType.value, ')...');

      // MIME type simples e compatível
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      // MediaRecorder SIMPLES como Notion
      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000  // Qualidade padrão
      });

      // Reset estado
      audioChunks = [];
      transcript.value = '';
      audioBlob.value = null;
      hasAudio.value = false;
      error.value = null;
      startTime = new Date();

      // Event handlers SIMPLES
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        console.log('🛑 Finalizando gravação...');

        if (audioChunks.length > 0) {
          audioBlob.value = new Blob(audioChunks, { type: mimeType });
          hasAudio.value = true;
          console.log(`✅ Gravação finalizada: ${(audioBlob.value.size / 1024 / 1024).toFixed(2)}MB`);
        }

        isRecording.value = false;
        stopAudioAnalysis();

        // Parar stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onerror = (e) => {
        console.error('❌ Erro na gravação:', e.error);
        error.value = `Erro na gravação: ${e.error?.message || 'Desconhecido'}`;
        isRecording.value = false;
      };

      // Iniciar gravação (método Notion)
      mediaRecorder.start(1000); // Chunks de 1 segundo
      isRecording.value = true;

      console.log('✅ Gravação iniciada com sucesso (método Notion)!');

    } catch (setupError) {
      console.error('❌ Erro ao configurar gravação:', setupError.message);
      error.value = `Erro ao configurar gravação: ${setupError.message}`;
      isRecording.value = false;
      throw setupError;
    }
  };

  const stopRecording = async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    await cleanupStreams();
  };

  const clearTranscript = () => {
    transcript.value = '';
    error.value = null;
  };

  const getRecordingDuration = () => {
    if (!startTime) return 0;
    return Math.floor((new Date() - startTime) / 1000);
  };

  const transcribeAudio = async () => {
    if (!audioBlob.value) throw new Error('Nenhum áudio disponível.');
    isProcessing.value = true;
    error.value = null;

    try {
      const fileSizeMB = audioBlob.value.size / (1024 * 1024);
      const durationMinutes = getRecordingDuration() / 60;

      console.log(`🎵 Processando áudio: ${fileSizeMB.toFixed(1)}MB, ${durationMinutes.toFixed(1)} minutos`);

      // Usa OpenAI Whisper como método principal
      if (OPENAI_API_KEY) {
        try {
          // Inicializa OpenAI se necessário
          if (!openaiTranscription) {
            openaiTranscription = new OpenAITranscription();
            await openaiTranscription.initialize(OPENAI_API_KEY, OPENAI_ORG_ID);
          }

          console.log('🚀 Usando OpenAI Whisper (oficial)');

          // Para arquivos grandes, usa chunking otimizado do Whisper
          // Baseado na documentação oficial: modelos são robustos mas podem alucinar em áudios longos
          if (fileSizeMB > 20 || durationMinutes > 25) {
            console.log('📦 Arquivo grande detectado, processando em chunks otimizados (recomendação oficial Whisper)...');
            return await transcribeAudioInChunksWhisper();
          }

          // Para arquivos menores, usa método direto
          const transcriptText = await openaiTranscription.transcribe(audioBlob.value, {
            model: 'whisper-1',
            language: 'pt',
            temperature: 0.0,
            prompt: 'Transcrição de reunião corporativa em português brasileiro. Incluir nomes próprios e termos técnicos. Evitar alucinações - transcrever apenas o que é efetivamente falado.'
          });

          transcript.value = transcriptText;
          console.log('✅ Transcrição OpenAI concluída!');
          return transcriptText;

        } catch (openaiError) {
          console.warn('⚠️ Falha no OpenAI, tentando Gemini como fallback:', openaiError.message);

          // Tratamento específico para diferentes erros de API
          if (openaiError.message.includes('quota') || openaiError.message.includes('insufficient_quota')) {
            error.value = 'Cota da API OpenAI excedida. Configure uma nova chave ou tente mais tarde.';
          } else if (openaiError.message.includes('API key')) {
            error.value = 'Chave da API OpenAI inválida. Verifique sua configuração.';
          } else if (openaiError.message.includes('rate')) {
            error.value = 'Limite de rate da OpenAI excedido. Aguarde alguns minutos.';
          }

          // Continua para Gemini como fallback
        }
      }

      // Fallback: Usa Gemini se Groq falhar ou não estiver configurado
      console.log('📱 Usando Gemini como fallback...');

      // Para arquivos muito grandes, usa chunks
      if (fileSizeMB > 10 || durationMinutes > 15) {
        console.log('📦 Arquivo grande detectado, processando em chunks...');
        return await transcribeAudioInChunks();
      }

      // Para arquivos menores, usa método direto com Gemini
      const base64Audio = await blobToBase64(audioBlob.value);
      const prompt = `Você receberá o áudio de uma reunião corporativa. Faça apenas a transcrição completa e fiel em português do Brasil, corrigindo erros de dicção óbvios e removendo muletas ("éé", "ahn", "tipo"). Mantenha todos os nomes citados. Retorne apenas o texto transcrito, sem formatação adicional ou comentários.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: audioBlob.value.type || 'audio/webm', data: base64Audio } }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro Gemini:', errorText);

        // Tratamento específico para erros do Gemini
        if (response.status === 400 && errorText.includes('API key not valid')) {
          throw new Error('Chave da API Google (Gemini) inválida. Verifique sua configuração no .env');
        } else if (response.status === 429) {
          throw new Error('Limite de rate do Gemini excedido. Tente novamente em alguns minutos.');
        } else if (response.status === 403) {
          throw new Error('Acesso negado à API Gemini. Verifique as permissões da sua chave.');
        } else {
          throw new Error(`Falha na transcrição Gemini: ${response.status} - ${errorText}`);
        }
      }

      const result = await response.json();
      const transcriptText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!transcriptText || !transcriptText.trim()) {
        throw new Error('Transcrição vazia retornada.');
      }

      transcript.value = transcriptText;
      console.log('✅ Transcrição Gemini concluída');
      return transcriptText;

    } catch (e) {
      console.error('❌ Erro na transcrição:', e);
      error.value = e.message;
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  // Nova função de chunking otimizada para Whisper com timestamps precisos
  const transcribeAudioInChunksWhisper = async () => {
    try {
      console.log('🔄 Processando áudio longo com chunks otimizados para Whisper...');

      // Chunks de 30 segundos conforme recomendação do Whisper
      const CHUNK_DURATION_SECONDS = 30;
      const OVERLAP_SECONDS = 5; // Overlap de 5s para melhor continuidade

      // Inicializa progress tracking
      initializeChunkProgress(0, 'splitting');

      const result = await splitAudioIntoOptimizedChunks(audioBlob.value, CHUNK_DURATION_SECONDS, OVERLAP_SECONDS);
      const chunks = result.chunks || result; // Compatibilidade com retorno antigo
      const metadata = result.metadata || [];

      console.log(`📦 Dividido em ${chunks.length} chunks de 30s com overlap de 5s`);

      // Atualiza progress com total de chunks
      chunkProgress.value.totalChunks = chunks.length;
      updateChunkProgress(0, 'transcribing');

      let fullTranscript = '';
      let transcriptSegments = []; // Para tracking detalhado
      let previousContext = '';
      const processedChunks = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkMeta = metadata[i] || { startTime: i * (CHUNK_DURATION_SECONDS - OVERLAP_SECONDS), endTime: (i + 1) * (CHUNK_DURATION_SECONDS - OVERLAP_SECONDS) };
        const chunkSizeMB = chunk.size / (1024 * 1024);

        console.log(`📤 Processando chunk ${i + 1}/${chunks.length} (${chunkSizeMB.toFixed(1)}MB)`);
        console.log(`⏱️ Tempo: ${chunkMeta.startTime?.toFixed(1)}s - ${chunkMeta.endTime?.toFixed(1)}s`);

        let chunkResult = null;
        let retryCount = 0;
        const maxRetries = 3;

        // Sistema de retry robusto com validação
        while (!chunkResult && retryCount < maxRetries) {
          try {
            // Validação do chunk antes da transcrição
            if (retryCount === 0) { // Só valida na primeira tentativa
              const validation = await openaiTranscription.validateChunk(chunk, i);
              if (!validation.isValid) {
                throw new Error(`Chunk inválido: ${validation.errors.join(', ')}`);
              }
              if (validation.warnings.length > 0) {
                console.warn(`⚠️ Chunk ${i + 1} com avisos:`, validation.warnings);
              }
            }

            // Prompt contextual inteligente
            const contextualPrompt = buildContextualPrompt(i, previousContext, chunkMeta);

            const transcriptionOptions = {
              model: 'whisper-1',
              language: 'pt',
              temperature: retryCount * 0.1, // Aumenta temperatura em retries
              response_format: 'verbose_json', // Para timestamps precisos
              prompt: contextualPrompt,
              timestamp_granularities: ['segment'] // Para obter timestamps de segmentos
            };

            // Se for retry, usa método otimizado
            const chunkTranscript = retryCount === 0
              ? await openaiTranscription.transcribe(chunk, transcriptionOptions)
              : await openaiTranscription.retryWithOptimizedSettings(chunk, transcriptionOptions, retryCount + 1);

            chunkResult = {
              text: typeof chunkTranscript === 'string' ? chunkTranscript : chunkTranscript.text,
              segments: chunkTranscript.segments || [],
              rawResponse: chunkTranscript,
              metadata: chunkMeta,
              retryCount
            };

            processedChunks.push(chunkResult);
            console.log(`✅ Chunk ${i + 1} processado (tentativa ${retryCount + 1})`);

            // Atualiza progress tracking
            updateChunkProgress(i + 1, 'transcribing', {
              status: 'success',
              sizeMB: chunkSizeMB,
              duration: chunkMeta.endTime - chunkMeta.startTime,
              retryCount
            });

          } catch (chunkError) {
            retryCount++;
            console.warn(`⚠️ Chunk ${i + 1} falhou (tentativa ${retryCount}/${maxRetries}):`, chunkError.message);

            if (retryCount >= maxRetries) {
              console.error(`❌ Chunk ${i + 1} falhou após ${maxRetries} tentativas`);
              chunkResult = {
                text: `[Erro na transcrição do segmento ${i + 1} - tempo ${chunkMeta.startTime?.toFixed(1)}s-${chunkMeta.endTime?.toFixed(1)}s]`,
                segments: [],
                error: chunkError.message,
                metadata: chunkMeta,
                retryCount
              };
              processedChunks.push(chunkResult);

              // Atualiza progress tracking para erro
              updateChunkProgress(i + 1, 'transcribing', {
                status: 'error',
                error: chunkError.message,
                retryCount
              });
            } else {
              // Aguarda antes de retry
              await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
          }
        }

        // Processa o resultado do chunk
        if (chunkResult && chunkResult.text) {
          let processedText = chunkResult.text.trim();

          // Remove overlap usando timestamps quando disponível
          if (i > 0 && chunkResult.segments && processedChunks[i - 1]?.segments) {
            processedText = removeOverlapUsingTimestamps(
              processedText,
              chunkResult.segments,
              processedChunks[i - 1],
              OVERLAP_SECONDS
            );
          } else if (i > 0 && fullTranscript) {
            // Fallback para remoção de overlap simples
            processedText = removeSimpleOverlap(processedText, fullTranscript);
          }

          // Adiciona ao transcript final
          if (fullTranscript && processedText.trim()) {
            fullTranscript += ' ';
          }
          fullTranscript += processedText;

          // Atualiza contexto para próximo chunk
          previousContext = extractContextForNextChunk(fullTranscript, processedText);

          // Tracking detalhado
          transcriptSegments.push({
            chunkIndex: i,
            startTime: chunkMeta.startTime,
            endTime: chunkMeta.endTime,
            text: processedText,
            originalLength: chunkResult.text.length,
            processedLength: processedText.length,
            hadSilenceCut: chunkMeta.hasSilenceCut || false,
            retryCount: chunkResult.retryCount
          });
        }

        // Rate limiting inteligente
        if (i < chunks.length - 1) {
          const delay = retryCount > 0 ? 1000 : 500;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (!fullTranscript.trim()) {
        throw new Error('Nenhuma transcrição foi obtida dos chunks após todas as tentativas.');
      }

      // Log de estatísticas finais
      const successfulChunks = processedChunks.filter(c => !c.error).length;
      const totalRetries = processedChunks.reduce((sum, c) => sum + c.retryCount, 0);
      const silenceCuts = transcriptSegments.filter(s => s.hadSilenceCut).length;

      // Finaliza progress tracking
      updateChunkProgress(chunks.length, 'merging');

      console.log(`✅ Transcrição em chunks finalizada:`);
      console.log(`   📊 Chunks processados: ${successfulChunks}/${chunks.length}`);
      console.log(`   🔄 Total de retries: ${totalRetries}`);
      console.log(`   🔇 Cortes em silêncio: ${silenceCuts}`);
      console.log(`   📝 Tamanho final: ${fullTranscript.length} caracteres`);

      transcript.value = fullTranscript;
      finalizeChunkProgress();

      // Armazena metadata para debugging se necessário
      if (window.DEBUG_CHUNKS) {
        window.lastChunkingResult = {
          segments: transcriptSegments,
          chunks: processedChunks,
          fullTranscript
        };
      }

      return fullTranscript;

    } catch (e) {
      console.error('❌ Erro ao processar áudio em chunks:', e);
      throw new Error(`Erro ao processar áudio longo: ${e.message}`);
    }
  };

  // Constrói prompt contextual inteligente
  const buildContextualPrompt = (chunkIndex, previousContext, metadata) => {
    if (chunkIndex === 0) {
      return 'Transcrição de reunião corporativa em português brasileiro. Incluir nomes próprios e termos técnicos. Evitar alucinações - transcrever apenas o que é efetivamente falado.';
    }

    const silenceInfo = metadata?.hasSilenceCut ? ' Este segmento foi cortado em uma pausa natural.' : '';
    const timeInfo = metadata?.startTime ? ` Segmento iniciando em ${metadata.startTime.toFixed(1)}s.` : '';

    return `Continuação da reunião corporativa.${timeInfo}${silenceInfo} Contexto anterior: "${previousContext}". Manter consistência de nomes, termos técnicos e estilo de linguagem.`;
  };

  // Remove overlap usando informações de timestamp
  const removeOverlapUsingTimestamps = (currentText, currentSegments, previousChunk, overlapSeconds) => {
    if (!currentSegments?.length || !previousChunk?.segments?.length) {
      return removeSimpleOverlap(currentText, previousChunk.text);
    }

    try {
      // Encontra palavras que provavelmente são overlap baseado no tempo
      const overlapThreshold = overlapSeconds * 0.8; // 80% do overlap real
      const wordsToRemove = currentSegments.filter(segment =>
        segment.start && segment.start < overlapThreshold
      );

      if (wordsToRemove.length > 0) {
        const firstNonOverlapIndex = currentSegments.findIndex(segment =>
          !segment.start || segment.start >= overlapThreshold
        );

        if (firstNonOverlapIndex > 0) {
          const remainingSegments = currentSegments.slice(firstNonOverlapIndex);
          const cleanedText = remainingSegments.map(s => s.text || '').join(' ').trim();

          console.log(`🧹 Overlap removido via timestamps: ${wordsToRemove.length} palavras`);
          return cleanedText || currentText;
        }
      }

      return currentText;
    } catch (e) {
      console.warn('⚠️ Erro ao remover overlap via timestamps, usando método simples:', e);
      return removeSimpleOverlap(currentText, previousChunk.text);
    }
  };

  // Remove overlap simples (fallback)
  const removeSimpleOverlap = (currentText, previousFullText) => {
    try {
      const currentWords = currentText.trim().split(/\s+/);
      const previousWords = previousFullText.trim().split(/\s+/);

      if (currentWords.length < 3 || previousWords.length < 5) {
        return currentText;
      }

      // Procura por sequências de 3-5 palavras que se repetem
      for (let overlapLength = Math.min(5, currentWords.length); overlapLength >= 3; overlapLength--) {
        const currentStart = currentWords.slice(0, overlapLength).join(' ').toLowerCase();
        const previousEnd = previousWords.slice(-overlapLength * 2).join(' ').toLowerCase();

        if (previousEnd.includes(currentStart)) {
          const cleaned = currentWords.slice(overlapLength).join(' ');
          if (cleaned.trim()) {
            console.log(`🧹 Overlap simples removido: ${overlapLength} palavras`);
            return cleaned;
          }
        }
      }

      return currentText;
    } catch (e) {
      console.warn('⚠️ Erro na remoção de overlap simples:', e);
      return currentText;
    }
  };

  // Extrai contexto para o próximo chunk
  const extractContextForNextChunk = (fullTranscript, lastProcessedText) => {
    try {
      // Pega últimas 15-20 palavras como contexto
      const allWords = fullTranscript.trim().split(/\s+/);
      const contextWords = allWords.slice(-20).join(' ');

      // Remove pontuação desnecessária para melhor matching
      return contextWords.replace(/[.,;:!?]/g, '').trim();
    } catch (e) {
      console.warn('⚠️ Erro ao extrair contexto:', e);
      return lastProcessedText.split(/\s+/).slice(-10).join(' ');
    }
  };

  // Função unificada de chunking para Gemini (fallback do Whisper)
  const transcribeAudioInChunks = async () => {
    const apiKey = GEMINI_API_KEY;

    try {
      console.log('🔄 Processando áudio longo com Gemini (chunks unificados)...');

      // Usa a mesma função otimizada, mas com chunks maiores para Gemini
      const CHUNK_DURATION_SECONDS = 10 * 60; // 10 minutos para Gemini
      const OVERLAP_SECONDS = 30; // 30s de overlap para Gemini

      const result = await splitAudioIntoOptimizedChunks(audioBlob.value, CHUNK_DURATION_SECONDS, OVERLAP_SECONDS);
      const chunks = result.chunks || result;
      const metadata = result.metadata || [];

      console.log(`📦 Dividido em ${chunks.length} chunks de 10min com overlap de 30s (Gemini)`);

      let fullTranscript = '';
      const basePrompt = `Você receberá parte do áudio de uma reunião corporativa. Faça apenas a transcrição completa e fiel em português do Brasil, corrigindo erros de dicção óbvios e removendo muletas ("éé", "ahn", "tipo"). Mantenha todos os nomes citados. Retorne apenas o texto transcrito, sem formatação adicional ou comentários.`;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkMeta = metadata[i] || { startTime: i * (CHUNK_DURATION_SECONDS - OVERLAP_SECONDS) };
        const chunkSizeMB = chunk.size / (1024 * 1024);

        console.log(`📤 Processando chunk ${i + 1}/${chunks.length} (${chunkSizeMB.toFixed(1)}MB) - Gemini`);

        let retryCount = 0;
        const maxRetries = 2;
        let chunkTranscript = '';

        // Sistema de retry para Gemini
        while (!chunkTranscript.trim() && retryCount < maxRetries) {
          try {
            const contextualPrompt = i === 0
              ? basePrompt
              : `${basePrompt} Este é um segmento de continuação da reunião (parte ${i + 1}/${chunks.length}).`;

            // Se chunk é muito grande, usar Files API
            if (chunkSizeMB > 10) {
              chunkTranscript = await transcribeChunkWithFilesAPI(chunk, contextualPrompt, apiKey, i + 1);
            } else {
              // Usar método inline para chunks menores
              const base64Audio = await blobToBase64(chunk);

              const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: contextualPrompt }, { inline_data: { mime_type: chunk.type || 'audio/webm', data: base64Audio } }] }],
                  generationConfig: {
                    temperature: 0.3 + (retryCount * 0.1),
                    maxOutputTokens: 8000
                  }
                })
              });

              if (!resp.ok) {
                const errorText = await resp.text();
                throw new Error(`Erro no chunk ${i + 1}: ${errorText}`);
              }

              const data = await resp.json();
              chunkTranscript = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
            }

            if (chunkTranscript.trim()) {
              console.log(`✅ Chunk ${i + 1} processado com Gemini (tentativa ${retryCount + 1})`);
            }

          } catch (chunkError) {
            retryCount++;
            console.warn(`⚠️ Chunk ${i + 1} falhou (tentativa ${retryCount}/${maxRetries}):`, chunkError.message);

            if (retryCount >= maxRetries) {
              chunkTranscript = `[Erro na transcrição do segmento ${i + 1} - tempo ${chunkMeta.startTime?.toFixed(0) || 'N/A'}s: ${chunkError.message}]`;
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }

        // Remove overlap simples para Gemini (sem timestamps detalhados)
        if (i > 0 && fullTranscript && chunkTranscript.trim()) {
          chunkTranscript = removeSimpleOverlap(chunkTranscript, fullTranscript);
        }

        if (fullTranscript && chunkTranscript.trim()) {
          fullTranscript += '\n\n';
        }
        fullTranscript += chunkTranscript.trim();

        // Rate limiting para Gemini
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      if (!fullTranscript.trim()) {
        throw new Error('Nenhuma transcrição foi obtida dos chunks após todas as tentativas.');
      }

      transcript.value = fullTranscript;
      console.log('✅ Transcrição Gemini unificada finalizada');
      return fullTranscript;

    } catch (e) {
      console.error('❌ Erro ao processar áudio em chunks (Gemini):', e);
      throw new Error(`Erro ao processar áudio longo: ${e.message}`);
    }
  };

  const transcribeChunkWithFilesAPI = async (chunk, prompt, apiKey, chunkNumber) => {
    try {
      // 1. Upload do chunk
      const uploadData = new FormData();
      uploadData.append('file', chunk, `audio_chunk_${chunkNumber}.webm`);

      const uploadResp = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
        method: 'POST',
        body: uploadData
      });

      if (!uploadResp.ok) {
        const errorText = await uploadResp.text();
        throw new Error(`Erro no upload do chunk: ${errorText}`);
      }

      const uploadResult = await uploadResp.json();
      const fileUri = uploadResult.file.uri;

      // 2. Aguardar processamento
      await waitForFileProcessing(fileUri, apiKey);

      // 3. Transcrever
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { file_data: { mime_type: chunk.type || 'audio/webm', file_uri: fileUri } }
            ]
          }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
        })
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Erro na transcrição do chunk: ${errorText}`);
      }

      const data = await resp.json();
      const transcriptText = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';

      // 4. Limpar arquivo
      try {
        await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileUri.split('/').pop()}?key=${apiKey}`, {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn(`⚠️ Não foi possível remover chunk temporário ${chunkNumber}:`, e);
      }

      return transcriptText;

    } catch (e) {
      throw new Error(`Erro ao processar chunk ${chunkNumber}: ${e.message}`);
    }
  };

  // Função otimizada para dividir áudio em chunks com detecção de silêncio inteligente
  const splitAudioIntoOptimizedChunks = async (audioBlob, chunkDurationSeconds, overlapSeconds) => {
    const chunks = [];
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const MAX_CHUNK_SIZE_MB = 24; // Limite de segurança (25MB - 1MB buffer)

    try {
      // Decodifica o áudio para obter informações precisas
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());

      const totalDurationSeconds = audioBuffer.duration;
      const sampleRate = audioBuffer.sampleRate;
      const numberOfChannels = audioBuffer.numberOfChannels;
      const effectiveChunkDuration = chunkDurationSeconds - overlapSeconds;

      console.log(`🎵 Áudio total: ${(totalDurationSeconds / 60).toFixed(1)} min, ${numberOfChannels} canais, ${sampleRate}Hz`);

      // Detecta pontos de silêncio para cortes inteligentes
      const silenceThreshold = 0.01; // Limiar de silêncio (ajustável)
      const minSilenceDuration = 0.3; // Mínimo 300ms de silêncio para considerar
      const silencePoints = await detectSilencePoints(audioBuffer, silenceThreshold, minSilenceDuration);

      console.log(`🔇 Encontrados ${silencePoints.length} pontos de silêncio para cortes inteligentes`);

      const targetChunks = Math.ceil(totalDurationSeconds / effectiveChunkDuration);
      const chunkMetadata = [];
      let currentStartTime = 0;

      for (let i = 0; i < targetChunks && currentStartTime < totalDurationSeconds; i++) {
        const idealEndTime = currentStartTime + chunkDurationSeconds;
        const maxEndTime = Math.min(idealEndTime + 5, totalDurationSeconds); // +5s tolerância

        // Encontra o melhor ponto de corte (silêncio) próximo ao tempo ideal
        let actualEndTime = Math.min(idealEndTime, totalDurationSeconds);

        if (i < targetChunks - 1) { // Não é o último chunk
          const bestSilencePoint = findBestSilencePoint(silencePoints, idealEndTime - 2, idealEndTime + 3);
          if (bestSilencePoint !== null) {
            actualEndTime = bestSilencePoint;
            console.log(`🎯 Chunk ${i + 1}: usando ponto de silêncio em ${actualEndTime.toFixed(1)}s`);
          }
        }

        // Cria o chunk de áudio usando Web Audio API para maior precisão
        const startSample = Math.floor(currentStartTime * sampleRate);
        const endSample = Math.floor(actualEndTime * sampleRate);
        const chunkLength = endSample - startSample;

        const chunkBuffer = audioContext.createBuffer(numberOfChannels, chunkLength, sampleRate);

        // Copia os dados de áudio para o novo buffer
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const sourceData = audioBuffer.getChannelData(channel);
          const chunkData = chunkBuffer.getChannelData(channel);
          for (let sample = 0; sample < chunkLength; sample++) {
            chunkData[sample] = sourceData[startSample + sample] || 0;
          }
        }

        // Converte o AudioBuffer de volta para blob
        const chunkBlob = await audioBufferToBlob(chunkBuffer, audioBlob.type);
        const chunkSizeMB = chunkBlob.size / (1024 * 1024);

        // Validação de tamanho
        if (chunkSizeMB > MAX_CHUNK_SIZE_MB) {
          console.warn(`⚠️ Chunk ${i + 1} muito grande (${chunkSizeMB.toFixed(1)}MB), reduzindo...`);
          // Reduz a duração em 10% e tenta novamente
          actualEndTime = currentStartTime + (actualEndTime - currentStartTime) * 0.9;
          const newEndSample = Math.floor(actualEndTime * sampleRate);
          const newChunkLength = newEndSample - startSample;

          const reducedBuffer = audioContext.createBuffer(numberOfChannels, newChunkLength, sampleRate);
          for (let channel = 0; channel < numberOfChannels; channel++) {
            const sourceData = audioBuffer.getChannelData(channel);
            const chunkData = reducedBuffer.getChannelData(channel);
            for (let sample = 0; sample < newChunkLength; sample++) {
              chunkData[sample] = sourceData[startSample + sample] || 0;
            }
          }

          const reducedBlob = await audioBufferToBlob(reducedBuffer, audioBlob.type);
          chunks.push(reducedBlob);

          console.log(`📦 Chunk ${i + 1}: ${currentStartTime.toFixed(1)}-${actualEndTime.toFixed(1)}s (${(reducedBlob.size / 1024 / 1024).toFixed(1)}MB) [REDUZIDO]`);
        } else {
          chunks.push(chunkBlob);
          console.log(`📦 Chunk ${i + 1}: ${currentStartTime.toFixed(1)}-${actualEndTime.toFixed(1)}s (${chunkSizeMB.toFixed(1)}MB)`);
        }

        // Metadata para tracking preciso
        chunkMetadata.push({
          index: i,
          startTime: currentStartTime,
          endTime: actualEndTime,
          duration: actualEndTime - currentStartTime,
          sizeMB: chunkBlob.size / (1024 * 1024),
          hasSilenceCut: silencePoints.some(p => Math.abs(p - actualEndTime) < 0.5)
        });

        // Próximo chunk inicia com overlap
        currentStartTime = Math.max(0, actualEndTime - overlapSeconds);
      }

      console.log(`✅ Dividido em ${chunks.length} chunks inteligentes com detecção de silêncio`);
      return { chunks, metadata: chunkMetadata };

    } catch (e) {
      console.error('❌ Erro ao dividir áudio com detecção de silêncio:', e);
      // Fallback: usa divisão simples por tamanho com limite de segurança
      const chunks = await createFallbackChunks(audioBlob, MAX_CHUNK_SIZE_MB);
      return { chunks, metadata: null };
    } finally {
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    }
  };

  // Função auxiliar para detectar pontos de silêncio
  const detectSilencePoints = async (audioBuffer, threshold, minDuration) => {
    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const minSilenceSamples = Math.floor(minDuration * sampleRate);
    const silencePoints = [];

    // Analisa em janelas de 100ms para detectar silêncio
    const windowSize = Math.floor(0.1 * sampleRate); // 100ms
    const totalSamples = audioBuffer.length;

    for (let start = 0; start < totalSamples - windowSize; start += windowSize) {
      let isSilent = true;
      let silentSamples = 0;

      // Verifica todas as amostras na janela
      for (let sample = start; sample < Math.min(start + windowSize * 5, totalSamples); sample++) {
        let amplitude = 0;

        // Calcula RMS (Root Mean Square) para todos os canais
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const channelData = audioBuffer.getChannelData(channel);
          amplitude += Math.abs(channelData[sample] || 0);
        }

        amplitude /= numberOfChannels;

        if (amplitude > threshold) {
          if (silentSamples >= minSilenceSamples) {
            // Encontrou um período de silêncio suficientemente longo
            const silenceTime = (start + silentSamples / 2) / sampleRate;
            silencePoints.push(silenceTime);
          }
          silentSamples = 0;
          isSilent = false;
        } else {
          silentSamples++;
        }
      }

      // Se terminou com silêncio, adiciona o ponto
      if (silentSamples >= minSilenceSamples) {
        const silenceTime = (start + silentSamples / 2) / sampleRate;
        silencePoints.push(silenceTime);
      }
    }

    return silencePoints.filter((point, index, arr) =>
      index === 0 || point - arr[index - 1] > 1.0 // Remove pontos muito próximos (< 1s)
    );
  };

  // Encontra o melhor ponto de silêncio dentro de uma janela de tempo
  const findBestSilencePoint = (silencePoints, minTime, maxTime) => {
    const candidatePoints = silencePoints.filter(point => point >= minTime && point <= maxTime);

    if (candidatePoints.length === 0) return null;

    // Retorna o ponto mais próximo do centro da janela
    const centerTime = (minTime + maxTime) / 2;
    return candidatePoints.reduce((best, current) =>
      Math.abs(current - centerTime) < Math.abs(best - centerTime) ? current : best
    );
  };

  // Converte AudioBuffer para Blob
  const audioBufferToBlob = async (audioBuffer, mimeType) => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // Cria um novo AudioContext para renderização
    const offlineContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      numberOfChannels, length, sampleRate
    );

    // Cria um buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start(0);

    // Renderiza o áudio
    const renderedBuffer = await offlineContext.startRendering();

    // Converte para WAV (mais compatível que webm para processamento)
    const wavBlob = audioBufferToWav(renderedBuffer);
    return wavBlob;
  };

  // Converte AudioBuffer para WAV blob
  const audioBufferToWav = (audioBuffer) => {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    const buffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);

    // Audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  };

  // Função de fallback para criar chunks simples
  const createFallbackChunks = async (audioBlob, maxSizeMB) => {
    const chunks = [];
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const chunkSize = Math.min(maxSizeBytes, Math.ceil(audioBlob.size / Math.ceil(audioBlob.size / maxSizeBytes)));

    for (let i = 0; i < audioBlob.size; i += chunkSize) {
      chunks.push(audioBlob.slice(i, Math.min(i + chunkSize, audioBlob.size), audioBlob.type));
    }

    console.log(`📦 Fallback: dividido em ${chunks.length} chunks simples de ~${(chunkSize / 1024 / 1024).toFixed(1)}MB`);
    return chunks;
  };

  const splitAudioIntoChunks = async (audioBlob, chunkDurationMs) => {
    const chunks = [];
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();

    try {
      // Decodifica o áudio para obter informações
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice());

      const totalDurationMs = audioBuffer.duration * 1000;
      const numChunks = Math.ceil(totalDurationMs / chunkDurationMs);

      console.log(`🎵 Áudio total: ${(totalDurationMs / 1000 / 60).toFixed(1)} min, dividindo em ${numChunks} chunks`);

      // Para simplificar, vamos dividir o blob original por tempo estimado
      // (método aproximado mas funcional)
      const bytesPerMs = audioBlob.size / totalDurationMs;

      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDurationMs;
        const endTime = Math.min(startTime + chunkDurationMs, totalDurationMs);

        const startByte = Math.floor(startTime * bytesPerMs);
        const endByte = Math.floor(endTime * bytesPerMs);

        const chunkBlob = audioBlob.slice(startByte, endByte, audioBlob.type);
        chunks.push(chunkBlob);

        console.log(`📦 Chunk ${i + 1}: ${(startTime / 1000 / 60).toFixed(1)}-${(endTime / 1000 / 60).toFixed(1)} min (${(chunkBlob.size / 1024 / 1024).toFixed(1)}MB)`);
      }

      return chunks;

    } catch (e) {
      console.error('❌ Erro ao dividir áudio:', e);
      // Fallback: retorna o áudio original se falhar a divisão
      return [audioBlob];
    } finally {
      audioContext.close();
    }
  };

  const waitForFileProcessing = async (fileUri, apiKey, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileUri.split('/').pop()}?key=${apiKey}`);
      const fileData = await resp.json();

      if (fileData.state === 'ACTIVE') {
        console.log('✅ Arquivo processado e pronto');
        return;
      } else if (fileData.state === 'FAILED') {
        throw new Error('Falha no processamento do arquivo');
      }

      console.log(`⏳ Aguardando processamento... (${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Aguarda 2s
    }

    throw new Error('Timeout no processamento do arquivo');
  };

  const generateSummaryFromTranscript = async () => {
    if (!transcript.value) throw new Error('Nenhuma transcrição disponível.');
    isProcessing.value = true;
    error.value = null;
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      if (!apiKey) throw new Error('Chave da API ausente (.env).');

      const prompt = `Você receberá a transcrição de uma reunião corporativa. Produza APENAS o JSON final (sem markdown, sem comentários) seguindo as regras abaixo rigorosamente.\n\nOBJETIVO: Gerar um RESUMO ESTRUTURADO com título inteligente e pontos principais organizados de forma direta e prática.\n\nREGRAS:\n1. titulo_reuniao: Crie um título descritivo e inteligente baseado no contexto da reunião (ex: "Mentoria de Desenvolvimento de Carreira", "Planejamento Sprint Q4", etc.)\n2. contexto_e_objetivo: Breve contexto da reunião e objetivo principal (1-2 frases).\n3. participantes: Array com TODOS os nomes mencionados na reunião. Se não houver nomes específicos, usar ["Participantes não identificados"].\n4. pontos_principais: Array de objetos com os tópicos específicos discutidos. QUEBRE EM SUBTÓPICOS MENORES E ESPECÍFICOS. Cada objeto deve ter:\n   - "subtitulo": nome/título específico do subtópico (ex: "Melhorar tela de login", "Código único de oferta", "Problema com autenticação", "Configurar servidor de desenvolvimento")\n   - "pontos_abordados": array com 2-4 pontos específicos do que foi falado sobre esse subtópico (ex: ["jesiel falou para mudar as cores do fundo", "ajustar as bordas para ficar mais arredondadas"])\n5. action_items: TODAS as ações mencionadas. Formato: { "descricao": "ação específica", "responsavel": "nome ou 'A definir'", "prazo": "prazo mencionado ou 'Não definido'", "concluida": false }\n6. decisoes_tomadas: Array com decisões concretas tomadas durante a reunião.\n7. proximos_passos: Próximas etapas estratégicas mencionadas.\n\nIMPORTANTE: Para os pontos_principais, QUEBRE EM MUITOS SUBTÓPICOS ESPECÍFICOS ao invés de poucos tópicos grandes. Cada subtópico deve ter entre 2-4 pontos abordados. Seja específico e direto. Capture exatamente o que foi dito, incluindo quem falou o quê. Use linguagem natural e direta.\n\nEXEMPLO CORRETO de pontos_principais (muitos subtópicos específicos):\n[\n  {\n    "subtitulo": "Cores da tela de login",\n    "pontos_abordados": [\n      "jesiel falou para mudar as cores do fundo",\n      "usar tons mais escuros"\n    ]\n  },\n  {\n    "subtitulo": "Bordas dos elementos",\n    "pontos_abordados": [\n      "ajustar as bordas para ficar mais arredondadas",\n      "aplicar border-radius de 8px"\n    ]\n  },\n  {\n    "subtitulo": "Tipografia dos botões",\n    "pontos_abordados": [\n      "revisar tipografia dos botões",\n      "usar fonte maior para melhor legibilidade"\n    ]\n  },\n  {\n    "subtitulo": "Localização do código único",\n    "pontos_abordados": [\n      "está presente no book",\n      "seguindo a documentação o código único já vem do book porém precisa achar ele"\n    ]\n  },\n  {\n    "subtitulo": "Verificação com backend",\n    "pontos_abordados": [\n      "verificar com o time de backend onde está localizado",\n      "agendar reunião para entender a estrutura"\n    ]\n  }\n]\n\nNÃO FAÇA subtópicos muito grandes com muitos pontos. PREFIRA vários subtópicos específicos e menores.\n\nFORMATO EXATO DO RETORNO (JSON ÚNICO):\n{\n  "titulo_reuniao": "...",\n  "contexto_e_objetivo": "...",\n  "participantes": ["..."],\n  "pontos_principais": [\n    {\n      "subtitulo": "...",\n      "pontos_abordados": ["...", "...", "..."]\n    }\n  ],\n  "action_items": [{"descricao": "...", "responsavel": "...", "prazo": "...", "concluida": false}],\n  "decisoes_tomadas": ["..."],\n  "proximos_passos": ["..."],\n  "formato_estruturado": true\n}\n\nTranscrição da reunião:\n${transcript.value}\n\nRetorne somente o JSON completo e detalhado no formato estruturado.`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 8000 }
        })
      });
      if (!resp.ok) throw new Error('Erro da API: ' + await resp.text());
      const data = await resp.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      console.log('🔍 Resposta bruta da IA (nova gravação):', raw);

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON não encontrado na resposta da IA.');
      const parsed = JSON.parse(match[0]);
      console.log('📋 JSON parsed (nova gravação):', parsed);

      // Suporte para formato estruturado (novo) e formato antigo (compatibilidade)
      if (parsed.formato_estruturado) {
        return {
          titulo_reuniao: parsed.titulo_reuniao || 'Reunião',
          contexto_e_objetivo: parsed.contexto_e_objetivo || '',
          participantes: parsed.participantes || ['Participantes não identificados'],
          pontos_principais: parsed.pontos_principais || [],
          action_items: parsed.action_items || [],
          decisoes_tomadas: parsed.decisoes_tomadas || [],
          proximos_passos: parsed.proximos_passos || [],
          data_reuniao: new Date().toISOString(),
          duracao_minutos: Math.round(getRecordingDuration() / 60 * 10) / 10,
          fonte: 'Transcrição via Whisper + Análise via Gemini',
          formato_estruturado: true
        };
      } else {
        // Formato antigo (compatibilidade)
        return {
          contexto: parsed.contexto || '',
          participantes: parsed.participantes || ['Participantes não identificados'],
          pontos_discutidos: parsed.pontos_discutidos || [],
          decisoes_tomadas: parsed.decisoes_tomadas || [],
          tarefas_e_acoes: parsed.tarefas_e_acoes || [],
          proximos_passos: parsed.proximos_passos || [],
          observacoes: parsed.observacoes || [],
          data_reuniao: new Date().toISOString(),
          duracao_minutos: Math.round(getRecordingDuration() / 60 * 10) / 10,
          fonte: 'Transcrição via Whisper + Análise via Gemini'
        };
      }
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  // Nova função para regenerar resumo de reuniões existentes no formato estruturado
  const regenerateSummaryWithNewFormat = async (transcriptText, originalDuration = 0) => {
    if (!transcriptText) throw new Error('Nenhuma transcrição fornecida.');
    isProcessing.value = true;
    error.value = null;

    try {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      if (!apiKey) throw new Error('Chave da API ausente (.env).');

      const prompt = `Você receberá a transcrição de uma reunião corporativa. Produza APENAS o JSON final (sem markdown, sem comentários) seguindo as regras abaixo rigorosamente.\n\nOBJETIVO: Gerar um RESUMO ESTRUTURADO com título inteligente e pontos principais organizados de forma direta e prática.\n\nREGRAS:\n1. titulo_reuniao: Crie um título descritivo e inteligente baseado no contexto da reunião (ex: "Mentoria de Desenvolvimento de Carreira", "Planejamento Sprint Q4", etc.)\n2. contexto_e_objetivo: Breve contexto da reunião e objetivo principal (1-2 frases).\n3. participantes: Array com TODOS os nomes mencionados na reunião. Se não houver nomes específicos, usar ["Participantes não identificados"].\n4. pontos_principais: Array de objetos com os tópicos específicos discutidos. QUEBRE EM SUBTÓPICOS MENORES E ESPECÍFICOS. Cada objeto deve ter:\n   - "subtitulo": nome/título específico do subtópico (ex: "Melhorar tela de login", "Código único de oferta", "Problema com autenticação", "Configurar servidor de desenvolvimento")\n   - "pontos_abordados": array com 2-4 pontos específicos do que foi falado sobre esse subtópico (ex: ["jesiel falou para mudar as cores do fundo", "ajustar as bordas para ficar mais arredondadas"])\n5. action_items: TODAS as ações mencionadas. Formato: { "descricao": "ação específica", "responsavel": "nome ou 'A definir'", "prazo": "prazo mencionado ou 'Não definido'", "concluida": false }\n6. decisoes_tomadas: Array com decisões concretas tomadas durante a reunião.\n7. proximos_passos: Próximas etapas estratégicas mencionadas.\n\nIMPORTANTE: Para os pontos_principais, QUEBRE EM MUITOS SUBTÓPICOS ESPECÍFICOS ao invés de poucos tópicos grandes. Cada subtópico deve ter entre 2-4 pontos abordados. Seja específico e direto. Capture exatamente o que foi dito, incluindo quem falou o quê. Use linguagem natural e direta.\n\nEXEMPLO CORRETO de pontos_principais (muitos subtópicos específicos):\n[\n  {\n    "subtitulo": "Cores da tela de login",\n    "pontos_abordados": [\n      "jesiel falou para mudar as cores do fundo",\n      "usar tons mais escuros"\n    ]\n  },\n  {\n    "subtitulo": "Bordas dos elementos",\n    "pontos_abordados": [\n      "ajustar as bordas para ficar mais arredondadas",\n      "aplicar border-radius de 8px"\n    ]\n  },\n  {\n    "subtitulo": "Tipografia dos botões",\n    "pontos_abordados": [\n      "revisar tipografia dos botões",\n      "usar fonte maior para melhor legibilidade"\n    ]\n  },\n  {\n    "subtitulo": "Localização do código único",\n    "pontos_abordados": [\n      "está presente no book",\n      "seguindo a documentação o código único já vem do book porém precisa achar ele"\n    ]\n  },\n  {\n    "subtitulo": "Verificação com backend",\n    "pontos_abordados": [\n      "verificar com o time de backend onde está localizado",\n      "agendar reunião para entender a estrutura"\n    ]\n  }\n]\n\nNÃO FAÇA subtópicos muito grandes com muitos pontos. PREFIRA vários subtópicos específicos e menores.\n\nFORMATO EXATO DO RETORNO (JSON ÚNICO):\n{\n  "titulo_reuniao": "...",\n  "contexto_e_objetivo": "...",\n  "participantes": ["..."],\n  "pontos_principais": [\n    {\n      "subtitulo": "...",\n      "pontos_abordados": ["...", "...", "..."]\n    }\n  ],\n  "action_items": [{"descricao": "...", "responsavel": "...", "prazo": "...", "concluida": false}],\n  "decisoes_tomadas": ["..."],\n  "proximos_passos": ["..."],\n  "formato_estruturado": true\n}\n\nTranscrição da reunião:\n${transcriptText}\n\nRetorne somente o JSON completo e detalhado no formato estruturado.`;

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 8000 }
        })
      });

      if (!resp.ok) throw new Error('Erro da API: ' + await resp.text());

      const data = await resp.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      console.log('🔍 Resposta bruta da IA (regeneração):', raw);

      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON não encontrado na resposta da IA.');
      const parsed = JSON.parse(match[0]);
      console.log('📋 JSON parsed (regeneração):', parsed);

      const result = {
        titulo_reuniao: parsed.titulo_reuniao || 'Reunião',
        contexto_e_objetivo: parsed.contexto_e_objetivo || '',
        participantes: parsed.participantes || ['Participantes não identificados'],
        pontos_principais: parsed.pontos_principais || [],
        action_items: parsed.action_items || [],
        decisoes_tomadas: parsed.decisoes_tomadas || [],
        proximos_passos: parsed.proximos_passos || [],
        data_reuniao: new Date().toISOString(),
        duracao_minutos: originalDuration,
        fonte: 'Regeneração: Transcrição via Whisper + Análise via Gemini',
        formato_estruturado: true,
        // Limpar campos do formato antigo para evitar conflitos
        pontos_discutidos: undefined,
        tarefas: undefined,
        tarefas_e_acoes: undefined,
        geral: undefined,
        observacoes: undefined
      };

      console.log('✅ Resultado final da regeneração:', result);
      return result;

    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };


  const setupElectronListener = () => {
    if (window.electronAPI && window.electronAPI.onStartRecording) {
      removeElectronListener = window.electronAPI.onStartRecording(() => {
        if (!isRecording.value) startRecording();
      });
    }
  };


  // Função para configurar a API key do OpenAI
  const setOpenAIApiKey = (apiKey, organizationId = null) => {
    if (apiKey && apiKey.trim()) {
      OPENAI_API_KEY = apiKey.trim();
      OPENAI_ORG_ID = organizationId;

      // Reset da instância para forçar reinicialização
      openaiTranscription = null;

      console.log('🔑 OpenAI API Key configurada');
      return true;
    }
    OPENAI_API_KEY = '';
    OPENAI_ORG_ID = null;
    openaiTranscription = null;
    return false;
  };

  // Função para testar conexão OpenAI
  const testOpenAIConnection = async (apiKey, organizationId = null) => {
    try {
      const testOpenAI = new OpenAITranscription();
      await testOpenAI.initialize(apiKey, organizationId);
      return await testOpenAI.testConnection();
    } catch (error) {
      console.error('❌ Teste OpenAI falhou:', error);
      return false;
    }
  };

  // Função para estimar custo (apenas OpenAI Whisper)
  const estimateTranscriptionCost = (durationMinutes) => {
    if (openaiTranscription) {
      return openaiTranscription.estimateCost(durationMinutes);
    }
    // Estimativa manual se a instância não estiver disponível
    const costUSD = durationMinutes * 0.006;
    return {
      model: 'whisper-1',
      durationMinutes,
      durationHours: (durationMinutes / 60).toFixed(2),
      costUSD: costUSD.toFixed(4),
      costBRL: (costUSD * 5.5).toFixed(2)
    };
  };

  // Função para resetar estado de captura
  const resetCaptureState = () => {
    audioCaptureType.value = 'unknown';
    isCapturingFullMeeting.value = false;
    audioSources.value = [];
    isCapturingInput.value = false;
    isCapturingOutput.value = false;
    audioQuality.value = { input: 0, output: 0 };
    stopAudioAnalysis();
  };

  // Funções para progress tracking
  const initializeChunkProgress = (totalChunks, phase = 'splitting') => {
    chunkProgress.value = {
      isProcessingChunks: true,
      currentChunk: 0,
      totalChunks,
      currentPhase: phase,
      chunkDetails: [],
      estimatedTimeRemaining: 0,
      startTime: Date.now()
    };
  };

  const updateChunkProgress = (currentChunk, phase = null, chunkDetail = null) => {
    if (phase) chunkProgress.value.currentPhase = phase;
    chunkProgress.value.currentChunk = currentChunk;

    if (chunkDetail) {
      chunkProgress.value.chunkDetails.push({
        index: currentChunk,
        timestamp: Date.now(),
        ...chunkDetail
      });
    }

    // Calcula tempo estimado restante
    if (currentChunk > 0 && chunkProgress.value.startTime) {
      const elapsed = Date.now() - chunkProgress.value.startTime;
      const avgTimePerChunk = elapsed / currentChunk;
      const remainingChunks = chunkProgress.value.totalChunks - currentChunk;
      chunkProgress.value.estimatedTimeRemaining = Math.round(avgTimePerChunk * remainingChunks / 1000); // em segundos
    }
  };

  const finalizeChunkProgress = () => {
    chunkProgress.value.isProcessingChunks = false;
    chunkProgress.value.currentPhase = 'completed';
    const totalTime = chunkProgress.value.startTime ? (Date.now() - chunkProgress.value.startTime) / 1000 : 0;
    console.log(`📊 Chunking finalizado em ${totalTime.toFixed(1)}s - ${chunkProgress.value.totalChunks} chunks processados`);
  };

  const getProgressPercentage = () => {
    if (!chunkProgress.value.isProcessingChunks || chunkProgress.value.totalChunks === 0) return 0;
    return Math.round((chunkProgress.value.currentChunk / chunkProgress.value.totalChunks) * 100);
  };

  const getProgressSummary = () => {
    const progress = chunkProgress.value;
    if (!progress.isProcessingChunks) return null;

    const phaseNames = {
      'splitting': 'Dividindo áudio',
      'transcribing': 'Transcrevendo',
      'merging': 'Finalizando',
      'completed': 'Concluído'
    };

    return {
      percentage: getProgressPercentage(),
      phase: phaseNames[progress.currentPhase] || progress.currentPhase,
      current: progress.currentChunk,
      total: progress.totalChunks,
      timeRemaining: progress.estimatedTimeRemaining,
      details: progress.chunkDetails.slice(-3) // Últimos 3 detalhes
    };
  };

  onMounted(() => {
    checkSupport();
    setupElectronListener();
  });

  onUnmounted(async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
    if (removeElectronListener) {
      removeElectronListener();
    }
    await cleanupStreams();
  });

  return {
    isRecording,
    isProcessing,
    isSupported,
    transcript,
    error,
    hasAudio,
    audioBlob,
    // Estado da captura de áudio
    audioCaptureType,
    isCapturingFullMeeting,
    audioSources,
    isCapturingInput,
    isCapturingOutput,
    audioQuality,
    detectedMeetingApp,
    // Progress tracking
    chunkProgress,
    getProgressPercentage,
    getProgressSummary,
    // Funções
    startRecording,
    stopRecording,
    clearTranscript,
    transcribeAudio,
    generateSummaryFromTranscript,
    regenerateSummaryWithNewFormat,
    getRecordingDuration,
    transcribeAudioInChunks,
    setOpenAIApiKey,
    testOpenAIConnection,
    estimateTranscriptionCost,
    hasOpenAIConfigured: () => !!OPENAI_API_KEY
  };
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
