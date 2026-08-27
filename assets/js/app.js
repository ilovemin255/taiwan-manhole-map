
let designs = [];
let pictograms = [];
let areas = [];
let zones = [];
let sources = [];
let sites = [];
let map = null;
let zoneLayer = null;
let areaLayer = null;
let focusLayer = null;
let appliedFilters = { q: "", city: "", theme: "", photo: "" };
const CITY_ORDER = ["臺北市","新北市","基隆市","桃園市","新竹市","新竹縣","苗栗縣","臺中市","彰化縣","南投縣","雲林縣","嘉義市","嘉義縣","臺南市","高雄市","屏東縣","宜蘭縣","花蓮縣","臺東縣","澎湖縣","金門縣","連江縣"];
const cityRank = city => {
  const idx = CITY_ORDER.indexOf(city);
  return idx === -1 ? 999 : idx;
};

const $ = (selector) => document.querySelector(selector);

function showFatal(message) {
  const box = document.createElement("div");
  box.className = "loadError";
  box.innerHTML = `
    <strong>網站資料載入失敗</strong>
    <div>${message}</div>
    <div class="muted">請重新整理頁面；若仍發生，請回報這段訊息。</div>
  `;
  const main = document.querySelector("main");
  if (main) main.prepend(box);
}

async function fetchJSON(name) {
  const response = await fetch(`data/${name}.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${name}.json HTTP ${response.status}`);
  }
  return response.json();
}

async function load() {
  try {
    const bundled = window.MANHOLE_DATA || null;

    if (bundled) {
      designs = bundled.designs || [];
      areas = bundled.areas || [];
      zones = bundled.zones || [];
      sources = bundled.sources || [];
      sites = bundled.sites || [];
      pictograms = bundled.pictograms || [];
    } else {
      [designs, areas, zones, sources, sites, pictograms] = await Promise.all([
        fetchJSON("designs"),
        fetchJSON("areas"),
        fetchJSON("zones"),
        fetchJSON("sources"),
        fetchJSON("sites"),
        fetchJSON("pictograms")
      ]);
    }

    buildFilters();
    buildSources();
    bindEvents();

    // Render the database first, before any external map dependency.
    const initialList = filteredDesigns();
    renderCards(initialList);
    renderSites(initialList);
    $("#total").textContent = designs.length;
    $("#shown").textContent = initialList.length;
    $("#zonesCount").textContent = sites.length;
    $("#exact").textContent = "0";

    try {
      initMap();
      renderMap(initialList);
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 150);
    } catch (mapError) {
      console.warn("Map unavailable; database remains usable.", mapError);
      const mapEl = document.getElementById("map");
      if (mapEl) {
        mapEl.innerHTML = `
          <div class="mapFallback">
            <strong>地圖暫時無法載入</strong><br>
            <small>特色人孔蓋資料庫仍可正常瀏覽與搜尋。</small>
          </div>`;
      }
    }
  } catch (error) {
    console.error(error);
    showFatal(error.message || String(error));
  }
}

function buildFilters() {
  const cities = [...new Set(designs.map(x => x.city))].sort((a,b) => cityRank(a)-cityRank(b));
  const themes = [...new Set(designs.map(x => x.theme))].sort();

  $("#city").innerHTML =
    '<option value="">全部縣市</option>' +
    cities.map(x => `<option value="${x}">${x}</option>`).join("");

  $("#theme").innerHTML =
    '<option value="">全部主題</option>' +
    themes.map(x => `<option value="${x}">${x}</option>`).join("");
}

function buildSources() {
  const el = $("#sources");
  if (!el) return;

  el.innerHTML = sources.map(s => `
    <div class="source">
      <span class="pill">官方來源</span>
      <strong>${s.name}</strong>
      <p class="muted">${s.note || ""}</p>
      <a href="${s.url}" target="_blank" rel="noopener noreferrer">開啟原始資料 ↗</a>
    </div>
  `).join("");
}

