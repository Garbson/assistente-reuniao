import { computed, ref } from 'vue';

export function useHistory() {
  // Chave para localStorage
  const STORAGE_KEY = 'assistente-reunioes-history';

  // Estado reativo
  const meetings = ref([]);
  const selectedMeeting = ref(null);

  // Carregar reuniões do localStorage
  const loadMeetings = () => {
    try {
      const storedMeetings = localStorage.getItem(STORAGE_KEY);
      if (storedMeetings) {
        meetings.value = JSON.parse(storedMeetings);
        console.log('Reuniões carregadas:', meetings.value.length);
      }
    } catch (error) {
      console.error('Erro ao carregar reuniões do localStorage:', error);
      meetings.value = [];
    }
  };

  // Salvar reuniões no localStorage
  const saveMeetings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings.value));
      console.log('Reuniões salvas no localStorage');
    } catch (error) {
      console.error('Erro ao salvar reuniões no localStorage:', error);
    }
  };

  // Salvar nova reunião
  const saveMeeting = (transcript, summary) => {
    const newMeeting = {
      id: Date.now().toString(),
      title: generateMeetingTitle(summary),
      transcript,
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    meetings.value.unshift(newMeeting); // Adiciona no início da lista
    saveMeetings();

    console.log('Nova reunião salva:', newMeeting.title);
    return newMeeting;
  };

  // Gerar título da reunião baseado no resumo
  const generateMeetingTitle = (summary) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let title = `Reunião ${timeStr}`;

    // Tenta extrair um título mais descritivo do resumo
    if (summary && summary.geral) {
      const firstSentence = summary.geral.split('.')[0];
      if (firstSentence.length > 10 && firstSentence.length < 60) {
        title = firstSentence.trim();
      }
    }

    return title;
  };

  // Excluir reunião
  const deleteMeeting = (meetingId) => {
    const index = meetings.value.findIndex(m => m.id === meetingId);
    if (index !== -1) {
      const deletedMeeting = meetings.value.splice(index, 1)[0];
      saveMeetings();

      // Se a reunião excluída estava selecionada, limpar seleção
      if (selectedMeeting.value && selectedMeeting.value.id === meetingId) {
        selectedMeeting.value = null;
      }

      console.log('Reunião excluída:', deletedMeeting.title);
      return true;
    }
    return false;
  };

  // Selecionar reunião
  const selectMeeting = (meeting) => {
    selectedMeeting.value = meeting;
    console.log('Reunião selecionada:', meeting.title);
  };

  // Limpar seleção
  const clearSelection = () => {
    selectedMeeting.value = null;
  };

  // Atualizar reunião existente
  const updateMeeting = (meetingId, updates) => {
    const meeting = meetings.value.find(m => m.id === meetingId);
    if (meeting) {
      Object.assign(meeting, updates, {
        updatedAt: new Date().toISOString()
      });
      saveMeetings();

      // Atualizar reunião selecionada se necessário
      if (selectedMeeting.value && selectedMeeting.value.id === meetingId) {
        selectedMeeting.value = { ...meeting };
      }

      console.log('Reunião atualizada:', meeting.title);
      return true;
    }
    return false;
  };

  // Marcar/desmarcar tarefa como concluída
  const toggleTask = (meetingId, taskIndex) => {
    const meeting = meetings.value.find(m => m.id === meetingId);
    if (meeting && meeting.summary && meeting.summary.tarefas && meeting.summary.tarefas[taskIndex]) {
      meeting.summary.tarefas[taskIndex].concluida = !meeting.summary.tarefas[taskIndex].concluida;
      meeting.updatedAt = new Date().toISOString();
      saveMeetings();

      // Atualizar reunião selecionada se necessário
      if (selectedMeeting.value && selectedMeeting.value.id === meetingId) {
        selectedMeeting.value = { ...meeting };
      }

      return true;
    }
    return false;
  };

  // Exportar reunião como JSON
  const exportMeeting = (meeting) => {
    const dataStr = JSON.stringify(meeting, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `reuniao-${meeting.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exportar todas as reuniões
  const exportAllMeetings = () => {
    const dataStr = JSON.stringify(meetings.value, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `todas-reunioes-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Computed properties
  const meetingsByDate = computed(() => {
    const grouped = {};

    meetings.value.forEach(meeting => {
      const date = new Date(meeting.createdAt).toLocaleDateString('pt-BR');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(meeting);
    });

    // Ordenar datas em ordem decrescente
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      return new Date(b.split('/').reverse().join('-')) - new Date(a.split('/').reverse().join('-'));
    });

    const result = {};
    sortedDates.forEach(date => {
      result[date] = grouped[date].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    });

    return result;
  });

  const totalMeetings = computed(() => meetings.value.length);

  const meetingsThisWeek = computed(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return meetings.value.filter(meeting =>
      new Date(meeting.createdAt) >= weekAgo
    ).length;
  });

  const totalTasks = computed(() => {
    return meetings.value.reduce((total, meeting) => {
      if (meeting.summary && meeting.summary.tarefas) {
        return total + meeting.summary.tarefas.length;
      }
      return total;
    }, 0);
  });

  const completedTasks = computed(() => {
    return meetings.value.reduce((total, meeting) => {
      if (meeting.summary && meeting.summary.tarefas) {
        return total + meeting.summary.tarefas.filter(task => task.concluida).length;
      }
      return total;
    }, 0);
  });

  // Inicializar carregando dados existentes
  loadMeetings();

  return {
    // Estado
    meetings,
    selectedMeeting,

    // Computed
    meetingsByDate,
    totalMeetings,
    meetingsThisWeek,
    totalTasks,
    completedTasks,

    // Métodos
    saveMeeting,
    deleteMeeting,
    selectMeeting,
    clearSelection,
    updateMeeting,
    toggleTask,
    exportMeeting,
    exportAllMeetings,
    loadMeetings,
    saveMeetings
  };
}
