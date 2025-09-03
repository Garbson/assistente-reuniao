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

  const generateSummaryFromAI = async () => {
    if (!audioBlob.value) throw new Error('Nenhum áudio disponível.');
    isProcessing.value = true;
    error.value = null;
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
      if (!apiKey) throw new Error('Chave da API ausente (.env).');
      const base64Audio = await blobToBase64(audioBlob.value);
  const prompt = `Você receberá o áudio BRUTO de uma reunião corporativa. Extraia e produza APENAS o JSON final (sem markdown, sem comentários) seguindo as regras abaixo rigorosamente.\n\nOBJETIVO: Transcrição fiel + resumo executivo elegante + tópicos claros + tarefas acionáveis.\n\nREGRAS:\n1. transcript: transcrever integralmente em português do Brasil, corrigindo erros de dicção óbvios, removendo muletas ("éé", "ahn", "tipo"). Manter nomes citados.\n2. geral: 2 a 4 frases fluidas cobrindo Contexto, Objetivo(s), Decisões (se houver) e Próximos Passos estratégicos. Estilo profissional, positivo e claro.\n3. pontos_discutidos: até 12 itens. Cada item: frase curta iniciando com verbo no infinitivo OU substantivo forte (ex: "Definir cronograma de testes", "Alinhamento de orçamento"). Sem redundâncias; agrupar ideias semelhantes.\n4. tarefas: até 8 ações objetivas. Cada tarefa: { descricao: verbo no infinitivo + objeto claro; responsavel: nome mencionado ou "A definir" se ausente; concluida: false }. NÃO inventar nomes. Não duplicar tarefas de significado similar.\n5. Se não houver dados suficientes para pontos_discutidos ou tarefas, usar array vazio [].\n6. NUNCA adicionar campos extras ou texto fora do JSON.\n\nFORMATO EXATO DO RETORNO (JSON ÚNICO):\n{\n  "transcript": "...",\n  "geral": "...",\n  "pontos_discutidos": ["..."],\n  "tarefas": [ { "descricao": "...", "responsavel": "...", "concluida": false } ]\n}\n\nRetorne somente o JSON.`;
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [ { text: prompt }, { inline_data: { mime_type: audioBlob.value.type || 'audio/webm', data: base64Audio } } ] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 1600 }
        })
      });
      if (!resp.ok) throw new Error('Erro da API: ' + await resp.text());
      const data = await resp.json();
      const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') || '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('JSON não encontrado na resposta da IA.');
      const parsed = JSON.parse(match[0]);
      if (parsed.transcript) transcript.value = parsed.transcript;
      return {
        geral: parsed.geral || '',
        pontos_discutidos: parsed.pontos_discutidos || [],
        tarefas: parsed.tarefas || [],
        data_reuniao: new Date().toISOString(),
        duracao_minutos: getRecordingDuration() / 60,
        fonte: 'Google Gemini API (áudio)'
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
    generateSummaryFromAI,
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