function initMap() {
  if (typeof L === "undefined") {
    throw new Error("Leaflet 地圖程式未成功載入");
  }

  map = L.map("map", {
    zoomControl: true
  }).setView([23.75, 120.95], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  zoneLayer = L.layerGroup().addTo(map);
  areaLayer = L.layerGroup().addTo(map);
  focusLayer = L.layerGroup().addTo(map);
}

function filteredDesigns() {
  const q = (appliedFilters.q || "").toLowerCase().trim();
  const city = appliedFilters.city || "";
  const theme = appliedFilters.theme || "";
  const photo = appliedFilters.photo || "";

  return designs.filter(x => {
    const haystack = [x.name, x.city, x.district, x.theme, x.project]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchQuery = !q || haystack.includes(q);
    const matchCity = !city || x.city === city;
    const matchTheme = !theme || x.theme === theme;

    let matchPhoto = true;
    if (photo === "official") {
      matchPhoto =
        ["official_real_visual_installed","official_real_photo_installed","official_real_processed_local","official_taipei_stable_png","official_taipei_colored_detail","official_taipei_heo_fallback_png","official_taichung_colored_photo","verified_web_photo"].includes(x.image_status) ||
        x.official_photo_verified === true;
    }
    if (photo === "missing") {
      matchPhoto =
        !["official_real_visual_installed","official_real_photo_installed","official_real_processed_local","official_taipei_stable_png","official_taipei_colored_detail","official_taipei_heo_fallback_png","official_taichung_colored_photo","verified_web_photo"].includes(x.image_status) &&
        x.official_photo_verified !== true;
    }

    return matchQuery && matchCity && matchTheme && matchPhoto;
  }).sort((a,b) =>
    cityRank(a.city) - cityRank(b.city) ||
    String(a.district || "").localeCompare(String(b.district || ""), "zh-Hant") ||
    String(a.name || "").localeCompare(String(b.name || ""), "zh-Hant")
  );
}

function collectPendingFilters() {
  return {
    q: $("#q")?.value || "",
    city: $("#city")?.value || "",
    theme: $("#theme")?.value || "",
    photo: $("#photo")?.value || ""
  };
}

function executeSearch() {
  appliedFilters = collectPendingFilters();
  render();

  const results = document.getElementById("cards");
  if (results) {
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const resultHeading = document.getElementById("resultsHeading");
  if (resultHeading) {
    resultHeading.setAttribute("tabindex", "-1");
    setTimeout(() => resultHeading.focus({ preventScroll: true }), 450);
  }
}

function googleMaps(query) {
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query || "");
}

function renderSites(list) {
  const el = $("#sites");
  if (!el) return;

  const ids = new Set(list.map(x => x.id));

  const visibleSites = sites.filter(site => {
    if (!Array.isArray(site.design_ids) || site.design_ids.length === 0) return true;
    return site.design_ids.some(id => ids.has(id));
  });

  if (!visibleSites.length) {
    el.innerHTML = '<p class="muted">目前篩選結果沒有已確認的可導航場域。</p>';
    return;
  }

  el.innerHTML = visibleSites.map(site => `
    <div class="zone-card">
      <strong>${site.name}</strong>
      <div class="muted">${site.city || ""}${site.district || ""}｜${site.note || ""}</div>
      ${
        site.query
          ? `<a class="btn ghost mini" target="_blank" rel="noopener noreferrer"
               href="${googleMaps(site.query)}">導航到場域 ↗</a>`
          : ""
      }
    </div>
  `).join("");
}


function photoStatusText(design) {
  if (["official_real_visual_installed","official_real_photo_installed","official_real_processed_local","official_taipei_stable_png","official_taipei_colored_detail","official_taipei_heo_fallback_png","official_taichung_colored_photo","verified_web_photo"].includes(design.image_status)) {
    return '<div class="ok">● 官方真實孔蓋視覺已實裝</div>';
  }
  if (design.official_photo_verified) {
    return '<div class="officialFound">● 已確認官方真實照片・可開啟查看</div>';
  }
  if (design.official_visual) {
    return '<div class="pending">● 有官方來源，但本地實裝仍待處理</div>';
  }
  return '<div class="pending">● 尚無合格影像・需要補拍</div>';
}


function pictogramStrip(d) {
  if (!pictograms.length) return "";
  const active = new Set(d.pictograms || []);
  const matched = pictograms.filter(p => active.has(p.id));

  if (!matched.length) {
    return `<div class="pictogramBlock">
      <div class="pictogramHeader">
        <div class="pictogramTitle">🎨 圖案元素分類</div>
      </div>
      <div class="pictogramNone">目前沒有足夠官方描述可確認分類</div>
    </div>`;
  }

  return `<div class="pictogramBlock">
    <div class="pictogramHeader">
      <div class="pictogramTitle">🎨 圖案元素分類</div>
      <div class="pictogramCount">${matched.length} 項</div>
    </div>
    <div class="pictogramStrip" role="list" aria-label="${d.name} 符合的圖案元素">
      ${matched.map(p => `
        <span role="listitem" class="picto active" title="${p.label}">
          <span class="pictoIcon"><img src="${p.icon}" alt="" loading="lazy"></span>
          <span class="pictoLabel">${p.label}</span>
        </span>`).join("")}
    </div>
  </div>`;
}


function renderCards(list) {
  const el = $("#cards");
  if (!el) return;

  if (!list.length) {
    el.innerHTML = `
      <div class="emptyState">
        <h3>找不到符合條件的資料</h3>
        <p class="muted">請清除篩選條件後再試一次。</p>
      </div>`;
    return;
  }

  el.innerHTML = list.map(d => {
    const installed = ["official_real_visual_installed","official_real_photo_installed","official_real_processed_local","official_taipei_stable_png","official_taipei_colored_detail","official_taipei_heo_fallback_png","official_taichung_colored_photo","verified_web_photo"].includes(d.image_status);
    return `
      <article class="card photoCard">
        <div class="coverWrap ${installed ? "realInstalled" : "pendingImage"} ${d.taipei_image_crop ? "taipeiSheetCrop" : ""} ${d.cover_only ? "coverOnly" : ""} ${d.cover_shape === "square" ? "squareCover" : "roundCover"}"
             style="--cover-scale:${d.cover_scale || 1};--cover-pos-x:${d.cover_pos_x || "50%"};--cover-pos-y:${d.cover_pos_y || "50%"}">
          <img src="${d.image}" alt="${d.name}" loading="lazy"
               referrerpolicy="no-referrer"
               onerror="this.src='assets/images/covers/${d.id}.jpg';this.closest('.coverWrap').classList.add('imageFailed')">
        </div>

        <div class="coverCaption">
          <div class="coverCaptionArea">📍 ${d.display_area || [d.city,d.district].filter(Boolean).join(" ")}</div>
          <div class="coverCaptionTitle">${d.display_title || d.name}</div>
          ${d.official_location_verified_on_page ? `<div class="officialVerified">✓ 臺北蓋水官方圖片・官方位置</div>` : ""}
        </div>

        <span class="tag">${d.city}</span>
        <span class="tag">${d.district}</span>
        <span class="tag">${d.theme}</span>

        <h3 class="legacyCardTitle">${d.name}</h3>
        <p class="muted">${d.description || d.project || ""}</p>
        <div class="dataQuality">
          <span>照片：${["official_real_visual_installed","official_real_photo_installed","official_real_processed_local","official_taipei_stable_png","official_taipei_colored_detail","official_taipei_heo_fallback_png","official_taichung_colored_photo","verified_web_photo"].includes(d.image_status) ? "已實裝" : (d.official_photo_verified ? "官方照片已找到" : "待補")}</span>
          <span>位置：${d.location_mode === "temporary_search_marker" ? "暫定尋訪點" : (d.location_mode && d.location_mode.includes("exact") ? "精確" : "區域/待補")}</span>
        </div>
        ${d.field_search_area ? `<div class="huntArea"><strong>📍 尋訪範圍</strong><br>${d.field_search_area}${d.installation_evidence ? `<br><small>${d.installation_evidence}</small>` : ""}</div>` : ""}
        ${d.official_map_url ? `<div class="officialMapAction"><a href="${d.official_map_url}" target="_blank" rel="noopener noreferrer">📍 官方實際位置</a></div>` : ""}
        ${pictogramStrip(d)}

        ${photoStatusText(d)}
        ${installed ? `<div class="photoSourceBadge">✓ 真實官方視覺｜圓形裁切＋統一淺灰底顯示</div>` : ""}
        ${d.official_photo_verified && !installed ? `<div class="photoSourceBadge">✓ 已找到官方實拍來源｜原始圖檔待安全實裝</div>` : ""}

      </article>
    `;
  }).join("");
}


function designMapTarget(design) {
  // Priority 1: an explicit site coordinate tied to this design.
  const exactSite = sites.find(s =>
    Array.isArray(s.design_ids) &&
    s.design_ids.includes(design.id) &&
    Number.isFinite(s.lat) && Number.isFinite(s.lng)
  );
  if (exactSite) {
    return {
      lat: exactSite.lat, lng: exactSite.lng,
      label: exactSite.name,
      precision: exactSite.precision || "site",
      note: exactSite.note || ""
    };
  }

  // Priority 2: an official design search-zone center.
  const zone = zones.find(z =>
    z.design_name === design.name &&
    Array.isArray(z.center) && z.center.length === 2
  );
  if (zone) {
    return {
      lat: zone.center[0], lng: zone.center[1],
      label: `${design.name} 官方尋訪範圍`,
      precision: "official_search_area",
      note: `${(zone.streets || []).join("、")}｜此為官方範圍中心，不是單座孔蓋 GPS。`
    };
  }

  // Priority 3: district/city guide center.
  const area =
    areas.find(a => a.city === design.city && a.district === design.district) ||
    areas.find(a => a.city === design.city);
  if (area && Array.isArray(area.center) && area.center.length === 2) {
    return {
      lat: area.center[0], lng: area.center[1],
      label: `${design.city}${design.district || ""} 尋訪區`,
      precision: "area",
      note: area.note || "目前只有區域位置；實際孔蓋座標仍待補。"
    };
  }

  return null;
}

function focusDesignOnMap(designId) {
  if (!map) return;
  const design = designs.find(d => d.id === designId);
  if (!design) return;

  const target = designMapTarget(design);
  if (!target) {
    alert(`${design.name} 目前尚無可用的地圖位置資料。`);
    return;
  }

  // Zoom 16 is intentionally street-level: on typical desktop/mobile map sizes
  // it exposes roughly the immediate 8–12 surrounding streets without pretending
  // that an area-level target is an exact manhole GPS.
  const streetZoom = 16;
  map.invalidateSize();
  map.flyTo([target.lat, target.lng], streetZoom, { duration: 0.8 });

  if (focusLayer) {
    focusLayer.clearLayers();
    const isApprox = target.precision !== "exact";
    L.circleMarker([target.lat, target.lng], {
      radius: 13,
      weight: 4,
      fillOpacity: 0.35
    })
      .bindPopup(
        `<b>${design.name}</b><br>` +
        `<strong>${isApprox ? "📍 尋訪中心／非精確孔蓋 GPS" : "📍 孔蓋位置"}</strong><br>` +
        `${target.label}<br>` +
        `<small>${target.note || ""}</small><br>` +
        `<small>地圖已放大至街道層級，方便查看周邊約 10 條街道。</small>`
      )
      .addTo(focusLayer)
      .openPopup();
  }

  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
    mapEl.classList.remove("mapFocused");
    void mapEl.offsetWidth;
    mapEl.classList.add("mapFocused");
  }
}

