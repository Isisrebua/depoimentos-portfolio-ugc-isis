(function () {
  "use strict";

  /* ==========================================================================
     BANCO DE LEADS — app independente. Lê e escreve na API local exposta
     pelo server.js (rotas /api/leads e /api/leads/:id/status), que por sua
     vez guarda tudo em leads.json ao lado do servidor. Qualquer site (este
     portfólio, o Bio Site, o UGC Manager) que fizer POST em /api/leads cai
     aqui — ver lead-connector.js pro snippet pronto de integração.
     ========================================================================== */
  var API = "/api/leads";
  var DEPOIMENTOS_API = "/api/depoimentos";
  var POLL_MS = 20000; // atualização automática simples (sem websocket)

  var SOURCE_LABELS = {
    "portfolio-ugc": "Portfólio UGC",
    "bio-site": "Bio Site",
    "ugc-manager": "UGC Manager"
  };

  // Rótulos amigáveis pras perguntas do formulário do Portfólio UGC.
  // Pra somar um canal novo com perguntas próprias, só adicionar aqui.
  var ANSWER_LABELS = { usage: "Já usou UGC antes?", goal: "Objetivo principal", message: "Mensagem" };
  var ANSWER_VALUE_LABELS = {
    usage: { "sim-ads": "Sim, já rodou Ads", "primeira-vez": "Primeira vez", "gestao-completa": "Quer Gestão Completa" },
    goal: { cpc: "Diminuir CPC", conversao: "Aumentar conversão em Ads", "prova-social": "Criativos pra prova social", "gestao-completa": "Gestão completa de UGC" }
  };
  var SKIP_ANSWER_KEYS = ["submittedAt", "page"];

  var VIEW_TITLES = {
    overview: ["Visão Geral", "Todos os leads novos, de qualquer canal."],
    "portfolio-ugc": ["Portfólio UGC", "Leads novos vindos do site do portfólio."],
    "bio-site": ["Bio Site", "Leads novos vindos do Bio Site."],
    "ugc-manager": ["UGC Manager", "Leads novos vindos do UGC Manager."],
    abordados: ["Leads Abordados", "Histórico de prospecção — leads já contatados."],
    depoimentos: ["Depoimentos", "Aprove ou oculte os depoimentos enviados por marcas/clientes. Só os aprovados aparecem no portfólio público."]
  };

  var DEPO_STATUS_LABELS = { pendente: "Pendente", aprovado: "Aprovado", oculto: "Oculto" };

  // pendingLeadStatus/pendingDepoStatus: { id: {status, statusUpdatedAt} }
  // pra cada mudança de status otimista ainda "em voo" (PATCH disparado,
  // resposta do servidor ainda não chegou). Ver loadLeads/loadDepoimentos.
  var state = { leads: [], depoimentos: [], view: "overview", pendingLeadStatus: {}, pendingDepoStatus: {} };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function prettyKey(k) {
    return k.replace(/[-_]/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return iso; }
  }

  // Números de WhatsApp aqui chegam sem código do país (ex: form do
  // portfólio pede só "(12) 90000-0000"). Se vier curto, assume Brasil.
  function waLink(whatsapp) {
    var digits = String(whatsapp || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length <= 11) digits = "55" + digits;
    return "https://wa.me/" + digits;
  }

  function igLink(handle) {
    var h = String(handle || "").trim().replace(/^@/, "");
    if (!h) return null;
    return "https://instagram.com/" + h;
  }

  /* ==========================================================================
     CARREGAMENTO
     ========================================================================== */
  // Aplica por cima de "data" (o que acabou de vir do servidor) qualquer
  // mudança otimista ainda pendente — sem isso, o poll de 20s (que pode
  // já estar em trânsito desde antes do clique) sobrescreve a tela com o
  // valor antigo assim que responde, e o botão "Aprovar"/"Marcar como
  // Abordado" parece não ter feito nada até o PATCH em si terminar.
  function withPending(data, pendingMap) {
    if (!Object.keys(pendingMap).length) return data;
    return data.map(function (item) {
      var patch = pendingMap[item.id];
      return patch ? Object.assign({}, item, patch) : item;
    });
  }

  function loadLeads() {
    return fetch(API)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.leads = withPending(data, state.pendingLeadStatus);
        document.getElementById("last-updated").textContent =
          "Atualizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        render();
      })
      .catch(function () {
        document.getElementById("last-updated").textContent = "Sem conexão com o servidor (API fora do ar?).";
      });
  }

  function loadDepoimentos() {
    return fetch(DEPOIMENTOS_API)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        state.depoimentos = withPending(data, state.pendingDepoStatus);
        render();
      })
      .catch(function () { /* mesmo erro de conexão já é reportado por loadLeads */ });
  }

  /* ==========================================================================
     FILTROS POR VIEW
     ========================================================================== */
  function leadsForView(view) {
    if (view === "overview") return state.leads.filter(function (l) { return l.status === "novo"; });
    if (view === "abordados") return state.leads.filter(function (l) { return l.status === "abordado"; });
    return state.leads.filter(function (l) { return l.status === "novo" && l.source === view; });
  }

  function updateBadges() {
    ["overview", "portfolio-ugc", "bio-site", "ugc-manager", "abordados"].forEach(function (v) {
      var el = document.getElementById("badge-" + v);
      if (el) el.textContent = leadsForView(v).length;
    });
    var badgeDepo = document.getElementById("badge-depoimentos");
    if (badgeDepo) {
      badgeDepo.textContent = state.depoimentos.filter(function (d) { return d.status === "pendente"; }).length;
    }
  }

  /* ==========================================================================
     RENDERIZAÇÃO
     ========================================================================== */
  function renderAnswers(lead) {
    var lastSubmission = lead.history && lead.history.length ? lead.history[lead.history.length - 1] : null;
    var answers = (lastSubmission && lastSubmission.answers) || {};
    var keys = Object.keys(answers).filter(function (k) { return SKIP_ANSWER_KEYS.indexOf(k) === -1 && answers[k]; });
    if (!keys.length) return "";
    var rows = keys.map(function (k) {
      var label = ANSWER_LABELS[k] || prettyKey(k);
      var rawVal = answers[k];
      var val = (ANSWER_VALUE_LABELS[k] && ANSWER_VALUE_LABELS[k][rawVal]) || rawVal;
      return '<div class="lead-answers__row"><span>' + escapeHtml(label) + "</span><strong>" + escapeHtml(val) + "</strong></div>";
    }).join("");
    return '<details class="lead-answers"><summary>Respostas do formulário</summary>' + rows + "</details>";
  }

  function renderLeadCard(lead) {
    var wa = waLink(lead.whatsapp);
    var ig = igLink(lead.instagram);
    var sourceLabel = SOURCE_LABELS[lead.source] || lead.source || "Origem desconhecida";
    var actionBtn = lead.status === "novo"
      ? '<button class="lead-card__action" data-action="abordar" data-id="' + lead.id + '">Marcar como Abordado</button>'
      : '<button class="lead-card__action lead-card__action--ghost" data-action="reabrir" data-id="' + lead.id + '">↩ Reabrir como novo</button>';

    return "" +
      '<article class="lead-card">' +
        '<header class="lead-card__header">' +
          "<div>" +
            "<h3>" + escapeHtml(lead.name || "Sem nome") + "</h3>" +
            (lead.company ? '<p class="lead-card__company">' + escapeHtml(lead.company) + "</p>" : "") +
          "</div>" +
          '<div class="lead-card__tags">' +
            '<span class="tag tag--source">' + escapeHtml(sourceLabel) + "</span>" +
            (lead.isRecurrent ? '<span class="tag tag--recurrent">Lead Recorrente</span>' : "") +
          "</div>" +
        "</header>" +
        '<div class="lead-card__contacts">' +
          (wa ? '<a class="contact-pill contact-pill--wa" href="' + wa + '" target="_blank" rel="noopener">📱 WhatsApp</a>' : "") +
          (ig ? '<a class="contact-pill" href="' + ig + '" target="_blank" rel="noopener">@' + escapeHtml(lead.instagram.replace(/^@/, "")) + "</a>" : "") +
          (lead.email ? '<a class="contact-pill" href="mailto:' + encodeURIComponent(lead.email) + '">' + escapeHtml(lead.email) + "</a>" : "") +
        "</div>" +
        renderAnswers(lead) +
        '<footer class="lead-card__footer">' +
          '<span class="lead-card__date">' + fmtDate(lead.status === "abordado" ? lead.statusUpdatedAt : lead.createdAt) + "</span>" +
          actionBtn +
        "</footer>" +
      "</article>";
  }

  /* ---------- Cards de depoimento (aba "Depoimentos") -------------------- */
  function renderStars(rating) {
    var n = Math.min(5, Math.max(1, parseInt(rating, 10) || 0));
    var out = "";
    for (var i = 1; i <= 5; i++) {
      out += '<span class="depo-star' + (i <= n ? " depo-star--on" : "") + '">★</span>';
    }
    return '<span class="depo-stars" aria-label="' + n + ' de 5 estrelas">' + out + "</span>";
  }

  function renderDepoimentoCard(item) {
    var statusLabel = DEPO_STATUS_LABELS[item.status] || item.status;
    var actions = "";
    if (item.status !== "aprovado") {
      actions += '<button class="lead-card__action" data-depo-action="aprovado" data-id="' + item.id + '">Aprovar</button>';
    }
    if (item.status !== "oculto") {
      actions += '<button class="lead-card__action lead-card__action--ghost" data-depo-action="oculto" data-id="' + item.id + '">Ocultar</button>';
    }

    return "" +
      '<article class="lead-card depo-card">' +
        '<header class="lead-card__header">' +
          "<div>" +
            "<h3>" + escapeHtml(item.responsibleName || "Sem nome") + "</h3>" +
            (item.company ? '<p class="lead-card__company">' + escapeHtml(item.company) + "</p>" : "") +
          "</div>" +
          '<div class="lead-card__tags">' +
            '<span class="tag tag--depo-' + escapeHtml(item.status) + '">' + escapeHtml(statusLabel) + "</span>" +
          "</div>" +
        "</header>" +
        renderStars(item.rating) +
        (item.text ? '<p class="depo-card__text">“' + escapeHtml(item.text) + '”</p>' : "") +
        '<div class="lead-card__contacts">' +
          (item.logoUrl ? '<a class="contact-pill" href="' + escapeHtml(item.logoUrl) + '" target="_blank" rel="noopener">🖼️ Logo/Foto</a>' : "") +
          (item.videoUrl ? '<a class="contact-pill" href="' + escapeHtml(item.videoUrl) + '" target="_blank" rel="noopener">' + (item.videoKind === "video" ? "🎬 Vídeo" : "📊 Print de resultado") + "</a>" : "") +
        "</div>" +
        '<footer class="lead-card__footer">' +
          '<span class="lead-card__date">' + fmtDate(item.createdAt) + "</span>" +
          '<div class="depo-card__actions">' + actions + "</div>" +
        "</footer>" +
      "</article>";
  }

  function render() {
    updateBadges();

    var title = VIEW_TITLES[state.view];
    document.getElementById("view-title").textContent = title[0];
    document.getElementById("view-subtitle").textContent = title[1];
    document.getElementById("abordados-banner").hidden = state.view !== "abordados";

    var list = document.getElementById("lead-list");
    var empty = document.getElementById("empty-state");

    if (state.view === "depoimentos") {
      var items = state.depoimentos.slice().sort(function (a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      if (!items.length) {
        list.innerHTML = "";
        empty.hidden = false;
        empty.textContent = "Nenhum depoimento enviado ainda.";
      } else {
        empty.hidden = true;
        list.innerHTML = items.map(renderDepoimentoCard).join("");
      }
      return;
    }

    var leads = leadsForView(state.view).slice().sort(function (a, b) {
      return new Date(b.lastSubmittedAt || b.createdAt) - new Date(a.lastSubmittedAt || a.createdAt);
    });

    if (!leads.length) {
      list.innerHTML = "";
      empty.hidden = false;
      empty.textContent = state.view === "abordados"
        ? "Nenhum lead abordado ainda."
        : "Nenhum lead novo neste canal ainda.";
    } else {
      empty.hidden = true;
      list.innerHTML = leads.map(renderLeadCard).join("");
    }
  }

  /* ==========================================================================
     AÇÕES — mudar status (Novo <-> Abordado / Pendente <-> Aprovado/Oculto)
     Atualização otimista: muda na tela IMEDIATAMENTE ao clicar, sem esperar
     o servidor responder. Enquanto o PATCH está em voo, o id fica marcado
     em pendingLeadStatus/pendingDepoStatus pra o poll de 20s (loadLeads/
     loadDepoimentos) não sobrescrever essa mudança com o valor antigo que
     ainda está no servidor — sem essa marca, um poll que responde ENTRE o
     clique e o PATCH terminar fazia o card "voltar" pro estado anterior por
     alguns segundos, parecendo que o clique não tinha feito nada. Se o
     PATCH falhar de verdade (rede ou erro do servidor), desfaz a mudança
     na tela e avisa — não fica só "esperando pra sempre" calado.
     ========================================================================== */
  function setStatus(id, status) {
    var lead = state.leads.find(function (l) { return l.id === id; });
    var previous = lead ? { status: lead.status, statusUpdatedAt: lead.statusUpdatedAt } : null;
    var patch = { status: status, statusUpdatedAt: new Date().toISOString() };

    state.pendingLeadStatus[id] = patch;
    if (lead) { Object.assign(lead, patch); render(); }

    fetch(API + "/" + id + "/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status })
    })
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); })
      .then(function () { delete state.pendingLeadStatus[id]; })
      .catch(function () {
        delete state.pendingLeadStatus[id];
        var current = state.leads.find(function (l) { return l.id === id; });
        if (current && previous) { Object.assign(current, previous); render(); }
        document.getElementById("last-updated").textContent = "Não foi possível salvar — tente de novo.";
      });
  }

  // Mesmo padrão de setStatus(), mas pra depoimentos — chamado pelos
  // botões [Aprovar]/[Ocultar] da aba "Depoimentos".
  function setDepoimentoStatus(id, status) {
    var item = state.depoimentos.find(function (d) { return d.id === id; });
    var previous = item ? { status: item.status, statusUpdatedAt: item.statusUpdatedAt } : null;
    var patch = { status: status, statusUpdatedAt: new Date().toISOString() };

    state.pendingDepoStatus[id] = patch;
    if (item) { Object.assign(item, patch); render(); }

    fetch(DEPOIMENTOS_API + "/" + id + "/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status })
    })
      .then(function (res) { if (!res.ok) throw new Error("HTTP " + res.status); })
      .then(function () { delete state.pendingDepoStatus[id]; })
      .catch(function () {
        delete state.pendingDepoStatus[id];
        var current = state.depoimentos.find(function (d) { return d.id === id; });
        if (current && previous) { Object.assign(current, previous); render(); }
        document.getElementById("last-updated").textContent = "Não foi possível salvar — tente de novo.";
      });
  }

  /* ==========================================================================
     NAVEGAÇÃO E EVENTOS
     ========================================================================== */
  function initNav() {
    document.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
        state.view = btn.dataset.view;
        render();
      });
    });
  }

  function initActions() {
    document.getElementById("lead-list").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (btn) {
        var id = btn.dataset.id;
        if (btn.dataset.action === "abordar") setStatus(id, "abordado");
        if (btn.dataset.action === "reabrir") setStatus(id, "novo");
        return;
      }
      var depoBtn = e.target.closest("[data-depo-action]");
      if (depoBtn) setDepoimentoStatus(depoBtn.dataset.id, depoBtn.dataset.depoAction);
    });
    document.getElementById("refresh-btn").addEventListener("click", function () {
      loadLeads();
      loadDepoimentos();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initActions();
    loadLeads();
    loadDepoimentos();
    window.setInterval(function () { loadLeads(); loadDepoimentos(); }, POLL_MS);
  });
})();
