// Teste simples para verificar se active-win está funcionando
const activeWin = require('active-win');

async function testActiveWin() {
  try {
    console.log('Testando active-win...');
    const window = await activeWin();
    console.log('Janela ativa:', JSON.stringify(window, null, 2));
    
    if (window) {
      console.log('✅ active-win está funcionando!');
      console.log('Título:', window.title);
      console.log('Owner:', window.owner);
      console.log('Bounds:', window.bounds);
    } else {
      console.log('❌ active-win retornou null/undefined');
    }
  } catch (error) {
    console.error('❌ Erro ao testar active-win:', error);
  }
}

testActiveWin();
