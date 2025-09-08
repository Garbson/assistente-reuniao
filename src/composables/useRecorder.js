import { onMounted, onUnmounted, ref } from 'vue';

// Composable LIMPO e simplificado: grava áudio (MediaRecorder) e envia para Gemini para transcrever + resumir
export function useRecorder() {
  const isRecording = ref(false);
  const isProcessing = ref(false);
  const transcript = ref('');
  const error = ref(null);
  const isSupported = ref(false);
  const hasAudio = ref(false);
  const audioBlob = ref(null);

  let mediaRecorder = null;
  let audioChunks = [];
  let startTime = null;
  let removeElectronListener = null;

  const checkSupport = () => {
    isSupported.value = !!(navigator.mediaDevices && window.MediaRecorder);
    if (!isSupported.value) error.value = 'Captura de áudio não suportada neste ambiente.';
    return isSupported.value;
  };

  const startRecording = async () => {
    if (!checkSupport()) return;
    if (isRecording.value) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg');
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      audioChunks = [];
      transcript.value = '';
      audioBlob.value = null;
      hasAudio.value = false;
      error.value = null;
      startTime = new Date();
      mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        audioBlob.value = new Blob(audioChunks, { type: mimeType });
        hasAudio.value = true;
        isRecording.value = false;
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start(500);
      isRecording.value = true;
    } catch (e) {
      if (e.name === 'NotAllowedError') error.value = 'Permissão de microfone negada.';
      else if (e.name === 'NotFoundError') error.value = 'Nenhum microfone encontrado.';
      else error.value = 'Erro ao iniciar gravação.';
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
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
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      if (!apiKey) throw new Error('Chave da API ausente (.env).');
      
      const fileSizeMB = audioBlob.value.size / (1024 * 1024);
      const durationMinutes = getRecordingDuration() / 60;
      
      console.log(`📊 Áudio: ${fileSizeMB.toFixed(1)}MB, ${durationMinutes.toFixed(1)} minutos`);
      
      // Para reuniões longas (> 15MB), processar em chunks
      if (fileSizeMB > 15) {
        return await transcribeAudioInChunks();
      }
      
      // Para arquivos menores, usar método inline
      const base64Audio = await blobToBase64(audioBlob.value);
      const prompt = `Você receberá o áudio BRUTO de uma reunião corporativa. Faça apenas a transcrição completa e fiel em português do Brasil, corrigindo erros de dicção óbvios e removendo muletas ("éé", "ahn", "tipo"). Mantenha todos os nomes citados. Retorne apenas o texto transcrito, sem formatação adicional ou comentários.`;
      
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: audioBlob.value.type || 'audio/webm', data: base64Audio } } ] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
        })
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('❌ Erro da API:', errorText);
        throw new Error(`Erro da API (${resp.status}): ${errorText}`);
      }
      const data = await resp.json();
      const transcriptText = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      if (!transcriptText) throw new Error('Transcrição vazia retornada da API.');
      
      transcript.value = transcriptText;
      return transcriptText;
    } catch (e) {
      error.value = e.message;
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  const transcribeAudioInChunks = async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    const CHUNK_DURATION_MS = 10 * 60 * 1000; // 10 minutos por chunk
    
    try {
      console.log('🔄 Processando áudio longo em chunks...');
      
      const chunks = await splitAudioIntoChunks(audioBlob.value, CHUNK_DURATION_MS);
      console.log(`📦 Dividido em ${chunks.length} chunks`);
      
      let fullTranscript = '';
      const prompt = `Você receberá parte do áudio de uma reunião corporativa. Faça apenas a transcrição completa e fiel em português do Brasil, corrigindo erros de dicção óbvios e removendo muletas ("éé", "ahn", "tipo"). Mantenha todos os nomes citados. Retorne apenas o texto transcrito, sem formatação adicional ou comentários.`;
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkSizeMB = chunk.size / (1024 * 1024);
        
        console.log(`📤 Processando chunk ${i + 1}/${chunks.length} (${chunkSizeMB.toFixed(1)}MB)`);
        
        try {
          let chunkTranscript = '';
          
          // Se chunk ainda é muito grande, usar Files API
          if (chunkSizeMB > 10) {
            chunkTranscript = await transcribeChunkWithFilesAPI(chunk, prompt, apiKey, i + 1);
          } else {
            // Usar método inline para chunks menores
            const base64Audio = await blobToBase64(chunk);
            
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: chunk.type || 'audio/webm', data: base64Audio } } ] }],
                generationConfig: { temperature: 0.3, maxOutputTokens: 8000 }
              })
            });
            
            if (!resp.ok) {
              const errorText = await resp.text();
              console.error(`❌ Erro no chunk ${i + 1}:`, errorText);
              chunkTranscript = `[Erro na transcrição do chunk ${i + 1}]`;
            } else {
              const data = await resp.json();
              chunkTranscript = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || `[Chunk ${i + 1} vazio]`;
            }
          }
          
          if (fullTranscript && chunkTranscript.trim()) {
            fullTranscript += '\n\n';
          }
          fullTranscript += chunkTranscript.trim();
          
          // Pequena pausa para evitar rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (chunkError) {
          console.error(`❌ Erro no chunk ${i + 1}:`, chunkError);
          fullTranscript += `\n\n[Erro na transcrição do segmento ${i + 1}: ${chunkError.message}]`;
        }
      }
      
      if (!fullTranscript.trim()) {
        throw new Error('Nenhuma transcrição foi obtida dos chunks.');
      }
      
      transcript.value = fullTranscript;
      console.log('✅ Transcrição completa finalizada');
      return fullTranscript;
      
    } catch (e) {
      console.error('❌ Erro ao processar áudio em chunks:', e);
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
        
        console.log(`📦 Chunk ${i + 1}: ${(startTime/1000/60).toFixed(1)}-${(endTime/1000/60).toFixed(1)} min (${(chunkBlob.size/1024/1024).toFixed(1)}MB)`);
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
      
      const prompt = `Você receberá a transcrição de uma reunião corporativa. Produza APENAS o JSON final (sem markdown, sem comentários) seguindo as regras abaixo rigorosamente.\n\nOBJETIVO: Resumo executivo elegante + tópicos claros + tarefas acionáveis a partir da transcrição fornecida.\n\nREGRAS:\n1. geral: 2 a 4 frases fluidas cobrindo Contexto, Objetivo(s), Decisões (se houver) e Próximos Passos estratégicos. Estilo profissional, positivo e claro.\n2. pontos_discutidos: até 12 itens. Cada item: frase curta iniciando com verbo no infinitivo OU substantivo forte (ex: "Definir cronograma de testes", "Alinhamento de orçamento"). Sem redundâncias; agrupar ideias semelhantes.\n3. tarefas: até 8 ações objetivas. Cada tarefa: { descricao: verbo no infinitivo + objeto claro; responsavel: nome mencionado ou "A definir" se ausente; concluida: false }. NÃO inventar nomes. Não duplicar tarefas de significado similar.\n4. Se não houver dados suficientes para pontos_discutidos ou tarefas, usar array vazio [].\n5. NUNCA adicionar campos extras ou texto fora do JSON.\n\nFORMATO EXATO DO RETORNO (JSON ÚNICO):\n{\n  "geral": "...",\n  "pontos_discutidos": ["..."],\n  "tarefas": [ { "descricao": "...", "responsavel": "...", "concluida": false } ]\n}\n\nTranscrição da reunião:\n${transcript.value}\n\nRetorne somente o JSON.`;
      
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 4000 }
        })
      });
      if (!resp.ok) throw new Error('Erro da API: ' + await resp.text());
      const data = await resp.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON não encontrado na resposta da IA.');
      const parsed = JSON.parse(match[0]);
      
      return {
        geral: parsed.geral || '',
        pontos_discutidos: parsed.pontos_discutidos || [],
        tarefas: parsed.tarefas || [],
        data_reuniao: new Date().toISOString(),
        duracao_minutos: getRecordingDuration() / 60,
        fonte: 'Google Gemini API (transcrição)'
      };
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

  onMounted(() => {
    checkSupport();
    setupElectronListener();
  });

  onUnmounted(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
    if (removeElectronListener) removeElectronListener();
  });

  return {
    isRecording,
    isProcessing,
    isSupported,
    transcript,
    error,
    hasAudio,
    audioBlob,
    startRecording,
    stopRecording,
    clearTranscript,
    transcribeAudio,
    generateSummaryFromTranscript,
    getRecordingDuration
  };
}

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
