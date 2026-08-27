(function () {
  "use strict";

  /* ==========================================================================
     1) CONTROLES AUTOMÁTICOS
     Um <video controls> sem src/poster mostra uma barra de controles
     quebrada (cinza, 0:00/0:00). Por isso nenhum <video> nasce com
     `controls` no HTML — esta função liga o atributo (e esconde o ícone de
     play do estado vazio, via a classe .has-src) só quando o elemento
     realmente tem uma fonte de vídeo. Roda no carregamento e de novo toda
     vez que o alternador de idioma troca um src.
     ========================================================================== */
  function refreshVideoControls() {
    document.querySelectorAll(".video-slot video, .audio-slot video").forEach(function (v) {
      var slot = v.closest(".video-slot, .audio-slot");
      if (v.getAttribute("src") || v.querySelector("source")) {
        v.setAttribute("controls", "");
        if (slot) slot.classList.add("has-src");
      } else {
        v.removeAttribute("controls");
        if (slot) slot.classList.remove("has-src");
      }
    });
  }

  /* ==========================================================================
     2) CARREGAMENTO INTELIGENTE (IntersectionObserver)
     Todo <video> nasce com preload="none" — nada é baixado até o usuário
     chegar perto da seção. Quando o card entra a ~300px da viewport, se ele
     já tiver um src de verdade, a gente troca pra preload="auto" e chama
     .load() pra começar a bufferizar antes do usuário dar play.
     ========================================================================== */
  function initLazyVideoLoading() {
    var videos = document.querySelectorAll(".video-slot video, .audio-slot video");
    if (!("IntersectionObserver" in window) || !videos.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var v = entry.target;
          if (v.getAttribute("src") || v.querySelector("source")) {
            v.setAttribute("preload", "auto");
            v.load();
          }
          observer.unobserve(v);
        });
      },
      { rootMargin: "300px 0px", threshold: 0.01 }
    );

    videos.forEach(function (v) { observer.observe(v); });
  }

  /* ==========================================================================
     3) ALTERNADOR DE IDIOMA — SUSPENSO
     Decisão de escopo: tradução PT/EN pausada por enquanto (foco em deixar
     o site 100% pronto em português pra início das prospecções). O botão
     [PT|EN] foi removido do index.html e esta função (que trocava texto/
     src por idioma) foi removida — nada no DOM muda mais por idioma. Os
     atributos data-pt/data-en/data-img-pt/data-img-en/data-src-pt/
     data-src-en continuam nos elementos (não foram removidos do HTML, pra
     não arriscar um replace em massa arriscado por pouco ganho — sem
     JS lendo eles, são só metadado inerte) — se a tradução voltar depois,
     é só reintroduzir a função applyLang() e o listener do toggle.
     ========================================================================== */

  /* ==========================================================================
     4) FAQ — ACORDEÃO
     Um item aberto por vez: clicar numa pergunta fecha as outras. Altura
     animada via max-height medida com scrollHeight (funciona em qualquer
     navegador, sem depender de grid-template-rows).
     ========================================================================== */
  function initFaqAccordion() {
    var items = document.querySelectorAll(".faq__item");
    if (!items.length) return;

    items.forEach(function (item) {
      var button = item.querySelector(".faq__question");
      var answer = item.querySelector(".faq__answer");
      if (!button || !answer) return;

      button.addEventListener("click", function () {
        var isOpen = item.classList.contains("open");

        items.forEach(function (other) {
          if (other === item) return;
          other.classList.remove("open");
          other.querySelector(".faq__question").setAttribute("aria-expanded", "false");
          other.querySelector(".faq__answer").style.maxHeight = null;
        });

        if (isOpen) {
          item.classList.remove("open");
          button.setAttribute("aria-expanded", "false");
          answer.style.maxHeight = null;
        } else {
          item.classList.add("open");
          button.setAttribute("aria-expanded", "true");
          answer.style.maxHeight = answer.scrollHeight + "px";
        }
      });
    });

    window.addEventListener("resize", debounce(function () {
      var open = document.querySelector(".faq__item.open .faq__answer");
      if (open) open.style.maxHeight = open.scrollHeight + "px";
    }, 150));
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      t = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  /* ==========================================================================
     4b) FAIXA DE MÉTRICAS — entrada suave + contagem numérica
     Cada .stat sobe (translateY 30px→0) e aparece (opacity 0→1) ao entrar
     na tela, uma vez só, via IntersectionObserver. Nos valores que começam
     com número (+400 Mil, +20, 100%), o número também conta de 0 até o
     valor final — o texto ao redor (prefixo "+", sufixo "Mil"/"%") fica
     igual, só o número em si é trocado quadro a quadro.
     ========================================================================== */
  function initStatsAnimation() {
    var stats = document.querySelectorAll(".stat");
    if (!stats.length) return;

    function parseValue(raw) {
      var m = raw.match(/^([+]?)(\d+(?:[.,]\d+)?)(.*)$/);
      if (!m) return null;
      return { prefix: m[1], number: parseFloat(m[2].replace(",", ".")), decimals: (m[2].split(/[.,]/)[1] || "").length, suffix: m[3] };
    }

    function countUp(el, parsed, duration) {
      var start = null;
      function step(ts) {
        if (start === null) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3); // ease-out cúbico
        var current = parsed.number * eased;
        el.textContent = parsed.prefix + current.toFixed(parsed.decimals) + parsed.suffix;
        if (progress < 1) requestAnimationFrame(step);
        else el.textContent = parsed.prefix + parsed.number.toFixed(parsed.decimals) + parsed.suffix;
      }
      requestAnimationFrame(step);
    }

    var prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var stat = entry.target;
        stat.classList.add("stat--visible");
        if (!prefersReducedMotion) {
          var valueEl = stat.querySelector(".stat__value");
          var parsed = valueEl && parseValue(valueEl.textContent.trim());
          if (parsed) countUp(valueEl, parsed, 1200);
          // só liga a flutuação contínua depois que a entrada (slide-up +
          // fade, 600ms de transition) termina — senão a troca de
          // transition pra animation no meio do movimento dá um "pulo"
          window.setTimeout(function () { stat.classList.add("stat--floating"); }, 650);
        }
        observer.unobserve(stat);
      });
    }, { threshold: 0.35 });

    stats.forEach(function (stat, i) {
      stat.style.transitionDelay = (i * 90) + "ms";
      stat.style.setProperty("--float-delay", (i * 0.3) + "s");
      observer.observe(stat);
    });
  }

  /* ==========================================================================
     4c) GALERIA DE FOTOS — slide-in da esquerda, em cascata
     Cada .gallery-photo entra deslizando de translateX(-40px) até 0 com
     fade (opacity 0→1), uma vez só, quando a foto entra na viewport. O
     atraso escalona por ORDEM NO DOM (que já é esquerda→direita,
     linha-a-linha), então o efeito lê como uma onda da esquerda pra
     direita — não é um "todas de uma vez".
     ========================================================================== */
  function initGalleryReveal() {
    var photos = document.querySelectorAll(".gallery-photo");
    if (!photos.length || !("IntersectionObserver" in window)) return;

    // rootMargin negativo no fim ("-50px") exige que a foto suba mais
    // pra dentro da viewport antes de contar como visível — evita que
    // o disparo aconteça só de a borda encostar no rodapé da tela.
    var observerOptions = { threshold: 0.15, rootMargin: "0px 0px -50px 0px" };

    var galleryObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("gallery-photo--visible");
        observer.unobserve(entry.target); // anima uma vez só, nunca de novo
      });
    }, observerOptions);

    photos.forEach(function (photo, i) {
      photo.style.transitionDelay = (i * 80) + "ms";
      galleryObserver.observe(photo);
    });
  }

  /* ==========================================================================
     4c-bis) SCROLL REVEAL — fade-in + subida das seções a partir da 2a aba
     Mesmo padrão de initGalleryReveal() acima: marca os alvos com uma
     classe "de espera" (.will-reveal, escondida via CSS) e usa
     IntersectionObserver pra acrescentar .reveal na primeira vez que cada
     um entra na viewport (nunca remove depois — anima uma vez só). Alvo é
     todo [data-section-name] MENOS o Hero (data-section-name="hero"),
     que é a primeira aba e já aparece cheia na carga da página — "a
     partir da segunda aba" na prática.
     ========================================================================== */
  function initScrollReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll("[data-section-name]"))
      .filter(function (el) { return el.getAttribute("data-section-name") !== "hero"; });
    if (!targets.length) return;

    targets.forEach(function (el) { el.classList.add("will-reveal"); });

    if (!("IntersectionObserver" in window)) {
      // Sem suporte a IntersectionObserver: mostra tudo direto em vez de
      // deixar a seção escondida pra sempre (.will-reveal some via CSS).
      targets.forEach(function (el) { el.classList.add("reveal"); });
      return;
    }

    var revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("reveal");
        observer.unobserve(entry.target); // anima uma vez só, nunca de novo
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });

    targets.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ==========================================================================
     4d) DEPOIMENTOS — widget de prova social
     Busca só os depoimentos com status "aprovado" (server.js já filtra —
     o widget público nunca vê pendente/oculto) e monta os cards. Se não
     houver nenhum aprovado ainda, a seção inteira fica escondida (não
     mostra um título sem nada embaixo). Sistema de coleta completo:
     depoimento.html (formulário público) → POST /api/depoimentos (nasce
     "pendente") → aba "Depoimentos" do banco-de-leads.html (Aprovar/
     Ocultar) → só aí aparece aqui.
     ========================================================================== */
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderStarsHtml(rating) {
    var n = Math.min(5, Math.max(1, parseInt(rating, 10) || 0));
    var out = "";
    for (var i = 1; i <= 5; i++) {
      out += '<span class="' + (i <= n ? "is-on" : "") + '">★</span>';
    }
    return out;
  }

  // Fallback só pra registros antigos sem "videoKind" salvo (criados
  // antes desse campo existir) — server.js já manda o tipo certo (vindo
  // do MIME real no upload) pra qualquer depoimento novo, então isso
  // raramente entra em ação.
  var VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
  function mediaKindFromUrl(url) {
    var lower = String(url || "").toLowerCase();
    for (var i = 0; i < VIDEO_EXTENSIONS.length; i++) {
      if (lower.indexOf(VIDEO_EXTENSIONS[i]) !== -1) return "video";
    }
    return "image";
  }

  function renderTestimonialCard(item) {
    var logo = item.logoUrl
      ? '<img class="testimonial-card__logo" src="' + escapeHtml(item.logoUrl) + '" alt="" loading="lazy">'
      : '<span class="testimonial-card__logo" aria-hidden="true"></span>';

    var media = "";
    if (item.videoUrl) {
      var kind = item.videoKind || mediaKindFromUrl(item.videoUrl);
      media = kind === "video"
        ? '<video class="testimonial-card__media" src="' + escapeHtml(item.videoUrl) + '" controls playsinline preload="metadata" controlsList="nodownload nofullscreen noremoteplayback" disablepictureinpicture></video>'
        : '<img class="testimonial-card__media" src="' + escapeHtml(item.videoUrl) + '" alt="Print de resultado" loading="lazy">';
    }

    return "" +
      '<article class="testimonial-card">' +
        '<div class="testimonial-card__header">' +
          logo +
          '<div class="testimonial-card__meta">' +
            "<strong>" + escapeHtml(item.responsibleName || "") + "</strong>" +
            "<span>" + escapeHtml(item.company || "") + "</span>" +
          "</div>" +
        "</div>" +
        '<div class="testimonial-card__stars">' + renderStarsHtml(item.rating) + "</div>" +
        '<p class="testimonial-card__text">“' + escapeHtml(item.text) + '”</p>' +
        media +
      "</article>";
  }

  // Atributos padrão de todo <video> que recebe um src real — player
  // limpo (sem download/fullscreen/AirPlay/PiP), carregamento instantâneo
  // do primeiro frame (preload="metadata") e autoplay mobile sem sair de
  // tela cheia sozinho (playsinline). "controls" NASCE AUSENTE de propósito
  // — a capa some com a barra nativa (cronômetro/som/expandir) até o
  // primeiro clique; o botão de play desenhado em CSS (.video-slot__play)
  // faz esse papel visual enquanto isso.
  function applyCleanVideoAttrs(video, url) {
    video.src = url;
    video.loop = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.setAttribute("controlsList", "nodownload nofullscreen noremoteplayback");
    video.disablePictureInPicture = true;
    var slot = video.closest(".video-slot");
    if (slot) slot.classList.add("has-src"); // esconde o ícone ▶ do estado vazio (placeholder antigo)

    // Clicar em qualquer ponto do card (vídeo, ícone de play ou selo de
    // métricas — os dois últimos são pointer-events:none, então o clique
    // atravessa até aqui) liga os controles nativos e dá o play. Só faz
    // isso na PRIMEIRA vez: depois que "controls" existe, o próprio
    // navegador assume o play/pause por cima do vídeo — se a gente
    // continuasse chamando .play() em todo clique, um clique pra PAUSAR
    // pelos controles nativos seria imediatamente desfeito por essa
    // função, e o vídeo nunca pausaria de verdade.
    if (slot) {
      slot.addEventListener("click", function () {
        if (video.hasAttribute("controls")) return;
        video.setAttribute("controls", "");
        video.play().catch(function () {}); // navegador pode recusar autoplay com som — ignora silenciosamente
      });
    }

    // .is-playing no container esconde o play central e o selo de
    // métricas juntos (CSS) enquanto o vídeo toca, e traz os dois de
    // volta ao pausar/terminar — nunca ficam por cima da barra nativa.
    if (slot) {
      video.addEventListener("play", function () { slot.classList.add("is-playing"); });
      video.addEventListener("pause", function () { slot.classList.remove("is-playing"); });
      video.addEventListener("ended", function () { slot.classList.remove("is-playing"); });
    }
  }

  /* ==========================================================================
     4d-bis) CASES DE SUCESSO — vídeos dinâmicos da pasta videos/
     Em vez de exigir nomes de arquivo fixos (case-1.mp4...case-6.mp4), o
     navegador pergunta pro servidor (GET /api/videos) quais arquivos de
     vídeo REALMENTE existem em videos/ e casa cada slot com o negócio
     certo por PALAVRA-CHAVE no nome do arquivo (não pela ordem alfabética
     em que a API lista) — assim o vídeo da Churrascaria sempre cai no
     slot da Churrascaria, mesmo que o arquivo tenha sido o último a ser
     adicionado na pasta. "Sorveteria" aparece 2x (slots 4 e 6): cada
     passada consome o primeiro arquivo de sorveteria que ainda sobrar no
     pool, então os dois vídeos caem um em cada slot, nunca repetidos.
     Falta arquivo pra algum slot? Ele fica vazio (ícone ▶ do estado
     inicial) — não quebra o layout nem os outros slots já preenchidos.
     ========================================================================== */
  var CASES_SLOT_KEYWORDS = {
    "case-1": "churrascaria",
    "case-2": "restaurante",
    "case-3": "loja de roupa",
    "case-4": "sorveteria",
    "case-5": "pousada",
    "case-6": "sorveteria",
  };

  function initCasesVideos() {
    var videos = document.querySelectorAll('[data-section-name="cases-de-sucesso"] .video-slot video');
    if (!videos.length) return;

    fetch("/api/videos")
      .then(function (res) { return res.json(); })
      .then(function (files) {
        if (!files || !files.length) return;
        var pool = files.slice();
        videos.forEach(function (video) {
          var keyword = CASES_SLOT_KEYWORDS[video.getAttribute("data-slot")];
          if (!keyword) return;
          var idx = pool.findIndex(function (f) { return f.name.toLowerCase().indexOf(keyword) !== -1; });
          if (idx === -1) return;
          var file = pool.splice(idx, 1)[0];
          applyCleanVideoAttrs(video, file.url);
        });
      })
      .catch(function () { /* API fora do ar — slots ficam vazios, sem quebrar o resto da página */ });
  }

  function initTestimonials() {
    var marquee = document.getElementById("testimonials-marquee");
    var track = document.getElementById("testimonials-track");
    if (!marquee || !track) return;

    fetch("/api/depoimentos?status=aprovado")
      .then(function (res) { return res.json(); })
      .then(function (items) {
        if (!items || !items.length) return;
        // Renderiza a lista 2x seguidas — a animação anda exatamente
        // metade da largura total (translateX(-50%), ver styles.css),
        // então quando a 1ª cópia sai de tela a 2ª já está no mesmo
        // lugar, sem costura visível no loop.
        var cardsHtml = items.map(renderTestimonialCard).join("");
        track.innerHTML = cardsHtml + cardsHtml;
        marquee.hidden = false;
      })
      .catch(function () { /* API fora do ar — esteira continua escondida, sem quebrar o resto da página */ });
  }

  /* ==========================================================================
     5) ANALYTICS — núcleo (localStorage)
     Tudo fica salvo em UM objeto no localStorage, sob a chave abaixo. Igual
     ao dashboard.html: como é localStorage, os dados são por NAVEGADOR/
     DISPOSITIVO — não existe um servidor central coletando visitantes reais
     do site inteiro. Isso é o analytics "caseiro" que dá pra ter sem
     backend; serve pra você testar comportamento e olhar tendências no seu
     próprio uso, mas não substitui Google Analytics/Plausible se você quer
     números agregados de todo mundo que visita o site.
     ========================================================================== */
  var ANALYTICS_KEY = "portfolio-analytics";

  function defaultAnalytics() {
    return {
      totalPageViews: 0,
      scrollHistory: [],   // [{date, maxScrollPct}]
      sectionViews: {},    // {sectionName: count}
      sectionSeconds: {},  // {sectionName: secondsVisible}
      videoStats: {},      // {slot: {plays, totalWatchedSeconds}}
      leads: []            // [{name, company, email, whatsapp, usage, message, submittedAt, page}]
    };
  }

  var analytics = loadAnalytics();
  var savePending = false;

  function loadAnalytics() {
    try {
      var raw = localStorage.getItem(ANALYTICS_KEY);
      if (!raw) return defaultAnalytics();
      var parsed = JSON.parse(raw);
      var base = defaultAnalytics();
      return Object.assign(base, parsed);
    } catch (e) {
      return defaultAnalytics();
    }
  }

  function persistAnalyticsNow() {
    try { localStorage.setItem(ANALYTICS_KEY, JSON.stringify(analytics)); } catch (e) { /* localStorage indisponível/cheio — perde só o registro, não quebra o site */ }
    savePending = false;
  }

  var persistDebounced = debounce(persistAnalyticsNow, 800);

  function persistAnalytics(immediate) {
    savePending = true;
    if (immediate) persistAnalyticsNow();
    else persistDebounced();
  }

  function flushIfPending() {
    if (savePending) persistAnalyticsNow();
  }
  window.addEventListener("pagehide", flushIfPending);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushIfPending();
  });

  /* ---- 5a) Total de visualizações da página ---- */
  function trackPageView() {
    analytics.totalPageViews += 1;
    persistAnalytics(true);
  }

  /* ---- 5b) Ponto de abandono/rolagem ----
     Guarda o % máximo de rolagem atingido nesta visita. É salvo quando a
     página é escondida/fechada (não a cada scroll, pra não gravar toda
     hora) — assim "scrollHistory" vira um histórico de "até onde cada
     visita foi antes de sair". */
  function initScrollTracking() {
    var maxPct = 0;

    function computePct() {
      var doc = document.documentElement;
      if (doc.scrollHeight <= window.innerHeight) { maxPct = 100; return; }
      var scrolled = window.scrollY + window.innerHeight;
      var pct = Math.min(100, Math.round((scrolled / doc.scrollHeight) * 100));
      if (pct > maxPct) maxPct = pct;
    }

    window.addEventListener("scroll", throttle(computePct, 250), { passive: true });
    computePct();

    function persist() {
      analytics.scrollHistory.push({ date: new Date().toISOString(), maxScrollPct: maxPct });
      if (analytics.scrollHistory.length > 200) {
        analytics.scrollHistory = analytics.scrollHistory.slice(-200);
      }
      persistAnalytics(true);
    }
    window.addEventListener("pagehide", persist, { once: true });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") persist();
    }, { once: true });
  }

  function throttle(fn, wait) {
    var last = 0;
    var timer = null;
    return function () {
      var now = Date.now();
      var args = arguments;
      if (now - last >= wait) {
        last = now;
        fn.apply(null, args);
      } else {
        clearTimeout(timer);
        timer = setTimeout(function () { last = Date.now(); fn.apply(null, args); }, wait - (now - last));
      }
    };
  }

  /* ---- 5c) Seção mais visualizada + tempo em cada seção ----
     Qualquer elemento com data-section-name (as 17 pranchetas do Figma +
     prova social + FAQ) entra na contagem quando 40% dele fica visível. */
  function initSectionTracking() {
    var els = document.querySelectorAll("[data-section-name]");
    if (!els.length || !("IntersectionObserver" in window)) return;

    var enterTimes = {};

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var name = entry.target.getAttribute("data-section-name");
        if (entry.isIntersecting) {
          enterTimes[name] = Date.now();
          analytics.sectionViews[name] = (analytics.sectionViews[name] || 0) + 1;
          persistAnalytics(false);
        } else if (enterTimes[name]) {
          addSectionSeconds(name, (Date.now() - enterTimes[name]) / 1000);
          delete enterTimes[name];
        }
      });
    }, { threshold: 0.4 });

    els.forEach(function (el) { observer.observe(el); });

    function addSectionSeconds(name, seconds) {
      if (seconds <= 0) return;
      analytics.sectionSeconds[name] = (analytics.sectionSeconds[name] || 0) + seconds;
    }

    function flushOpenSections() {
      Object.keys(enterTimes).forEach(function (name) {
        addSectionSeconds(name, (Date.now() - enterTimes[name]) / 1000);
      });
      enterTimes = {};
      persistAnalytics(true);
    }
    window.addEventListener("pagehide", flushOpenSections, { once: true });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushOpenSections();
    }, { once: true });
  }

  /* ==========================================================================
     6) TRACKING DE VÍDEOS
     play/pause/ended em cada <video> do site: conta reproduções e soma
     tempo assistido (o relógio só roda enquanto o vídeo está de fato
     tocando — pausar/acabar/trocar de aba encerra a contagem daquele
     trecho). Funciona nos vídeos dos nichos, Cases, Funil e nos áudios de
     Feedbacks; some sozinho quando você preencher os src de verdade,
     porque só reage a eventos reais do <video>.
     ========================================================================== */
  function initVideoTracking() {
    document.querySelectorAll(".video-slot video, .audio-slot video").forEach(function (v) {
      var slot = v.getAttribute("data-slot");
      if (!slot) return;
      var playStartedAt = null;

      function ensureEntry() {
        if (!analytics.videoStats[slot]) analytics.videoStats[slot] = { plays: 0, totalWatchedSeconds: 0 };
        return analytics.videoStats[slot];
      }

      v.addEventListener("play", function () {
        playStartedAt = Date.now();
        var entry = ensureEntry();
        entry.plays += 1;
        persistAnalytics(false);
      });

      function flushWatchTime() {
        if (playStartedAt === null) return;
        var seconds = (Date.now() - playStartedAt) / 1000;
        playStartedAt = null;
        if (seconds > 0) {
          var entry = ensureEntry();
          entry.totalWatchedSeconds += seconds;
          persistAnalytics(true);
        }
      }
      v.addEventListener("pause", flushWatchTime);
      v.addEventListener("ended", flushWatchTime);
      window.addEventListener("pagehide", flushWatchTime);
    });
  }

  /* ==========================================================================
     7) POP-UP DE CAPTURA DE LEADS
     PROIBIDO aparecer no carregamento da página — nasce com display:none
     forçado via inline style (reforço, além do atributo [hidden] que o
     CSS já esconde) até um dos 3 gatilhos abaixo disparar:
       1. 20s de navegação contínua na página.
       2. 60% de rolagem da página (scrollY / altura rolável ≥ 60%).
       3. Clique em qualquer elemento com [data-open-popup] no HTML.
     O gatilho de exit-intent (mouseleave no topo da janela) foi REMOVIDO
     de propósito: em vários navegadores ele dispara um mouseleave falso
     logo nos primeiros instantes após o load (cursor perto do topo por
     causa da barra de endereço), o que abria o pop-up "sozinho" assim
     que a página carregava — exatamente o bug reportado.
     SEM trava de sessionStorage — liberado pra testar o pop-up quantas
     vezes quiser só recarregando a página (só não dispara duas vezes NO
     MESMO carregamento, controlado por uma variável em memória). */
  function initLeadPopup() {
    var popup = document.getElementById("popup-lead");
    if (!popup) return;

    // reforço explícito: mesmo que [hidden] falhe por algum motivo (CSS
    // não carregado ainda, cache antigo etc.), este display:none inline
    // garante que o pop-up nasce fisicamente invisível.
    popup.style.display = "none";

    var alreadyShownThisLoad = false;

    function openPopup() {
      if (alreadyShownThisLoad || !popup.hidden) return;
      alreadyShownThisLoad = true;
      popup.hidden = false;
      popup.style.display = ""; // devolve o controle pro CSS (.popup-overlay{display:flex})
      var firstField = popup.querySelector("#lead-name");
      if (firstField) firstField.focus();
      cleanupTriggers();
    }
    function closePopup() {
      popup.hidden = true;
      popup.style.display = "none";
    }

    popup.querySelectorAll("[data-popup-close]").forEach(function (btn) {
      btn.addEventListener("click", closePopup);
    });
    popup.addEventListener("click", function (e) {
      if (e.target === popup) closePopup();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !popup.hidden) closePopup();
    });

    // --- gatilho 1: 20s de navegação contínua ---
    var timerId = window.setTimeout(openPopup, 20000);

    // --- gatilho 2: 60% de rolagem da página ---
    function onScroll() {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return; // página cabe inteira na tela — sem scroll, esse gatilho não se aplica
      var pct = (window.scrollY / scrollable) * 100;
      if (pct >= 60) openPopup();
    }
    document.addEventListener("scroll", onScroll, { passive: true });

    // --- gatilho 3: clique num botão que abra o pop-up de propósito
    // (qualquer elemento com data-open-popup, se algum existir no HTML) ---
    document.querySelectorAll("[data-open-popup]").forEach(function (btn) {
      btn.addEventListener("click", openPopup);
    });

    function cleanupTriggers() {
      document.removeEventListener("scroll", onScroll);
      window.clearTimeout(timerId);
    }
  }

  /* ==========================================================================
     8) FORMULÁRIO DE LEADS — envio
     Todo lead é salvo no localStorage (pra aparecer no dashboard.html)
     ANTES de qualquer tentativa de rede — então nenhum contato se perde,
     mesmo que o LEAD_ENDPOINT abaixo ainda não esteja configurado ou a
     internet falhe no momento do envio.

     PRA RECEBER OS LEADS TAMBÉM NO SEU E-MAIL: crie uma conta grátis em
     https://formspree.io (ou https://web3forms.com), gere um endpoint de
     formulário, e cole a URL abaixo em LEAD_ENDPOINT. Sem isso, os leads
     ficam só aqui no dashboard local — não chegam no seu e-mail.
     ========================================================================== */
  var LEAD_ENDPOINT = ""; // <- cole aqui o endpoint do Formspree/Web3Forms

  // Função genérica — usada tanto pelo pop-up (#lead-form) quanto pela
  // seção fixa de encerramento (#final-cta-form). Os dois têm os mesmos
  // campos (name/company/instagram/email/whatsapp/usage/goal) e a mesma
  // caixa ".lead-form__success" logo depois do <form> no HTML.
  function wireLeadForm(form) {
    if (!form) return;
    var successEl = form.nextElementSibling; // .lead-form__success sempre vem logo após o form
    var submitBtn = form.querySelector(".lead-form__submit");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (typeof form.reportValidity === "function" && !form.reportValidity()) return;

      var data = Object.fromEntries(new FormData(form).entries());
      data.submittedAt = new Date().toISOString();
      data.page = location.pathname;

      analytics.leads.push(data);
      persistAnalytics(true);

      // manda pro Banco de Leads central (banco-de-leads.html), que lê a
      // mesma API deste server.js (rota /api/leads). Como este formulário
      // roda na MESMA origem do servidor, chama direto por caminho
      // relativo — nada de URL fixa (isso é só pra sites externos, ver
      // lead-connector.js). Roda em paralelo sem travar o envio: se o
      // server.js não estiver de pé, o lead já ficou salvo aqui em cima.
      fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({}, data, { source: "portfolio-ugc" })),
      }).catch(function () { /* ignora — já salvo localmente */ });

      if (submitBtn) submitBtn.disabled = true;

      function showSuccess() {
        form.hidden = true;
        if (successEl) successEl.hidden = false;
      }

      if (LEAD_ENDPOINT) {
        fetch(LEAD_ENDPOINT, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(form),
        }).then(showSuccess).catch(showSuccess); // o lead já foi salvo localmente de qualquer forma
      } else {
        showSuccess();
      }
    });
  }

  function initLeadForm() {
    wireLeadForm(document.getElementById("lead-form"));
    wireLeadForm(document.getElementById("final-cta-form"));
  }

  /* ==========================================================================
     9) BOTÃO DO WHATSAPP — só aparece depois da capa
     Fica com opacity 0 / pointer-events off (via CSS) até o usuário rolar
     além da seção de Hero. .is-visible liga/desliga junto com o scroll,
     então se a pessoa voltar pro topo o botão some de novo.
     ========================================================================== */
  function initWhatsappVisibility() {
    var btn = document.querySelector(".whatsapp-float");
    if (!btn) return;

    var THRESHOLD = 600; // px — além da capa/hero
    var ticking = false;

    function update() {
      btn.classList.toggle("is-visible", window.scrollY > THRESHOLD);
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });

    update();
  }

  document.addEventListener("DOMContentLoaded", function () {
    refreshVideoControls();
    initLazyVideoLoading();
    initFaqAccordion();
    initStatsAnimation();
    initGalleryReveal();
    initScrollReveal();
    initCasesVideos();
    initTestimonials();
    initWhatsappVisibility();

    trackPageView();
    initScrollTracking();
    initSectionTracking();
    initVideoTracking();

    initLeadPopup();
    initLeadForm();
  });
})();