function renderMap(list) {
  if (!map || !zoneLayer || !areaLayer) return;

  zoneLayer.clearLayers();
  areaLayer.clearLayers();

  const cities = new Set(list.map(x => x.city));

  areas
    .filter(a => cities.has(a.city))
    .forEach(a => {
      if (!Array.isArray(a.center) || a.center.length !== 2) return;

      L.circleMarker(a.center, {
        radius: 8,
        weight: 2,
        fillOpacity: 0.8
      })
        .bindPopup(
          `<b>${a.city} ${a.district || ""}</b><br>` +
          `<small>區域導覽，不是單座孔蓋 GPS。</small>`
        )
        .addTo(areaLayer);
    });


  // Site markers with explicit coordinates. Temporary markers are visually and textually labelled.
  const visibleIds = new Set(list.map(d => d.id));
  sites
    .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .filter(s => !Array.isArray(s.design_ids) || s.design_ids.some(id => visibleIds.has(id)))
    .forEach(s => {
      const temporary = s.precision === "temporary" || s.site_type === "temporary_search_marker";
      L.marker([s.lat, s.lng])
        .bindPopup(
          `<b>${s.name}</b><br>` +
          `${temporary ? '<strong>⚠️ 暫定位置／實際孔蓋位置待補</strong><br>' : ''}` +
          `${s.note || ''}`
        )
        .addTo(areaLayer);
    });

  zones
    .filter(z => list.some(d => d.name === z.design_name))
    .forEach(z => {
      if (!Array.isArray(z.bounds) || z.bounds.length !== 2) return;

      L.rectangle(z.bounds, {
        weight: 2,
        fillOpacity: 0.08
      })
        .bindPopup(
          `<b>${z.design_name}</b><br>` +
          `${(z.streets || []).join("、")}<br>` +
          `<small>官方範圍導覽，非單座精確 GPS。</small>`
        )
        .addTo(zoneLayer);
    });

  setTimeout(() => map.invalidateSize(), 50);
}

