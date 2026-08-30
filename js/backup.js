
let sources=[];
const $=s=>document.querySelector(s);

async function boot(){
  sources=await fetch("data/backup-sources.json",{cache:"no-store"}).then(r=>r.json());
  buildFilters();
  render();
}

function buildFilters(){
  const types=[...new Set(sources.map(s=>s.type).filter(Boolean))].sort();
  $("#type").innerHTML='<option value="">全部來源類型</option>'+types.map(t=>`<option value="${t}">${t}</option>`).join("");
}

function filtered(){
  const q=$("#q").value.toLowerCase().trim();
  const t=$("#type").value;
  return sources.filter(s=>{
    const linked=(s.linked_designs||[]).map(d=>`${d.name} ${d.city} ${d.district}`).join(" ");
    const hay=[s.name,s.note,s.type,linked].filter(Boolean).join(" ").toLowerCase();
    return (!q||hay.includes(q))&&(!t||s.type===t);
  });
}

function render(){
  const list=filtered();
  $("#total").textContent=sources.length;
  $("#shown").textContent=list.length;
  $("#linked").textContent=sources.reduce((n,s)=>n+(s.linked_designs||[]).length,0);

  $("#grid").innerHTML=list.map(s=>`
    <article class="card">
      <div>
        <span class="tag">${s.type||"source"}</span>
        ${s.verified_at?`<span class="tag">查核 ${s.verified_at}</span>`:""}
      </div>
      <h3>${s.name}</h3>
      <p class="muted">${s.note||""}</p>
      <a class="sourceLink" href="${s.url}" target="_blank" rel="noopener noreferrer">開啟資料來源 ↗</a>
      ${(s.linked_designs||[]).length?`
        <div class="designs">
          <div class="muted">關聯孔蓋</div>
          ${(s.linked_designs||[]).map(d=>`<span class="designChip">${d.city||""} ${d.name||""}</span>`).join("")}
        </div>`:""}
    </article>
  `).join("");
}

$("#q").addEventListener("input",render);
$("#type").addEventListener("change",render);
boot();
