// Teste simples para verificar se active-win está funcionando
async function testActiveWin() {
  try {
    console.log('Testando active-win...');
    
    // Para active-win v9+ (ESM), precisa usar import dinâmico
    const { activeWindow } = await import('active-win');
    console.log('Função activeWindow:', typeof activeWindow);
    
    if (typeof activeWindow === 'function') {
      const window = await activeWindow();
      console.log('Janela ativa:', JSON.stringify(window, null, 2));
      
      if (window) {
        console.log('✅ active-win está funcionando!');
        console.log('Título:', window.title);
        console.log('Owner:', window.owner);
        console.log('Bounds:', window.bounds);
      } else {
        console.log('❌ active-win retornou null/undefined');
      }
    } else {
      console.log('❌ activeWindow não é uma função');
    }
  } catch (error) {
    console.error('❌ Erro ao testar active-win:', error);
  }
}

testActiveWin();
