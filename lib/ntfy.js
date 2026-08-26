// NOTIFICAÇÃO NO CELULAR — ntfy.sh. Toda vez que um depoimento novo é
// salvo, dispara um POST pro tópico ntfy.sh/isis-ugc-depoimentolead com
// nome/marca/nota/texto. É fire-and-forget: roda depois da resposta 201 já
// ter sido mandada pro navegador do cliente, então se o ntfy estiver fora
// do ar isso NUNCA atrasa nem quebra o envio do depoimento — só perde a
// notificação daquela vez.
// Aviso de privacidade: tópicos do ntfy.sh são públicos por padrão —
// qualquer pessoa que souber o nome exato do tópico pode se inscrever e
// ver essas notificações (nome, marca, nota, texto do depoimento).
const NTFY_URL = 'https://ntfy.sh/isis-ugc-depoimentolead';

async function notifyNtfy(item) {
  const body = 'Novo Depoimento Recebido!\n\n' +
    'Nome: ' + item.responsibleName + '\n' +
    'Marca: ' + item.company + '\n' +
    'Nota: ' + item.rating + ' estrelas\n' +
    'Depoimento: ' + item.text;

  try {
    const res = await fetch(NTFY_URL, {
      method: 'POST',
      headers: {
        // "Title" fica em ASCII puro de propósito: o fetch nativo rejeita
        // (TypeError "ByteString") qualquer header com caractere fora do
        // Latin-1 — a tag "star" abaixo já resolve isso: o próprio app do
        // ntfy reconhece "star" como nome de emoji e mostra ⭐ sozinho.
        'Title': 'Novo Depoimento UGC!',
        'Priority': 'high',
        'Tags': 'star,memo',
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: body,
    });
    if (!res.ok) console.error('Erro ntfy:', await res.text());
  } catch (err) {
    console.error('Erro ntfy:', err.message);
  }
}

module.exports = { notifyNtfy };
