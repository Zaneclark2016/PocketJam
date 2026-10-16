(() => {
  "use strict";
  const STORAGE_KEY = "pocketjam.save.v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const fmt = n => Math.floor(n).toLocaleString();
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const gameInfo = [
    { id: "cookie", title: "Cookie Baker", desc: "Bake a tiny cookie empire, one click at a time.", tag: "Incremental", art: "cookie-art", image: "assets/images/cookie-baker.png", emoji: "🍪", label: "FEATURED", page: "cookie", playable: true },
    { id: "dino", title: "Dino Dash", desc: "Jump, dodge, and see how far your little dino can run.", tag: "Endless runner", art: "dino-art", image: "assets/images/dino-dash.png", emoji: "🦖", label: "QUICK REFLEXES", page: "dino", playable: true },
    { id: "bubble", title: "Bubble Pop", desc: "Pop your way to a new personal best in 30 seconds.", tag: "Score attack", art: "bubble-art", image: "assets/images/bubble-pop.jpeg", emoji: "🫧", label: "30-SECOND GAME", page: "bubble", playable: true },
    { id: "flappy", title: "Flappy Bird", desc: "Flap through the pipes and chase a high score.", tag: "Arcade classic", art: "flappy-art", image: "assets/images/flappy-bird.jpeg", emoji: "🐤", label: "NEW GAME", page: "flappy", playable: true },
    { id: "snake", title: "Snake", desc: "Eat apples, grow longer, and avoid your own tail.", tag: "Classic arcade", art: "snake-art", image: "assets/images/snake.jpeg", emoji: "🐍", label: "CLASSIC", page: "snake", playable: true },
    { id: "kart", title: "Pocket Kart", desc: "Race three laps around Sunny Meadow in colorful 3D.", tag: "3D racing", art: "kart-art", image: "", emoji: "🏎️", label: "NEW • 3D RACING", page: "kart", playable: true }
  ];

  const buildings = [
    { id: "oven", name: "Little Oven", emoji: "🔥", cost: 50, cps: 1, desc: "A tiny oven that keeps the cookies coming." },
    { id: "baker", name: "Extra Baker", emoji: "🧑‍🍳", cost: 150, cps: 3, desc: "A helpful baker who never minds another batch." },
    { id: "mixer", name: "Cookie Mixer", emoji: "🥣", cost: 400, cps: 8, desc: "Mixes dough while you plan your next move." },
    { id: "double", name: "Double Oven", emoji: "♨️", cost: 1200, cps: 25, desc: "Twice the oven, twice the cookie potential." },
    { id: "conveyor", name: "Cookie Conveyor", emoji: "🏭", cost: 5000, cps: 100, desc: "A full-on cookie production line." }
  ];
  const upgrades = [
    { id: "spatula", name: "Better Spatula", emoji: "🥄", cost: 25, desc: "+1 cookie per click.", type: "click", amount: 1 },
    { id: "timekeeper", name: "Bakery Timekeeper", emoji: "⏰", cost: 500, desc: "Unlocks earnings while you’re away (up to 8 hours).", type: "offline", amount: 0 },
    { id: "bigger", name: "Bigger Bakery", emoji: "🏪", cost: 1000, desc: "All buildings produce 20% more cookies.", type: "boost", amount: 0.2 }
  ];
  const stageData = [
    { name: "Kitchen Table", desc: "Every cookie empire starts somewhere.", min: 0, icon: "🏡", className: "stage-1", items: [] },
    { name: "Little Bakery", desc: "Your first little bakery is taking shape.", min: 1, icon: "🏠", className: "stage-2", items: ["🔥"] },
    { name: "Busy Bakery", desc: "Things are heating up in the kitchen.", min: 4, icon: "🥣", className: "stage-3", items: ["🔥", "🧑‍🍳", "🥣"] },
    { name: "Cookie Workshop", desc: "A proper cookie-making operation!", min: 10, icon: "🏭", className: "stage-4", items: ["🔥", "🧑‍🍳", "🥣", "♨️", "🍪"] },
    { name: "Cookie Empire", desc: "Behold: a legendary cookie empire.", min: 25, icon: "👑", className: "stage-5", items: ["🔥", "🧑‍🍳", "🥣", "♨️", "🏭"] }
  ];

  const defaultState = () => ({
    cookies: 0, clickPower: 1, owned: { oven: 0, baker: 0, mixer: 0, double: 0, conveyor: 0 },
    purchased: { spatula: false, timekeeper: false, bigger: false },
    favorites: [], bests: { dino: 0, bubble: 0, flappy: 0, snake: 0 }, lastSeen: Date.now(), lastSaved: Date.now()
  });
  let state = defaultState();
  let activeGenre = "all";
  let toastTimer = null;
  let saveLabelTimer = null;
  let offlineAwardToShow = 0;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state = { ...defaultState(), ...parsed };
      state.owned = { ...defaultState().owned, ...(parsed.owned || {}) };
      state.purchased = { ...defaultState().purchased, ...(parsed.purchased || {}) };
      state.bests = { ...defaultState().bests, ...(parsed.bests || {}) };
      state.favorites = Array.isArray(parsed.favorites) ? parsed.favorites : [];
      state.cookies = Math.max(0, Number(state.cookies) || 0);
      state.clickPower = Math.max(1, Number(state.clickPower) || 1);
      if (state.purchased.timekeeper && Number.isFinite(Number(state.lastSeen))) {
        const elapsedSeconds = clamp((Date.now() - Number(state.lastSeen)) / 1000, 0, 8 * 60 * 60);
        offlineAwardToShow = Math.floor(getCps() * elapsedSeconds);
        if (offlineAwardToShow > 0) state.cookies += offlineAwardToShow;
      }
      state.lastSeen = Date.now();
    } catch (error) {
      console.warn("PocketJam save could not be loaded.", error);
      state = defaultState();
    }
  }
  function saveState(manual = false) {
    state.lastSeen = Date.now();
    state.lastSaved = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const label = $("#save-status");
      if (label) label.textContent = manual ? "· Saved!" : "· Auto-save on";
      if (manual) showToast("Progress saved on this device!");
      clearTimeout(saveLabelTimer);
      saveLabelTimer = setTimeout(() => { if (label) label.textContent = "· Auto-save on"; }, 1800);
    } catch (error) {
      showToast("Couldn’t save — browser storage may be full.");
    }
  }
  function getTotalBuildings() { return buildings.reduce((sum, b) => sum + (state.owned[b.id] || 0), 0); }
  function getCps() {
    const base = buildings.reduce((sum, b) => sum + b.cps * (state.owned[b.id] || 0), 0);
    return base * (state.purchased.bigger ? 1.2 : 1);
  }
  function currentStage() {
    const total = getTotalBuildings();
    let result = stageData[0];
    stageData.forEach(stage => { if (total >= stage.min) result = stage; });
    return result;
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }
  function navigate(page) {
    const target = $(`#page-${page}`);
    if (!target) return;
    $$(".page").forEach(p => p.classList.toggle("active", p === target));
    $$(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.page === page || (page === "cookie" && link.dataset.page === "home")));
    $("#main-nav").classList.remove("open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    if (page === "dino") drawDino();
    if (page === "flappy") drawFlappy();
    if (page === "snake") drawSnake();
    if (page === "cookie") renderCookie();
  }

  function renderCards(targetSelector, list) {
    const target = $(targetSelector);
    if (!target) return;
    target.innerHTML = "";
    list.forEach(game => {
      const card = document.createElement("article");
      card.className = "game-card";
      card.innerHTML = `
        <div class="card-art ${game.art} ${game.image ? "has-image" : ""}">
          ${game.image ? `<img class="card-thumbnail" src="${game.image}" alt="" loading="lazy" onerror="this.remove(); this.parentElement.classList.remove('has-image');">` : ""}
          <span class="card-sticker">${game.label}</span>
          <button class="favorite-button ${state.favorites.includes(game.id) ? "favorited" : ""}" data-favorite="${game.id}" aria-label="${state.favorites.includes(game.id) ? "Remove" : "Add"} ${game.title} ${state.favorites.includes(game.id) ? "from" : "to"} favorites" aria-pressed="${state.favorites.includes(game.id)}">${state.favorites.includes(game.id) ? "♥" : "♡"}</button>
          <span class="card-illustration" aria-hidden="true">${game.emoji}</span>
        </div>
        <div class="card-body">
          <div class="card-title-row"><h3>${game.title}</h3></div>
          <p>${game.desc}</p>
          <div class="card-meta"><span class="card-tag">${game.tag}</span><button class="card-play" data-open-game="${game.id}">Play →</button></div>
        </div>`;
      target.appendChild(card);
    });
  }
  function renderAllCards() {
    const genreHeadings = {
      all: "All games",
      clicker: "Clicker Games",
      infinite: "Infinite Games",
      arcade: "Arcade Games",
      puzzle: "Puzzle Games",
      racing: "Racing Games"
    };
    const gamesHeading = $("#page-games .page-heading h1");
    if (gamesHeading) gamesHeading.textContent = genreHeadings[activeGenre] || "All games";
    const gamesEyebrow = $("#page-games .page-heading .eyebrow");
    if (gamesEyebrow) gamesEyebrow.textContent = activeGenre === "all" ? "THE WHOLE COLLECTION" : "BROWSE BY GENRE";
    renderCards("#home-game-grid", gameInfo);
    const genreGames = gameInfo.filter(game => {
      if (activeGenre === "all") return true;
      if (activeGenre === "clicker") return game.id === "cookie";
      if (activeGenre === "infinite") return game.id === "dino";
      if (activeGenre === "arcade") return ["bubble", "flappy", "snake"].includes(game.id);
      if (activeGenre === "puzzle") return game.id === "bubble" || game.id === "snake";
      if (activeGenre === "racing") return game.id === "kart";
      return false;
    });
    renderCards("#all-game-grid", genreGames);
    const empty = $("#genre-empty-state");
    if (empty) {
      empty.hidden = genreGames.length > 0;
      empty.textContent = activeGenre === "racing" ? "🏎️ Racing games are coming soon! Check back when we add a need-for-speed corner to the arcade." : "No games in this genre yet. Try another genre!";
    }
    $$(".genre-option").forEach(button => button.classList.toggle("active", button.dataset.genre === activeGenre));
    renderCards("#favorite-game-grid", gameInfo.filter(g => state.favorites.includes(g.id)));
    $("#favorite-count").textContent = state.favorites.length;
    $("#empty-favorites").hidden = state.favorites.length > 0;
  }
  function toggleFavorite(id) {
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id];
    renderAllCards();
    saveState();
    showToast(state.favorites.includes(id) ? "Added to your favorites ♡" : "Removed from favorites");
  }

  function renderShop() {
    $("#building-shop").innerHTML = buildings.map(b => {
      const count = state.owned[b.id] || 0;
      const cost = Math.floor(b.cost * Math.pow(1.16, count));
      const canBuy = state.cookies >= cost;
      return `<article class="shop-item ${canBuy ? "affordable" : ""}">
        <div class="shop-icon">${b.emoji}</div><div class="shop-item-info">
          <div class="shop-item-top"><h3>${b.name}</h3><span class="shop-owned">Owned ${count}</span></div>
          <p>${b.desc} +${b.cps} cookie${b.cps === 1 ? "" : "s"}/sec each.</p>
          <div class="shop-buy-row"><span class="shop-price">🍪 ${fmt(cost)}</span><button class="buy-button" data-buy-building="${b.id}" ${canBuy ? "" : "disabled"}>Buy</button></div>
        </div></article>`;
    }).join("");
    $("#upgrade-shop").innerHTML = upgrades.map(u => {
      const bought = state.purchased[u.id];
      const canBuy = !bought && state.cookies >= u.cost;
      return `<article class="shop-item ${canBuy ? "affordable" : ""}">
        <div class="shop-icon">${u.emoji}</div><div class="shop-item-info">
          <div class="shop-item-top"><h3>${u.name}</h3><span class="shop-owned">${bought ? "Owned ✓" : "Upgrade"}</span></div>
          <p>${u.desc}</p>
          <div class="shop-buy-row"><span class="shop-price">${bought ? "Purchased" : `🍪 ${fmt(u.cost)}`}</span><button class="buy-button" data-buy-upgrade="${u.id}" ${canBuy ? "" : "disabled"}>${bought ? "Done" : "Buy"}</button></div>
        </div></article>`;
    }).join("");
  }
  function renderCollection() {
    $("#collection-list").innerHTML = buildings.map(b => {
      const count = state.owned[b.id] || 0;
      return `<div class="collection-item"><span class="building-emoji">${b.emoji}</span><div><strong>${b.name}</strong><small>+${b.cps} / sec each</small></div><span class="collection-count">${count}</span></div>`;
    }).join("");
    const stage = currentStage();
    const scene = $("#bakery-scene");
    scene.className = `bakery-scene ${stage.className}`;
    $("#stage-name").textContent = stage.name;
    $("#stage-description").textContent = stage.desc;
    $("#milestone-row .milestone-icon");
    $(".milestone-icon").textContent = stage.icon;
    $("#building-total").textContent = `${getTotalBuildings()} building${getTotalBuildings() === 1 ? "" : "s"}`;
    $("#scene-items").innerHTML = stage.items.map((emoji, i) => `<span class="scene-item" style="transform:rotate(${(i%2?9:-9)}deg)">${emoji}</span>`).join("");
  }
  function renderCookie() {
    $("#cookie-count").textContent = fmt(state.cookies);
    $("#cookie-rate").textContent = `${fmt(getCps())} cookie${Math.floor(getCps()) === 1 ? "" : "s"} per second`;
    $("#click-power").textContent = fmt(state.clickPower);
    renderShop();
    renderCollection();
  }
  function buyBuilding(id) {
    const b = buildings.find(item => item.id === id);
    if (!b) return;
    const cost = Math.floor(b.cost * Math.pow(1.16, state.owned[id] || 0));
    if (state.cookies < cost) return;
    state.cookies -= cost;
    state.owned[id] = (state.owned[id] || 0) + 1;
    renderCookie(); saveState(); showToast(`${b.name} added to your bakery!`);
  }
  function buyUpgrade(id) {
    const u = upgrades.find(item => item.id === id);
    if (!u || state.purchased[id] || state.cookies < u.cost) return;
    state.cookies -= u.cost;
    state.purchased[id] = true;
    if (u.type === "click") state.clickPower += u.amount;
    renderCookie(); saveState(); showToast(`${u.name} unlocked!`);
  }
  function clickCookie() {
    state.cookies += state.clickPower;
    const layer = $("#click-floats");
    const floater = document.createElement("span");
    floater.className = "float-number";
    floater.textContent = `+${fmt(state.clickPower)}`;
    floater.style.left = `${43 + Math.random() * 20}%`;
    floater.style.top = `${42 + Math.random() * 20}%`;
    layer.appendChild(floater);
    setTimeout(() => floater.remove(), 850);
    renderCookie();
  }
  function initCookie() {
    $("#cookie-button").addEventListener("click", clickCookie);
    $("#save-button").addEventListener("click", () => saveState(true));
    $("#dismiss-welcome").addEventListener("click", () => $("#welcome-back").hidden = true);
    $$("[data-shop-tab]").forEach(button => button.addEventListener("click", () => {
      const tab = button.dataset.shopTab;
      $$("[data-shop-tab]").forEach(b => { b.classList.toggle("active", b === button); b.setAttribute("aria-selected", b === button ? "true" : "false"); });
      $("#shop-buildings").classList.toggle("active", tab === "buildings");
      $("#shop-upgrades").classList.toggle("active", tab === "upgrades");
    }));
    $("#building-shop").addEventListener("click", event => {
      const button = event.target.closest("[data-buy-building]");
      if (button) buyBuilding(button.dataset.buyBuilding);
    });
    $("#upgrade-shop").addEventListener("click", event => {
      const button = event.target.closest("[data-buy-upgrade]");
      if (button) buyUpgrade(button.dataset.buyUpgrade);
    });
    if (offlineAwardToShow > 0 && state.purchased.timekeeper) {
      $("#offline-award").textContent = `+${fmt(offlineAwardToShow)} cookies baked while you were away`;
      $("#welcome-back").hidden = false;
    }
    renderCookie();
    setInterval(() => {
      const cps = getCps();
      if (cps > 0) state.cookies += cps;
      renderCookie();
    }, 1000);
    setInterval(() => saveState(), 5000);
    window.addEventListener("beforeunload", () => saveState());
  }

  // Dino Dash: lightweight canvas runner, no external assets.
  const dino = { running: false, over: false, score: 0, best: 0, y: 0, vy: 0, obstacles: [], last: 0, frame: 0, raf: 0 };
  const canvas = $("#dino-canvas");
  const ctx = canvas.getContext("2d");
  function drawDino() {
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "#e3f7ec"; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = "#b7e7d1"; ctx.beginPath(); ctx.ellipse(90,210,95,24,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#9ad9bb"; ctx.beginPath(); ctx.ellipse(650,205,140,35,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle = "#5b9c7e"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0,215); ctx.lineTo(w,215); ctx.stroke();
    // Clouds
    ctx.fillStyle = "rgba(255,255,255,.8)";
    [[160,48],[520,70]].forEach(([x,y]) => { ctx.beginPath(); ctx.arc(x,y,15,0,Math.PI*2); ctx.arc(x+17,y-7,20,0,Math.PI*2); ctx.arc(x+38,y,14,0,Math.PI*2); ctx.fill(); });
    const dy = dino.y;
    // Cute dinosaur
    ctx.fillStyle = "#258b6c"; ctx.fillRect(82,154-dy,42,48); ctx.fillRect(105,132-dy,37,34);
    ctx.fillRect(74,174-dy,18,12); ctx.fillRect(67,164-dy,12,10);
    ctx.fillStyle = "#258b6c"; ctx.fillRect(88,196-dy,12,18); ctx.fillRect(111,196-dy,12,18);
    ctx.fillStyle = "#fff"; ctx.fillRect(128,140-dy,8,8); ctx.fillStyle = "#233c32"; ctx.fillRect(132,142-dy,4,4);
    ctx.fillStyle = "#f5b6a5"; ctx.fillRect(115,154-dy,18,5);
    ctx.fillStyle = "#167052"; ctx.fillRect(82,166-dy,16,6);
    // Chunky green cacti with clearly visible arms.
    dino.obstacles.forEach(o => {
      const height = o.h;
      const top = 215 - height;
      const stemW = Math.max(10, o.w - 10);
      const stemX = o.x + (o.w - stemW) / 2;
      // Lower both arm joints so they sit closer to the cactus base.
      const leftY = top + height * 0.58 + 6;
      const rightY = top + height * 0.35 + 6;
      ctx.fillStyle = "#2f9e55";
      // Arms are thick and drawn behind the trunk so they visibly connect.
      ctx.fillRect(stemX - 7, leftY, 10, 7);
      ctx.fillRect(stemX - 7, leftY - 9, 7, 16);
      ctx.fillRect(stemX + stemW - 2, rightY, 10, 7);
      ctx.fillRect(stemX + stemW + 3, rightY - 8, 7, 15);
      ctx.fillRect(stemX, top, stemW, height);
      ctx.fillStyle = "#66c878";
      ctx.fillRect(stemX + 2, top + 4, 3, Math.max(7, height - 4));
    });
    ctx.fillStyle = "#8eae9e"; ctx.font = "bold 12px system-ui"; ctx.fillText("POCKETJAM PARK", 18, 24);
    if (!dino.running && !dino.over) { ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.fillRect(220,80,320,66); ctx.fillStyle = "#294b3c"; ctx.font = "bold 20px system-ui"; ctx.textAlign = "center"; ctx.fillText("Ready, dino?",380,107); ctx.font = "12px system-ui"; ctx.fillText("Jump over the little stumps!",380,128); ctx.textAlign = "left"; }
    if (dino.over) { ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.fillRect(220,78,320,72); ctx.fillStyle = "#294b3c"; ctx.textAlign = "center"; ctx.font = "bold 20px system-ui"; ctx.fillText("Run over!",380,107); ctx.font = "12px system-ui"; ctx.fillText("Tap Play again to have another go.",380,129); ctx.textAlign = "left"; }
  }
  function resetDino() {
    cancelAnimationFrame(dino.raf);
    dino.running = false; dino.over = false; dino.score = 0; dino.y = 0; dino.vy = 0; dino.obstacles = []; dino.last = 0; dino.frame = 0;
    $("#dino-score").textContent = "0"; $("#dino-message").textContent = "Press Space, ↑, or tap JUMP to start.";
    drawDino();
  }
  function jumpDino() {
    if (dino.over) return;
    if (!dino.running) { dino.running = true; dino.last = performance.now(); dino.raf = requestAnimationFrame(stepDino); $("#dino-message").textContent = "Nice run! Keep hopping."; }
    if (dino.y <= 0) dino.vy = 10.8;
  }
  function stepDino(now) {
    if (!dino.running) return;
    const dt = Math.min((now - dino.last) / 16.67, 2.2); dino.last = now; dino.frame += dt;
    dino.vy -= .55 * dt; dino.y = Math.max(0, dino.y + dino.vy * dt); if (dino.y === 0) dino.vy = 0;
    if (dino.frame % Math.max(32, 72 - dino.score / 8) < dt) dino.obstacles.push({ x: 780, w: 18 + Math.random()*10, h: 24 + Math.random()*23, passed: false });
    // Start a little quicker, then gradually ramp up as the run continues.
    const speed = 5.2 + Math.min(5.5, dino.score / 110);
    dino.obstacles.forEach(o => { o.x -= speed * dt; if (!o.passed && o.x + o.w < 82) { o.passed = true; dino.score += 1; $("#dino-score").textContent = dino.score; } });
    dino.obstacles = dino.obstacles.filter(o => o.x > -40);
    const collision = dino.obstacles.some(o => o.x < 121 && o.x + o.w > 76 && (215-o.h) < (202-dino.y) && dino.y < o.h + 25);
    if (collision) {
      dino.running = false; dino.over = true;
      if (dino.score > dino.best) { dino.best = dino.score; state.bests.dino = dino.best; $("#dino-best").textContent = dino.best; saveState(); }
      $("#dino-message").textContent = `Run over! You scored ${dino.score}.`;
      drawDino(); return;
    }
    drawDino(); dino.raf = requestAnimationFrame(stepDino);
  }
  function initDino() {
    dino.best = Number(state.bests.dino) || 0; $("#dino-best").textContent = dino.best;
    $("#dino-jump").addEventListener("click", jumpDino);
    $("#dino-restart").addEventListener("click", resetDino);
    canvas.addEventListener("pointerdown", jumpDino);
    window.addEventListener("keydown", e => {
      if (["Space","ArrowUp"].includes(e.code) && $("#page-dino").classList.contains("active")) { e.preventDefault(); jumpDino(); }
    });
    resetDino();
  }

  // Flappy Bird: tap or press Space to flap through the pipes.
  const flappy = { active: false, over: false, score: 0, best: 0, birdY: 185, velocity: 0, pipes: [], frame: 0, nextPipeAt: 34, last: 0, raf: 0 };
  const flappyCanvas = $("#flappy-canvas");
  const flappyCtx = flappyCanvas.getContext("2d");
  function drawFlappy() {
    if (!flappyCtx) return;
    const w = flappyCanvas.width, h = flappyCanvas.height;
    flappyCtx.clearRect(0, 0, w, h);
    flappyCtx.fillStyle = "#b9e8ff"; flappyCtx.fillRect(0, 0, w, h);
    // Soft clouds and distant hills.
    flappyCtx.fillStyle = "rgba(255,255,255,.78)";
    [[110,70],[440,105],[650,50]].forEach(([x,y]) => {
      flappyCtx.beginPath(); flappyCtx.arc(x,y,18,0,Math.PI*2); flappyCtx.arc(x+22,y-8,23,0,Math.PI*2); flappyCtx.arc(x+45,y,17,0,Math.PI*2); flappyCtx.fill();
    });
    flappyCtx.fillStyle = "#a4dfb0";
    flappyCtx.beginPath(); flappyCtx.ellipse(140,390,210,65,0,0,Math.PI*2); flappyCtx.ellipse(540,390,260,70,0,0,Math.PI*2); flappyCtx.fill();
    // Pipes.
    flappy.pipes.forEach(p => {
      const gap = 142, pipeW = 64, bottomY = p.gapY + gap / 2, topBottom = p.gapY - gap / 2;
      flappyCtx.fillStyle = "#31a85b";
      flappyCtx.fillRect(p.x, 0, pipeW, topBottom);
      flappyCtx.fillRect(p.x - 6, topBottom - 18, pipeW + 12, 18);
      flappyCtx.fillRect(p.x, bottomY, pipeW, h - bottomY - 34);
      flappyCtx.fillRect(p.x - 6, bottomY, pipeW + 12, 18);
      flappyCtx.fillStyle = "#70d783";
      flappyCtx.fillRect(p.x + 8, 0, 7, Math.max(0, topBottom - 18));
      flappyCtx.fillRect(p.x + 8, bottomY + 18, 7, Math.max(0, h - bottomY - 52));
    });
    flappyCtx.fillStyle = "#e9c86d"; flappyCtx.fillRect(0, h - 34, w, 34);
    flappyCtx.fillStyle = "#6dbd67"; flappyCtx.fillRect(0, h - 34, w, 7);
    for (let x = 0; x < w; x += 32) { flappyCtx.fillStyle = "#d4aa50"; flappyCtx.fillRect(x, h - 18, 16, 4); }
    // Little yellow bird.
    const bx = 180, by = flappy.birdY;
    flappyCtx.save(); flappyCtx.translate(bx, by); flappyCtx.rotate(Math.max(-0.35, Math.min(0.8, flappy.velocity * 0.045)));
    flappyCtx.fillStyle = "#ffd34e"; flappyCtx.beginPath(); flappyCtx.ellipse(0,0,20,16,0,0,Math.PI*2); flappyCtx.fill();
    flappyCtx.fillStyle = "#f4a62a"; flappyCtx.beginPath(); flappyCtx.moveTo(15,-1); flappyCtx.lineTo(31,4); flappyCtx.lineTo(15,9); flappyCtx.closePath(); flappyCtx.fill();
    flappyCtx.fillStyle = "#fff"; flappyCtx.beginPath(); flappyCtx.arc(7,-7,6,0,Math.PI*2); flappyCtx.fill();
    flappyCtx.fillStyle = "#253b4a"; flappyCtx.beginPath(); flappyCtx.arc(9,-7,2.5,0,Math.PI*2); flappyCtx.fill();
    flappyCtx.fillStyle = "#f3a52c"; flappyCtx.beginPath(); flappyCtx.ellipse(-8,7,9,5,-0.3,0,Math.PI*2); flappyCtx.fill();
    flappyCtx.restore();
    flappyCtx.fillStyle = "rgba(255,255,255,.88)"; flappyCtx.fillRect(18,16,96,38);
    flappyCtx.fillStyle = "#294b3c"; flappyCtx.font = "bold 22px system-ui"; flappyCtx.fillText(String(flappy.score), 32, 42);
    if (!flappy.active && !flappy.over) {
      flappyCtx.fillStyle = "rgba(255,255,255,.9)"; flappyCtx.fillRect(230,145,300,82);
      flappyCtx.fillStyle = "#294b3c"; flappyCtx.textAlign = "center"; flappyCtx.font = "bold 23px system-ui"; flappyCtx.fillText("Ready to flap?",380,177);
      flappyCtx.font = "13px system-ui"; flappyCtx.fillText("Tap or press Space to start",380,202); flappyCtx.textAlign = "left";
    } else if (flappy.over) {
      flappyCtx.fillStyle = "rgba(255,255,255,.92)"; flappyCtx.fillRect(220,142,320,94);
      flappyCtx.fillStyle = "#294b3c"; flappyCtx.textAlign = "center"; flappyCtx.font = "bold 24px system-ui"; flappyCtx.fillText("Bonk! Game over",380,177);
      flappyCtx.font = "13px system-ui"; flappyCtx.fillText("Tap Play again for another try",380,203); flappyCtx.textAlign = "left";
    }
  }
  function resetFlappy() {
    cancelAnimationFrame(flappy.raf);
    flappy.active = false; flappy.over = false; flappy.score = 0; flappy.birdY = 185; flappy.velocity = 0; flappy.pipes = []; flappy.frame = 0; flappy.nextPipeAt = 34; flappy.last = 0;
    $("#flappy-score").textContent = "0"; $("#flappy-message").textContent = "Tap, click, or press Space to flap.";
    drawFlappy();
  }
  function flapBird() {
    if (flappy.over) return;
    if (!flappy.active) { flappy.active = true; flappy.last = performance.now(); flappy.raf = requestAnimationFrame(stepFlappy); $("#flappy-message").textContent = "Keep flapping!"; }
    flappy.velocity = -5.8;
  }
  function endFlappy() {
    flappy.active = false; flappy.over = true;
    if (flappy.score > flappy.best) { flappy.best = flappy.score; state.bests.flappy = flappy.best; $("#flappy-best").textContent = flappy.best; saveState(); }
    $("#flappy-message").textContent = `Game over! You scored ${flappy.score}.`;
    drawFlappy();
  }
  function stepFlappy(now) {
    if (!flappy.active) return;
    const dt = Math.min(Math.max((now - flappy.last) / 16.67, 0), 2.5);
    flappy.last = now;
    flappy.frame += dt;
    flappy.velocity += 0.28 * dt;
    flappy.birdY += flappy.velocity * dt;

    // Spawn pipes on a fixed frame schedule so timing stays reliable at different frame rates.
    if (flappy.frame >= flappy.nextPipeAt) {
      flappy.pipes.push({ x: flappyCanvas.width + 30, gapY: 115 + Math.random() * 190, passed: false });
      flappy.nextPipeAt = flappy.frame + 92;
    }

    flappy.pipes.forEach(p => {
      p.x -= 3.15 * dt;
      if (!p.passed && p.x + 64 < 180) {
        p.passed = true;
        flappy.score++;
        $("#flappy-score").textContent = flappy.score;
      }
    });
    flappy.pipes = flappy.pipes.filter(p => p.x > -80);

    const birdLeft = 160, birdRight = 200;
    const birdTop = flappy.birdY - 14, birdBottom = flappy.birdY + 14;
    const hitPipe = flappy.pipes.some(p => {
      const overlapX = birdRight > p.x - 6 && birdLeft < p.x + 70;
      const gapTop = p.gapY - 71, gapBottom = p.gapY + 71;
      return overlapX && (birdTop < gapTop || birdBottom > gapBottom);
    });
    const hitCeiling = flappy.birdY - 14 <= 0;
    const hitGround = flappy.birdY + 14 >= flappyCanvas.height - 34;
    if (hitCeiling || hitGround || hitPipe) {
      endFlappy();
      return;
    }
    drawFlappy();
    flappy.raf = requestAnimationFrame(stepFlappy);
  }
  function initFlappy() {
    flappy.best = Number(state.bests.flappy) || 0; $("#flappy-best").textContent = flappy.best;
    $("#flappy-flap").addEventListener("click", flapBird);
    $("#flappy-restart").addEventListener("click", resetFlappy);
    flappyCanvas.addEventListener("pointerdown", flapBird);
    window.addEventListener("keydown", e => {
      if (e.code === "Space" && $("#page-flappy").classList.contains("active")) { e.preventDefault(); flapBird(); }
    });
    resetFlappy();
  }


  // Snake: grid-based arcade game with keyboard and touch controls.
  const snakeCanvas = $("#snake-canvas");
  const snakeCtx = snakeCanvas.getContext("2d");
  const snakeCols = 25, snakeRows = 20, snakeTile = 24;
  const snakeGame = { active: false, over: false, score: 0, best: 0, body: [], dir: {x:1,y:0}, nextDir: {x:1,y:0}, apple: {x:17,y:10}, timer: null };
  function placeSnakeApple() {
    let spot;
    do { spot = { x: Math.floor(Math.random()*snakeCols), y: Math.floor(Math.random()*snakeRows) }; }
    while (snakeGame.body.some(part => part.x === spot.x && part.y === spot.y));
    snakeGame.apple = spot;
  }
  function resetSnake() {
    clearInterval(snakeGame.timer);
    snakeGame.active = false; snakeGame.over = false; snakeGame.score = 0;
    snakeGame.body = [{x:12,y:10},{x:11,y:10},{x:10,y:10}];
    snakeGame.dir = {x:1,y:0}; snakeGame.nextDir = {x:1,y:0};
    $("#snake-score").textContent = "0";
    $("#snake-message").textContent = "Use arrow keys or WASD to move. Press Start when you’re ready!";
    $("#snake-start").textContent = "Start game";
    placeSnakeApple(); drawSnake();
  }
  function drawSnake() {
    if (!snakeCtx) return;
    const w=snakeCanvas.width, h=snakeCanvas.height;
    snakeCtx.fillStyle="#102b35"; snakeCtx.fillRect(0,0,w,h);
    snakeCtx.strokeStyle="rgba(155,220,198,.09)"; snakeCtx.lineWidth=1;
    for(let x=0;x<=w;x+=snakeTile){snakeCtx.beginPath();snakeCtx.moveTo(x,0);snakeCtx.lineTo(x,h);snakeCtx.stroke();}
    for(let y=0;y<=h;y+=snakeTile){snakeCtx.beginPath();snakeCtx.moveTo(0,y);snakeCtx.lineTo(w,y);snakeCtx.stroke();}
    snakeCtx.fillStyle="#ff657a"; snakeCtx.beginPath();
    snakeCtx.arc(snakeGame.apple.x*snakeTile+snakeTile/2,snakeGame.apple.y*snakeTile+snakeTile/2, snakeTile*.38,0,Math.PI*2); snakeCtx.fill();
    snakeCtx.fillStyle="#ffb0b8"; snakeCtx.beginPath(); snakeCtx.arc(snakeGame.apple.x*snakeTile+snakeTile*.37,snakeGame.apple.y*snakeTile+snakeTile*.36,3,0,Math.PI*2); snakeCtx.fill();
    snakeGame.body.forEach((part,i)=>{
      const pad=i===0?2:3;
      snakeCtx.fillStyle=i===0?"#8cf078":"#42d878";
      snakeCtx.beginPath(); snakeCtx.roundRect(part.x*snakeTile+pad,part.y*snakeTile+pad,snakeTile-pad*2,snakeTile-pad*2,5); snakeCtx.fill();
      if(i===0){
        snakeCtx.fillStyle="#153d35";
        const ex=part.x*snakeTile+ (snakeGame.dir.x===-1?6:snakeGame.dir.x===1?17:8);
        const ey=part.y*snakeTile+ (snakeGame.dir.y===-1?6:snakeGame.dir.y===1?17:7);
        if(snakeGame.dir.x!==0){snakeCtx.beginPath();snakeCtx.arc(ex,ey,2.1,0,Math.PI*2);snakeCtx.arc(ex,ey+8,2.1,0,Math.PI*2);snakeCtx.fill();}
        else {snakeCtx.beginPath();snakeCtx.arc(ex,ey,2.1,0,Math.PI*2);snakeCtx.arc(ex+8,ey,2.1,0,Math.PI*2);snakeCtx.fill();}
      }
    });
    if(!snakeGame.active){
      snakeCtx.fillStyle="rgba(5,20,28,.72)"; snakeCtx.fillRect(0,0,w,h);
      snakeCtx.fillStyle="#ffffff"; snakeCtx.textAlign="center";
      snakeCtx.font="bold 30px system-ui"; snakeCtx.fillText(snakeGame.over?"Game over!":"Ready, snake?",w/2,h/2-12);
      snakeCtx.font="16px system-ui"; snakeCtx.fillStyle="#c6f8d5";
      snakeCtx.fillText(snakeGame.over?"Press Restart to try again":"Eat the apples. Don't bonk!",w/2,h/2+22);
      snakeCtx.textAlign="left";
    }
  }
  function startSnake() {
    if(snakeGame.active) return;
    if(snakeGame.over) resetSnake();
    snakeGame.active=true; $("#snake-start").textContent="Pause";
    $("#snake-message").textContent="Nice and steady — eat those apples!";
    snakeGame.timer=setInterval(stepSnake,115); drawSnake();
  }
  function endSnake() {
    snakeGame.active=false; snakeGame.over=true; clearInterval(snakeGame.timer);
    $("#snake-start").textContent="Play again";
    $("#snake-message").textContent="Game over! You scored "+snakeGame.score+".";
    if(snakeGame.score>snakeGame.best){
      snakeGame.best=snakeGame.score; state.bests.snake=snakeGame.best;
      $("#snake-best").textContent=snakeGame.best; saveState();
    }
    drawSnake();
  }
  function stepSnake() {
    snakeGame.dir={...snakeGame.nextDir};
    const head={x:snakeGame.body[0].x+snakeGame.dir.x,y:snakeGame.body[0].y+snakeGame.dir.y};
    const eating=head.x===snakeGame.apple.x && head.y===snakeGame.apple.y;
    const bodyToCheck=eating?snakeGame.body:snakeGame.body.slice(0,-1);
    if(head.x<0||head.y<0||head.x>=snakeCols||head.y>=snakeRows||bodyToCheck.some(p=>p.x===head.x&&p.y===head.y)){endSnake();return;}
    snakeGame.body.unshift(head);
    if(eating){
      snakeGame.score++; $("#snake-score").textContent=snakeGame.score;
      placeSnakeApple();
    } else snakeGame.body.pop();
    drawSnake();
  }
  function changeSnakeDirection(dir) {
    const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
    const next=dirs[dir]; if(!next) return;
    if(next.x===-snakeGame.dir.x && next.y===-snakeGame.dir.y) return;
    snakeGame.nextDir=next;
    if(!snakeGame.active && !snakeGame.over) drawSnake();
  }
  function initSnake() {
    snakeGame.best=Number(state.bests.snake)||0; $("#snake-best").textContent=snakeGame.best;
    $("#snake-start").addEventListener("click",()=>snakeGame.active?(snakeGame.active=false,clearInterval(snakeGame.timer),$("#snake-start").textContent="Resume",$("#snake-message").textContent="Game paused.",drawSnake()):startSnake());
    $("#snake-restart").addEventListener("click",resetSnake);
    document.querySelectorAll("[data-snake-dir]").forEach(button=>button.addEventListener("click",()=>changeSnakeDirection(button.dataset.snakeDir)));
    window.addEventListener("keydown",e=>{
      if(!$("#page-snake").classList.contains("active")) return;
      const map={ArrowUp:"up",KeyW:"up",ArrowDown:"down",KeyS:"down",ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right"};
      if(map[e.code]){e.preventDefault();changeSnakeDirection(map[e.code]);}
    });
    resetSnake();
  }

  // Bubble Pop: simple 30-second score challenge.
  let bubble = { active: false, score: 0, time: 30, best: Number(state.bests.bubble) || 0, interval: null, spawner: null };
  function spawnBubble() {
    const field = $("#bubble-field");
    if (!bubble.active) return;
    const b = document.createElement("button");
    const size = 42 + Math.random() * 35;
    const colors = ["#b8e9ff", "#ffc7df", "#d9ccff", "#c5f2d9", "#ffe59a"];
    b.className = "bubble";
    b.setAttribute("aria-label", "Pop bubble for one point");
    b.style.width = `${size}px`; b.style.height = `${size}px`;
    b.style.left = `${Math.random() * Math.max(1, field.clientWidth-size)}px`;
    b.style.top = `${Math.random() * Math.max(1, field.clientHeight-size)}px`;
    b.style.background = colors[Math.floor(Math.random()*colors.length)];
    b.addEventListener("click", () => {
      if (!bubble.active) return;
      bubble.score += 1; $("#bubble-score").textContent = bubble.score; b.remove();
      if (Math.random() < .2) spawnBubble();
    }, { once: true });
    field.appendChild(b);
    setTimeout(() => b.remove(), 2600);
  }
  function finishBubble() {
    bubble.active = false; clearInterval(bubble.interval); clearInterval(bubble.spawner);
    $$(".bubble", $("#bubble-field")).forEach(b => b.remove());
    $("#bubble-message").textContent = `Time! You popped ${bubble.score} bubbles.`;
    $("#bubble-again").hidden = false;
    if (bubble.score > bubble.best) {
      bubble.best = bubble.score; state.bests.bubble = bubble.best; $("#bubble-best").textContent = bubble.best; saveState();
      $("#bubble-message").textContent += " New personal best!";
    }
  }
  function startBubble() {
    clearInterval(bubble.interval); clearInterval(bubble.spawner);
    bubble.active = true; bubble.score = 0; bubble.time = 30;
    $("#bubble-score").textContent = "0"; $("#bubble-time").textContent = "30"; $("#bubble-message").textContent = "Pop, pop, pop!";
    $("#bubble-again").hidden = true;
    $("#bubble-field").innerHTML = "";
    for (let i=0;i<5;i++) spawnBubble();
    bubble.spawner = setInterval(() => { if (bubble.active) spawnBubble(); }, 650);
    bubble.interval = setInterval(() => { bubble.time--; $("#bubble-time").textContent = bubble.time; if (bubble.time <= 0) finishBubble(); }, 1000);
  }
  function initBubble() {
    $("#bubble-best").textContent = bubble.best;
    $("#bubble-start").addEventListener("click", startBubble);
    $("#bubble-again").addEventListener("click", startBubble);
  }


  function initNavigation() {
    const drawer = $("#genre-drawer");
    const drawerToggle = $("#genre-drawer-toggle");
    const edge = $("#genre-edge");
    let drawerCloseTimer = null;
    const openGenres = () => {
      clearTimeout(drawerCloseTimer);
      drawer.classList.add("open");
      drawerToggle.setAttribute("aria-expanded", "true");
    };
    const closeGenres = () => {
      drawer.classList.remove("open");
      drawerToggle.setAttribute("aria-expanded", "false");
    };
    if (drawer && drawerToggle && edge) {
      edge.addEventListener("mouseenter", openGenres);
      drawer.addEventListener("mouseenter", openGenres);
      drawer.addEventListener("mouseleave", () => {
        drawerCloseTimer = setTimeout(() => {
          if (!drawer.matches(":focus-within")) closeGenres();
        }, 220);
      });
      edge.addEventListener("mouseleave", () => {
        drawerCloseTimer = setTimeout(() => {
          if (!drawer.matches(":focus-within")) closeGenres();
        }, 220);
      });
      drawerToggle.addEventListener("click", () => {
        if (drawer.classList.contains("open")) closeGenres();
        else openGenres();
      });
      drawer.addEventListener("focusout", event => {
        if (!drawer.contains(event.relatedTarget)) closeGenres();
      });
    }
    document.addEventListener("click", event => {
      const genreButton = event.target.closest("[data-genre]");
      if (genreButton) {
        activeGenre = genreButton.dataset.genre;
        renderAllCards();
        navigate("games");
        closeGenres();
        return;
      }
      const pageButton = event.target.closest("[data-page]");
      const openButton = event.target.closest("[data-open-game]");
      const favButton = event.target.closest("[data-favorite]");
      if (pageButton) { navigate(pageButton.dataset.page); return; }
      if (openButton) { if (openButton.dataset.openGame === "kart") { window.location.href = "pocket-kart.html"; return; } navigate(openButton.dataset.openGame); return; }
      if (favButton) { event.stopPropagation(); toggleFavorite(favButton.dataset.favorite); }
    });
    $("#menu-toggle").addEventListener("click", () => {
      const nav = $("#main-nav");
      nav.classList.toggle("open");
      $("#menu-toggle").setAttribute("aria-expanded", nav.classList.contains("open") ? "true" : "false");
    });
    window.addEventListener("hashchange", () => {
      const page = location.hash.replace("#", "");
      if (["home","games","favorites","about"].includes(page)) navigate(page);
    });
  }

  function init() {
    $("#year").textContent = new Date().getFullYear();
    loadState();
    initNavigation();
    initCookie();
    initDino();
    initBubble();
    initFlappy();
    initSnake();
    renderAllCards();
    if (location.hash && ["home","games","favorites","about"].includes(location.hash.slice(1))) navigate(location.hash.slice(1));
  }
  init();
})();