function render() {
  const list = filteredDesigns();

  $("#total").textContent = designs.length;
  $("#shown").textContent = list.length;
  $("#zonesCount").textContent = sites.length;
  $("#exact").textContent = "0";

  renderCards(list);
  renderSites(list);

  if (map && zoneLayer && areaLayer) {
    renderMap(list);
  }
}

function bindEvents() {
  const q = $("#q");
  const city = $("#city");
  const theme = $("#theme");
  const photo = $("#photo");
  const reset = $("#reset");
  const searchBtn = $("#executeSearch");
searchBtn?.addEventListener("click", executeSearch);

  q?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      executeSearch();
    }
  });


  // On touch devices there is no hover. A horizontal swipe across a result card
  // reveals its pictogram strip; another card collapses the previous one.
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener("touchstart", event => {
    const card = event.target.closest(".photoCard");
    if (!card || !event.touches?.length) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchend", event => {
    const card = event.target.closest(".photoCard");
    if (!card || !event.changedTouches?.length) return;
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) >= 28 && Math.abs(dx) > Math.abs(dy)) {
      document.querySelectorAll(".photoCard.showPictograms").forEach(c => {
        if (c !== card) c.classList.remove("showPictograms");
      });
      card.classList.add("showPictograms");
    }
  }, { passive: true });

  reset?.addEventListener("click", () => {
    if (q) q.value = "";
    if (city) city.value = "";
    if (theme) theme.value = "";
    if (photo) photo.value = "";

    appliedFilters = { q: "", city: "", theme: "", photo: "" };
    render();
    if (map) map.setView([23.75, 120.95], 7);

    const results = document.getElementById("resultsHeading");
    if (results) results.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  window.addEventListener("resize", () => {
    if (map) map.invalidateSize();
  });
}

load();
