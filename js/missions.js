
let missions=[];const $=s=>document.querySelector(s);
let done=JSON.parse(localStorage.getItem("tm-shot-done")||"[]");
async function boot(){missions=await fetch("data/shooting-missions.json").then(r=>r.json());build();render()}
function build(){let cs=[...new Set(missions.map(x=>x.city))],ds=[...new Set(missions.map(x=>x.district))];$("#city").innerHTML='<option value="">全部縣市</option>'+cs.map(x=>`<option>${x}</option>`).join("");$("#district").innerHTML='<option value="">全部行政區</option>'+ds.map(x=>`<option>${x}</option>`).join("")}
function maps(q){return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q)}
function filtered(){let q=$("#q").value.toLowerCase(),c=$("#city").value,d=$("#district").value;return missions.filter(x=>(!q||`${x.name}${x.city}${x.district}`.toLowerCase().includes(q))&&(!c||x.city===c)&&(!d||x.district===d))}
function toggle(id){done.includes(id)?done=done.filter(x=>x!==id):done.push(id);localStorage.setItem("tm-shot-done",JSON.stringify(done));render()}
window.toggle=toggle;
function render(){let list=filtered();$("#total").textContent=missions.length;$("#done").textContent=done.length;$("#todo").textContent=missions.length-done.length;$("#high").textContent=missions.filter(x=>x.priority==="high"&&!done.includes(x.mission_id)).length;$("#grid").innerHTML=list.map(m=>{let isDone=done.includes(m.mission_id);let sites=(m.known_sites||[]).map(s=>`<div class="sites"><strong>${s.name}</strong><div class="muted">${s.note||""}</div>${s.query?`<a class="btn" target="_blank" href="${maps(s.query)}">導航到場域 ↗</a>`:""}</div>`).join("");return `<article class="card ${isDone?"done":""}"><div class="row"><div><span class="tag">${m.city}</span><span class="tag">${m.district}</span><h3>${m.name}</h3></div><input class="check" type="checkbox" ${isDone?"checked":""} onchange="toggle('${m.mission_id}')"></div><p class="muted">${m.priority==="high"?"已有官方確認場域，優先補拍。":"目前仍需先確認最佳拍攝位置。"}</p>${sites}<details><summary>拍攝規格</summary><ul class="muted">${m.photo_rules.map(x=>`<li>${x}</li>`).join("")}</ul></details></article>`}).join("")}
["q","city","district"].forEach(id=>$("#"+id).addEventListener(id==="q"?"input":"change",render));boot();
