/* ============================================================================
   CONECTOR DO BANCO DE LEADS
   Cole este arquivo (ou só a função sendLeadToCRM abaixo) em QUALQUER outro
   site seu — Bio Site, UGC Manager, página de vendas de Gestão de
   Campanhas, etc. — pra mandar os leads capturados lá pro mesmo Banco de
   Leads central (banco-de-leads.html).

   COMO USAR no outro site:
     1. Inclua este arquivo: <script src="lead-connector.js"></script>
     2. No submit do formulário/pop-up daquele site, chame:
          sendLeadToCRM(
            { name, company, email, whatsapp, instagram },
            "bio-site"        // ou "ugc-manager" — a tag de origem
          );
     O 3º argumento (origem) é o que decide em qual aba da barra lateral
     ("Portfólio UGC" / "Bio Site" / "UGC Manager" / "Gestão de Campanhas")
     o lead aparece. Qualquer campo extra que você mandar (ex: mensagem,
     orçamento) entra automaticamente na ficha do lead, dentro de
     "Respostas do formulário" — não precisa de nenhuma coluna nova no
     banco pra isso, é tudo jsonb (ver lib/leads.js).

     Exemplo real — pop-up da página de vendas de Gestão de Campanhas:
          sendLeadToCRM(
            {
              name: "...", email: "...", whatsapp: "...",
              tipo_campanha: "hibrida",       // "ugc" | "influenciadores" | "hibrida"
              experiencia_ugc: "ja-testei",   // "ja-invisto" | "ja-testei" | "primeira-vez"
              ideia_campanha: "..."           // texto livre
            },
            "pagina-vendas-gestao"
          );
     (Os rótulos bonitos pra tipo_campanha/experiencia_ugc/ideia_campanha
     já estão registrados em banco-de-leads.js — ANSWER_LABELS/
     ANSWER_VALUE_LABELS. Mandar valores diferentes desses não quebra
     nada, só aparece o texto cru em vez do rótulo traduzido.)

   IMPORTANTE — CRM_API_URL abaixo já aponta pro domínio de produção na
   Vercel. Rodando local (server.js em localhost:5757), troque pra
   "http://localhost:5757/api/leads" enquanto testa. O servidor já libera
   CORS de qualquer origem, então funciona chamando de um domínio
   diferente sem configuração extra.
   ========================================================================== */
(function (global) {
  "use strict";

  var CRM_API_URL = "https://isis-ugc-portfolio.vercel.app/api/leads";

  function sendLeadToCRM(fields, source) {
    var payload = Object.assign({}, fields, { source: source || "desconhecido" });
    return fetch(CRM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (res) { return res.json(); });
  }

  global.sendLeadToCRM = sendLeadToCRM;
})(window);
