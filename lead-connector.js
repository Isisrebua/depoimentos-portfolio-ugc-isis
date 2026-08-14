/* ============================================================================
   CONECTOR DO BANCO DE LEADS
   Cole este arquivo (ou só a função sendLeadToCRM abaixo) em QUALQUER outro
   site seu — Bio Site, UGC Manager, etc. — pra mandar os leads capturados
   lá pro mesmo Banco de Leads central (banco-de-leads.html).

   COMO USAR no outro site:
     1. Inclua este arquivo: <script src="lead-connector.js"></script>
     2. No submit do formulário daquele site, chame:
          sendLeadToCRM(
            { name, company, email, whatsapp, instagram },
            "bio-site"        // ou "ugc-manager" — a tag de origem
          );
     O 3º argumento (origem) é o que decide em qual aba da barra lateral
     ("Portfólio UGC" / "Bio Site" / "UGC Manager") o lead aparece.
     Qualquer campo extra que você mandar (ex: mensagem, orçamento) entra
     automaticamente na ficha do lead, dentro de "Respostas do formulário".

   IMPORTANTE — troque CRM_API_URL abaixo quando o Banco de Leads for pra
   produção: hoje ele aponta pro servidor local de desenvolvimento
   (http://localhost:5757). Se este portfólio for publicado num domínio de
   verdade, troque pela URL pública dele — é lá que a rota /api/leads mora
   (ver server.js). O servidor já libera CORS de qualquer origem, então
   funciona chamando de um domínio diferente sem configuração extra.
   ========================================================================== */
(function (global) {
  "use strict";

  var CRM_API_URL = "http://localhost:5757/api/leads";

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
