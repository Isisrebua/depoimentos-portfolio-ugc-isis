(function () {
  "use strict";

  /* ==========================================================================
     PORTÃO DE SENHA
     Isto NÃO é segurança de verdade — é uma comparação em JavaScript que
     roda no navegador, então qualquer pessoa que abra o código-fonte desta
     página vê a senha em texto puro. É só um filtro contra visitante
     casual. Pra proteção de verdade seria preciso um login server-side
     (login real exige backend, que este projeto — um site estático — não
     tem). TROQUE a senha abaixo antes de publicar o site.
     ========================================================================== */
  var DASH_PASSWORD = "isis2026ugc";
  var UNLOCK_KEY = "dashboard-unlocked";

  function initLock() {
    var lock = document.getElementById("dash-lock");
    var content = document.getElementById("dash-content");
    var form = document.getElementById("dash-lock-form");
    var input = document.getElementById("dash-password");
    var error = document.getElementById("dash-lock-error");

    function unlock() {
      lock.hidden = true;
      content.hidden = false;
      renderDashboard();
    }

    var alreadyUnlocked = false;
    try { alreadyUnlocked = sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch (e) { /* ignora */ }
    if (alreadyUnlocked) { unlock(); return; }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (input.value === DASH_PASSWORD) {
        try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch (e) { /* ignora */ }
        error.hidden = true;
        unlock();
      } else {
        error.hidden = false;
        input.value = "";
        input.focus();
      }
    });
  }

  /* ==========================================================================
     LEITURA DOS DADOS (mesma chave/estrutura que o script.js do site grava)
     ========================================================================== */
  var ANALYTICS_KEY = "portfolio-analytics";

  function loadAnalytics() {
    try {
      var raw = localStorage.getItem(ANALYTICS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  var SECTION_LABELS = {
    "hero": "Capa",
    "sobre-mim": "Sobre mim",
    "prova-social": "Prova social",
    "nichos-nav": "Como podemos trabalhar / Nichos",
    "marcas": "Marcas trabalhadas",
    "cases-de-sucesso": "Cases de sucesso",
    "nicho-app-tech": "Nicho: App e Tech",
    "nicho-fitness": "Nicho: Fitness e bem-estar",
    "nicho-moda": "Nicho: Moda",
    "nicho-locais": "Nicho: Locais e serviços",
    "nicho-beleza": "Nicho: Beleza",
    "nicho-pet": "Nicho: Pet",
    "galeria-fotos": "Galeria de fotos",
    "feedbacks": "Feedbacks",
    "mao-na-massa": "Mão na massa",
    "pacotes": "Pacotes",
    "combo-funil": "Combo funil de vendas",
    "faq": "FAQ",
    "contato": "Contato / rodapé"
  };

  var USAGE_LABELS = {
    "sim-ads": "Sim, já rodou Ads",
    "primeira-vez": "Primeira vez",
    "gestao-completa": "Quer Gestão Completa"
  };

  function fmtSeconds(s) {
    if (!s || s < 1) return "0s";
    if (s < 60) return Math.round(s) + "s";
    var m = Math.floor(s / 60);
    var rem = Math.round(s % 60);
    return m + "m " + rem + "s";
  }

  function fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return iso || "—"; }
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ==========================================================================
     RENDERIZAÇÃO
     ========================================================================== */
  function renderDashboard() {
    var data = loadAnalytics();

    if (!data || (!data.totalPageViews && !data.leads.length)) {
      document.getElementById("stat-pageviews").textContent = "0";
      document.getElementById("stat-avg-scroll").textContent = "—";
      document.getElementById("stat-top-section").textContent = "—";
      document.getElementById("stat-top-video").textContent = "—";
      document.getElementById("section-bars").innerHTML = '<p class="dash-empty">Ainda sem dados — navegue pelo site principal neste mesmo navegador pra começar a coletar.</p>';
      document.getElementById("scroll-bars").innerHTML = '<p class="dash-empty">Sem histórico de rolagem ainda.</p>';
      renderVideoTable({});
      renderLeadsTable([]);
      return;
    }

    document.getElementById("stat-pageviews").textContent = data.totalPageViews || 0;

    // rolagem média de abandono
    var history = data.scrollHistory || [];
    if (history.length) {
      var avg = history.reduce(function (sum, h) { return sum + h.maxScrollPct; }, 0) / history.length;
      document.getElementById("stat-avg-scroll").textContent = Math.round(avg) + "%";
    } else {
      document.getElementById("stat-avg-scroll").textContent = "—";
    }

    // seção mais vista
    var sectionViews = data.sectionViews || {};
    var topSection = topEntry(sectionViews);
    document.getElementById("stat-top-section").textContent = topSection ? (SECTION_LABELS[topSection[0]] || topSection[0]) : "—";

    // vídeo mais reproduzido
    var videoStats = data.videoStats || {};
    var videoPlays = {};
    Object.keys(videoStats).forEach(function (slot) { videoPlays[slot] = videoStats[slot].plays || 0; });
    var topVideo = topEntry(videoPlays);
    document.getElementById("stat-top-video").textContent = topVideo ? topVideo[0] + " (" + topVideo[1] + "x)" : "—";

    renderBarList("section-bars", sectionViews, SECTION_LABELS);
    renderScrollBars(history);
    renderVideoTable(videoStats);
    renderLeadsTable(data.leads || []);
  }

  function topEntry(obj) {
    var keys = Object.keys(obj);
    if (!keys.length) return null;
    var best = keys[0];
    keys.forEach(function (k) { if (obj[k] > obj[best]) best = k; });
    return obj[best] > 0 ? [best, obj[best]] : null;
  }

  function renderBarList(containerId, counts, labels) {
    var el = document.getElementById(containerId);
    var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; });
    if (!entries.length) {
      el.innerHTML = '<p class="dash-empty">Sem dados ainda.</p>';
      return;
    }
    entries.sort(function (a, b) { return b[1] - a[1]; });
    var max = entries[0][1] || 1;
    el.innerHTML = entries.map(function (e) {
      var pct = Math.max(4, Math.round((e[1] / max) * 100));
      var label = (labels && labels[e[0]]) || e[0];
      return '<div class="bar-row">' +
        '<span class="bar-row__label">' + escapeHtml(label) + '</span>' +
        '<span class="bar-row__track"><span class="bar-row__fill" style="width:' + pct + '%"></span></span>' +
        '<span class="bar-row__count">' + e[1] + '</span>' +
        '</div>';
    }).join("");
  }

  function renderScrollBars(history) {
    var el = document.getElementById("scroll-bars");
    if (!history.length) {
      el.innerHTML = '<p class="dash-empty">Sem histórico ainda — o ponto de abandono é gravado quando você sai da página ou troca de aba.</p>';
      return;
    }
    var recent = history.slice(-12).reverse();
    el.innerHTML = recent.map(function (h) {
      return '<div class="bar-row">' +
        '<span class="bar-row__label">' + escapeHtml(fmtDate(h.date)) + '</span>' +
        '<span class="bar-row__track"><span class="bar-row__fill" style="width:' + Math.max(4, h.maxScrollPct) + '%"></span></span>' +
        '<span class="bar-row__count">' + h.maxScrollPct + '%</span>' +
        '</div>';
    }).join("");
  }

  function renderVideoTable(videoStats) {
    var tbody = document.querySelector("#video-table tbody");
    var slots = Object.keys(videoStats);
    if (!slots.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="dash-empty">Nenhum vídeo reproduzido ainda.</td></tr>';
      return;
    }
    slots.sort(function (a, b) { return (videoStats[b].plays || 0) - (videoStats[a].plays || 0); });
    tbody.innerHTML = slots.map(function (slot) {
      var s = videoStats[slot];
      var avg = s.plays ? s.totalWatchedSeconds / s.plays : 0;
      return "<tr><td>" + escapeHtml(slot) + "</td><td>" + (s.plays || 0) + "</td><td>" + fmtSeconds(avg) + "</td></tr>";
    }).join("");
  }

  function renderLeadsTable(leads) {
    var tbody = document.querySelector("#leads-table tbody");
    if (!leads.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="dash-empty">Nenhum lead capturado ainda.</td></tr>';
      return;
    }
    var ordered = leads.slice().reverse();
    tbody.innerHTML = ordered.map(function (l) {
      return "<tr>" +
        "<td>" + escapeHtml(fmtDate(l.submittedAt)) + "</td>" +
        "<td>" + escapeHtml(l.name) + "</td>" +
        "<td>" + escapeHtml(l.company) + "</td>" +
        "<td>" + escapeHtml(l.email) + "</td>" +
        "<td>" + escapeHtml(l.whatsapp) + "</td>" +
        "<td>" + escapeHtml(USAGE_LABELS[l.usage] || l.usage) + "</td>" +
        '<td class="wrap">' + escapeHtml(l.message || "—") + "</td>" +
        "</tr>";
    }).join("");
  }

  /* ==========================================================================
     AÇÕES — exportar CSV / limpar dados
     ========================================================================== */
  function initActions() {
    var exportBtn = document.getElementById("dash-export");
    var clearBtn = document.getElementById("dash-clear");

    exportBtn.addEventListener("click", function () {
      var data = loadAnalytics();
      var leads = (data && data.leads) || [];
      if (!leads.length) { alert("Nenhum lead pra exportar ainda."); return; }

      var cols = ["submittedAt", "name", "company", "email", "whatsapp", "usage", "message"];
      var rows = [cols.join(",")].concat(leads.map(function (l) {
        return cols.map(function (c) {
          var v = l[c] == null ? "" : String(l[c]);
          return '"' + v.replace(/"/g, '""') + '"';
        }).join(",");
      }));
      var blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "leads-isis-rebua-ugc.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    clearBtn.addEventListener("click", function () {
      if (!confirm("Isso apaga TODOS os dados de analytics e leads salvos neste navegador. Não dá pra desfazer. Continuar?")) return;
      try { localStorage.removeItem(ANALYTICS_KEY); } catch (e) { /* ignora */ }
      renderDashboard();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initLock();
    initActions();
  });
})();
