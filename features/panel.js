/**
 * features/panel.js — Panel de pedidos
 * Agrega un botón flotante (lista) que abre un panel con todos los pedidos
 * abiertos ordenados por tiempo, más una acción rápida para encontrar
 * el más cercano por GPS.
 *
 * Se activa/desactiva con FEATURES.panel en index.html.
 * Solo usa la API pública TicketApp — no toca variables internas del core.
 */
(function(){
  "use strict";

  // Distancia en metros entre dos coordenadas (Haversine)
  function distM(a, b){
    const R = 6371000, r = x => x * Math.PI / 180;
    const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    const s = Math.sin(dLat/2)**2 +
              Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  const fmtDist = m => m < 1000 ? Math.round(m) + " m" : (m/1000).toFixed(1) + " km";

  TicketApp.feature({
    name: "panel",
    init(app){

      // ---- Estilos propios del módulo ----
      const css = document.createElement("style");
      css.textContent = `
        /* Botón en topbar, a la izquierda del contador */
        .pnl-btn{
          border:none;background:none;cursor:pointer;
          color:rgba(255,255,255,.85);padding:6px;border-radius:8px;flex:none;
          display:flex;align-items:center;justify-content:center;
          transition:background .15s;}
        .pnl-btn:hover{background:rgba(255,255,255,.12)}
        .pnl-btn:active{background:rgba(255,255,255,.22);transform:scale(.94)}
        .pnl-btn svg{width:22px;height:22px}

        /* Scrim propio (z-index entre el mapa y el form del core) */
        .pnl-scrim{
          position:fixed;inset:0;background:rgba(15,27,45,.45);
          z-index:1050;display:none;align-items:flex-end;}
        .pnl-scrim.show{display:flex}

        /* Panel */
        .pnl-sheet{
          width:100%;max-height:78vh;
          background:var(--surface,#fff);border-radius:20px 20px 0 0;
          padding:0;box-shadow:0 -8px 30px rgba(15,27,45,.25);
          display:flex;flex-direction:column;overflow:hidden;}

        .pnl-top{padding:14px 16px 0}
        .pnl-grip{width:38px;height:4px;border-radius:2px;
          background:var(--line,#dbe3ec);margin:0 auto 14px}
        .pnl-header{
          display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .pnl-header h2{
          margin:0;font-size:16px;font-weight:680;color:var(--ink,#0f1b2d)}
        .pnl-header h2 span{
          font-size:13px;font-weight:500;color:var(--muted,#5c6b7e);margin-left:4px}
        .pnl-close{
          border:none;background:none;cursor:pointer;
          font-size:20px;color:var(--muted,#5c6b7e);line-height:1;padding:2px 6px}

        /* Botón "Más cercano" */
        .pnl-nearest{
          width:100%;padding:12px;margin-bottom:14px;
          border:1px solid var(--line,#dbe3ec);border-radius:10px;
          background:var(--surface-2,#f3f6fa);
          font-size:14px;font-weight:650;cursor:pointer;
          color:var(--ink,#0f1b2d);font-family:inherit;
          display:flex;align-items:center;justify-content:center;gap:6px;}
        .pnl-nearest:active{background:var(--line,#dbe3ec)}

        /* Separador de sección */
        .pnl-section-title{
          font-size:11px;font-weight:700;color:var(--muted,#5c6b7e);
          text-transform:uppercase;letter-spacing:.6px;
          padding:0 16px 10px;}

        /* Lista scrolleable */
        .pnl-list{overflow-y:auto;padding:0 16px;flex:1}

        /* Ítem de ticket */
        .pnl-item{
          display:flex;align-items:flex-start;gap:10px;
          padding:12px 0;border-bottom:1px solid var(--line,#dbe3ec);cursor:pointer;}
        .pnl-item:last-child{border-bottom:none}
        .pnl-item:active{opacity:.65}

        .pnl-dot{
          width:11px;height:11px;border-radius:50%;
          flex:none;margin-top:3px;box-shadow:0 1px 3px rgba(0,0,0,.2)}

        .pnl-body{flex:1;min-width:0}
        .pnl-text{
          font-size:14px;font-weight:600;color:var(--ink,#0f1b2d);line-height:1.35;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .pnl-meta{font-size:11.5px;color:var(--muted,#5c6b7e);margin-top:3px}
        .pnl-tel{font-size:11.5px;color:var(--signal-ink,#06727f);margin-top:2px;font-weight:600}

        .pnl-empty{
          text-align:center;color:var(--muted,#5c6b7e);
          padding:32px 16px;font-size:14px;line-height:1.5}
      `;
      document.head.appendChild(css);

      // ---- Botón flotante ----
      const panelBtn = document.createElement("button");
      panelBtn.className = "pnl-btn";
      panelBtn.setAttribute("aria-label", "Ver todos los pedidos");
      panelBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="9" y1="6"  x2="21" y2="6"/>
          <line x1="9" y1="12" x2="21" y2="12"/>
          <line x1="9" y1="18" x2="21" y2="18"/>
          <circle cx="3.5" cy="6"  r="1.2" fill="currentColor" stroke="none"/>
          <circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>
          <circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>
        </svg>`;
      // Insertarlo en el topbar, a la izquierda del contador
      const topbarRight = document.querySelector(".topbar-right");
      topbarRight.insertBefore(panelBtn, topbarRight.querySelector(".count"));

      // ---- Panel sheet ----
      const scrim = document.createElement("div");
      scrim.className = "pnl-scrim";
      scrim.setAttribute("role", "dialog");
      scrim.setAttribute("aria-modal", "true");
      scrim.innerHTML = `
        <div class="pnl-sheet">
          <div class="pnl-top">
            <div class="pnl-grip"></div>
            <div class="pnl-header">
              <h2>Pedidos abiertos <span id="pnl-count"></span></h2>
              <button class="pnl-close" aria-label="Cerrar panel">✕</button>
            </div>
            <button class="pnl-nearest" id="pnl-nearest">
              📍 Encontrar el más cercano a mí
            </button>
          </div>
          <div class="pnl-section-title" id="pnl-section"></div>
          <div class="pnl-list" id="pnl-list"></div>
        </div>`;
      document.body.appendChild(scrim);

      // ---- Abrir / cerrar ----
      function openPanel(){
        scrim.classList.add("show");
        renderList();
      }
      function closePanel(){ scrim.classList.remove("show"); }

      panelBtn.addEventListener("click", openPanel);
      scrim.addEventListener("click", e => { if (e.target === scrim) closePanel(); });
      scrim.querySelector(".pnl-close").addEventListener("click", closePanel);

      // ---- Render de la lista ----
      function renderList(){
        const open = app.tickets
          .filter(t => t.status !== "closed")
          .sort((a, b) => (b.ts || 0) - (a.ts || 0));

        document.getElementById("pnl-count").textContent = `(${open.length})`;
        document.getElementById("pnl-section").textContent =
          open.length
            ? `Todos · ${open.length} abierto${open.length !== 1 ? "s" : ""}`
            : "";

        const listEl = document.getElementById("pnl-list");

        if (!open.length){
          listEl.innerHTML = `<p class="pnl-empty">No hay pedidos abiertos por el momento.<br>¡Sé el primero en publicar uno!</p>`;
          return;
        }

        listEl.innerHTML = open.map(t => {
          const cat   = app.CATEGORIAS.find(c => c.v === t.categoria) || { emoji: "📦", label: "Otros" };
          const color = app.colorFor(t);
          const txt   = app.esc(String(t.pedido || "").slice(0, 120));
          const meta  = `${cat.emoji} ${cat.label} · ${app.ago(t.ts)}`;
          const tel   = t.telefono ? `<div class="pnl-tel">📞 ${app.esc(t.telefono)}</div>` : "";
          return `<div class="pnl-item" data-id="${app.esc(t.id)}">
            <div class="pnl-dot" style="background:${color}"></div>
            <div class="pnl-body">
              <div class="pnl-text">${txt}</div>
              <div class="pnl-meta">${meta}</div>
              ${tel}
            </div>
          </div>`;
        }).join("");

        listEl.querySelectorAll(".pnl-item").forEach(el => {
          el.addEventListener("click", () => {
            const id = el.dataset.id;
            const t  = app.tickets.find(x => x.id === id);
            const m  = app.markers[id];
            if (t && m){
              closePanel();
              app.map.flyTo([t.lat, t.lng], 17);
              setTimeout(() => m.openPopup(), 700);
            }
          });
        });
      }

      // ---- Más cercano ----
      document.getElementById("pnl-nearest").addEventListener("click", () => {
        if (!navigator.geolocation){ app.toast("Tu equipo no permite ubicación."); return; }
        app.toast("Buscando el más cercano…");
        navigator.geolocation.getCurrentPosition(
          pos => {
            const from = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const open = app.tickets.filter(t => t.status !== "closed");
            let best = null, bestD = Infinity;
            open.forEach(t => {
              const d = distM(from, t);
              if (d < bestD){ bestD = d; best = t; }
            });
            if (!best){ app.toast("No hay pedidos abiertos cerca."); return; }
            closePanel();
            app.map.flyTo([best.lat, best.lng], 17);
            setTimeout(() => {
              const m = app.markers[best.id];
              if (m) m.openPopup();
            }, 700);
            app.toast("Más cercano: a " + fmtDist(bestD));
          },
          () => app.toast("No pudimos obtener tu ubicación."),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });

      // ---- Se actualizan si el panel está abierto ----
      app.on("tickets:loaded", () => {
        if (scrim.classList.contains("show")) renderList();
      });
    }
  });
})();
