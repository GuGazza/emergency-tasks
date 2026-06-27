/**
 * features/recent.js — Panel de últimos pedidos
 * Muestra los 3 pedidos abiertos más recientes en la esquina superior izquierda,
 * debajo del topbar. Se carga visible y el usuario puede cerrarlo.
 *
 * Se activa/desactiva con FEATURES.recent en index.html.
 */
(function(){
  "use strict";

  TicketApp.feature({
    name: "recent",
    init(app){

      const css = document.createElement("style");
      css.textContent = `
        .rcnt-panel{
          position:fixed;left:10px;top:64px;z-index:790;
          width:260px;
          background:var(--surface,#fff);
          border:1px solid var(--line,#dbe3ec);
          border-radius:12px;
          box-shadow:var(--shadow,0 6px 24px rgba(15,27,45,.16));
          overflow:hidden;
          transition:transform .25s ease,opacity .25s ease;
        }
        .rcnt-panel.hidden{
          transform:translateX(-110%);
          opacity:0;
          pointer-events:none;
        }
        .rcnt-header{
          display:flex;align-items:center;justify-content:space-between;
          padding:9px 12px 8px;
          border-bottom:1px solid var(--line,#dbe3ec);
        }
        .rcnt-title{
          font-size:10.5px;font-weight:700;
          color:var(--muted,#5c6b7e);
          text-transform:uppercase;letter-spacing:.7px;
        }
        .rcnt-close{
          border:none;background:none;cursor:pointer;
          font-size:15px;color:var(--muted,#5c6b7e);
          padding:0 2px;line-height:1;
        }
        .rcnt-close:hover{color:var(--ink,#0f1b2d)}
        .rcnt-item{
          display:flex;align-items:flex-start;gap:8px;
          padding:9px 12px;
          border-bottom:1px solid var(--line,#dbe3ec);
          cursor:pointer;
          transition:background .12s;
        }
        .rcnt-item:last-child{border-bottom:none}
        .rcnt-item:hover{background:var(--surface-2,#f3f6fa)}
        .rcnt-item:active{opacity:.65}
        .rcnt-dot{
          width:9px;height:9px;border-radius:50%;
          flex:none;margin-top:3px;
          box-shadow:0 1px 2px rgba(0,0,0,.2);
        }
        .rcnt-body{flex:1;min-width:0}
        .rcnt-text{
          font-size:12.5px;font-weight:600;color:var(--ink,#0f1b2d);
          line-height:1.3;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        }
        .rcnt-meta{font-size:10.5px;color:var(--muted,#5c6b7e);margin-top:1px}
        .rcnt-empty{
          padding:14px 12px;font-size:12px;
          color:var(--muted,#5c6b7e);text-align:center;
        }
      `;
      document.head.appendChild(css);

      const panel = document.createElement("div");
      panel.className = "rcnt-panel";
      panel.setAttribute("aria-label", "Últimos pedidos");
      panel.innerHTML = `
        <div class="rcnt-header">
          <span class="rcnt-title">Últimos pedidos</span>
          <button class="rcnt-close" aria-label="Cerrar panel">✕</button>
        </div>
        <div id="rcnt-list"></div>
      `;
      document.body.appendChild(panel);

      panel.querySelector(".rcnt-close").addEventListener("click", () => {
        panel.classList.add("hidden");
      });

      function renderRecent(){
        const open = app.tickets
          .filter(t => t.status !== "closed")
          .sort((a, b) => (b.ts || 0) - (a.ts || 0))
          .slice(0, 3);

        const listEl = document.getElementById("rcnt-list");

        if (!open.length){
          listEl.innerHTML = `<div class="rcnt-empty">Sin pedidos abiertos aún</div>`;
          return;
        }

        listEl.innerHTML = open.map(t => {
          const cat   = app.CATEGORIAS.find(c => c.v === t.categoria) || { emoji: "📦", label: "Otros" };
          const color = app.colorFor(t);
          const txt   = app.esc(String(t.pedido || "").slice(0, 80));
          return `<div class="rcnt-item" data-id="${app.esc(t.id)}">
            <div class="rcnt-dot" style="background:${color}"></div>
            <div class="rcnt-body">
              <div class="rcnt-text">${txt}</div>
              <div class="rcnt-meta">${cat.emoji} ${cat.label} · ${app.ago(t.ts)}</div>
            </div>
          </div>`;
        }).join("");

        listEl.querySelectorAll(".rcnt-item").forEach(el => {
          el.addEventListener("click", () => {
            const id = el.dataset.id;
            const t  = app.tickets.find(x => x.id === id);
            const m  = app.markers[id];
            if (t && m){
              app.map.flyTo([t.lat, t.lng], 17);
              setTimeout(() => m.openPopup(), 700);
            }
          });
        });
      }

      app.on("tickets:loaded", renderRecent);
    }
  });
})();
