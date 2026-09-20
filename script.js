let allQuestions = [];



/* A close overhead camera follows a continuous road through four landscapes. */
(() => {
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');
  const incomingCanvas = document.createElement('canvas');
  const incomingContext = incomingCanvas.getContext('2d');
  const ROAD_WIDTH = 98;
  const CURB_WIDTH = ROAD_WIDTH + 10;
  const MOVEMENT_SCALE = 1.25;
  const BOOST_DURATION = 1.35;
  const CAMERA_ANGLE = 0.43;
  const themes = [
    { name: 'COAST', ground: '#668876', light: '#769582', dark: '#4b7161', tree: '#335d4b', crown: '#568365', sand: '#c2bca0', road: '#344244', water: '#376f78', rock: '#839084' },
    { name: 'DESERT', ground: '#ba9b70', light: '#c9aa7d', dark: '#a28763', tree: '#626f49', crown: '#90975d', sand: '#d8bf90', road: '#474742', water: '#b49a74', rock: '#936e52' },
    { name: 'ALPINE', ground: '#c1d1c6', light: '#dbe3d6', dark: '#a5bdb1', tree: '#335b53', crown: '#5f8270', sand: '#dee5d7', road: '#3a494c', water: '#70999e', rock: '#80958f' },
    { name: 'MIDNIGHT', ground: '#263e44', light: '#304d50', dark: '#20343d', tree: '#193936', crown: '#365b4e', sand: '#5f7470', road: '#28373e', water: '#183943', rock: '#3f595c' }
  ];
  let width = 0, height = 0, dpr = 1;
  let distance = 0, speed = 0, target = 0, last = 0, boost = 0, skid = 0, frame = 0;
  let ghostSchedule = [], ghostName = 'DEMO GHOST', ghostIndex = 0, ghostElapsed = 0;
  let ghostSpeed = 0, ghostTarget = 0, ghostDistance = 0, ghostStreak = 0, ghostBoost = 0, ghostRunning = false;
  let currentBiome = 0, requestedBiome = 0, transition = null;
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const speedDisplay = document.getElementById('speed-display');
  const biomeIndicator = document.getElementById('biome-indicator');
  const seeded = n => { const v = Math.sin(n * 78.233 + 43.13) * 43758.5453; return v - Math.floor(v); };
  const smoothstep = n => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
  const roadX = s => 140 * Math.sin(s / 480 + .5) + 60 * Math.sin(s / 1300 + .8);
  const roadSlope = s => (roadX(s + 1) - roadX(s - 1)) / 2;

  function resize() {
    width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    for (const surface of [canvas, incomingCanvas]) {
      surface.width = Math.round(width * dpr);
      surface.height = Math.round(height * dpr);
    }
  }

  function camera() {
    const mobile = width < 800;
    const top = 72;
    const visibleHeight = Math.min(height * (height <= 760 ? .32 : .39), 340);
    return {
      x: width * (mobile ? .53 : .69),
      y: mobile ? top + visibleHeight * .57 : height * .56,
      scale: mobile ? Math.max(.85, Math.min(1.16, width / 355)) : Math.min(1.9, Math.max(1.35, width / 860)),
      mobile,
      sceneBottom: top + visibleHeight
    };
  }

  function project(x, s, view) {
    const lateral = x - roadX(distance), forward = s - distance;
    return {
      x: view.x + (lateral * Math.cos(CAMERA_ANGLE) + forward * Math.sin(CAMERA_ANGLE)) * view.scale,
      y: view.y + (lateral * Math.sin(CAMERA_ANGLE) - forward * Math.cos(CAMERA_ANGLE)) * view.scale
    };
  }

  function bounds(view) {
    const reach = (width + height) / view.scale;
    const forwards = [[0,0],[width,0],[0,height],[width,height]].map(([x,y]) =>
      ((x-view.x)*Math.sin(CAMERA_ANGLE)-(y-view.y)*Math.cos(CAMERA_ANGLE))/view.scale
    );
    return {
      from: Math.floor((distance + Math.min(...forwards) - 130) / 24) * 24,
      to: Math.ceil((distance + Math.max(...forwards) + 130) / 24) * 24,
      reach
    };
  }

  function ellipse(c, x, y, rx, ry, color) {
    c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }

  function poly(c, vertices, color) {
    c.fillStyle = color; c.beginPath();
    vertices.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
    c.closePath(); c.fill();
  }

  function round(c, x, y, w, h, radius, color) {
    c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
  }

  function path(c, from, to, lateral = 0) {
    c.beginPath();
    for (let s = from; s <= to; s += 12) {
      const x = roadX(s) + lateral;
      if (s === from) c.moveTo(x, -s); else c.lineTo(x, -s);
    }
    c.lineTo(roadX(to) + lateral, -to);
  }

  function stroke(c, from, to, color, lineWidth, lateral = 0) {
    path(c, from, to, lateral); c.strokeStyle = color; c.lineWidth = lineWidth;
    c.lineJoin = 'round'; c.lineCap = 'butt'; c.stroke();
  }

  function rock(c, x, y, size, palette) {
    ellipse(c, x + 8, y + 8, size, size * .64, '#142a2924');
    poly(c, [[x-size,y+size*.2],[x-size*.6,y-size*.6],[x+size*.2,y-size],[x+size,y-size*.1],[x+size*.7,y+size*.6]], palette.rock);
    poly(c, [[x-size*.6,y-size*.6],[x+size*.2,y-size],[x+size*.45,y],[x-size*.3,y+size*.2]], palette.sand);
  }

  function tree(c, x, y, size, palette, biome) {
    ellipse(c, x + 11, y + 12, size * 1.15, size * .68, '#11292230');
    if (biome === 1) {
      c.save(); c.translate(x, y); c.strokeStyle = palette.tree;
      c.lineWidth = size * .28; c.lineCap = 'round'; c.beginPath();
      c.moveTo(0, 8); c.lineTo(0, -size); c.moveTo(0, -size * .1);
      c.lineTo(-size * .55, -size * .1); c.lineTo(-size * .55, -size * .65);
      c.moveTo(0, -size * .45); c.lineTo(size * .55, -size * .45); c.lineTo(size * .55, -size);
      c.stroke(); c.restore(); return;
    }
    if (biome === 2 || biome === 3) {
      for (let level = 0; level < 3; level++) {
        const r = size * (1 - level * .22), cy = y - level * 5;
        poly(c, [[x,cy-r],[x+r*.8,cy+r*.55],[x-r*.8,cy+r*.55]], level === 1 ? palette.crown : palette.tree);
      }
      if (biome === 2) poly(c, [[x,y-size-2],[x+size*.23,y-size*.35],[x-size*.23,y-size*.35]], '#eaf0df');
      return;
    }
    round(c, x - 2, y - 5, 4, 18, 1, '#435b42');
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7, r = size * 1.25;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      poly(c, [[x,y-4],[x+dx*r*.58-dy*5,y-4+dy*r*.58+dx*5],[x+dx*r,y-4+dy*r],[x+dx*r*.55+dy*3,y-4+dy*r*.55-dx*3]], i % 2 ? palette.crown : palette.tree);
    }
    ellipse(c, x, y - 5, 4, 4, '#95aa70');
  }

  function shore(c, range, palette, biome) {
    const bank = s => roadX(s) - 210 - 48 * Math.sin(s / 440 + .6);
    const vertices = [[-range.reach * 3, -range.from]];
    for (let s = range.from; s <= range.to; s += 40) vertices.push([bank(s), -s]);
    vertices.push([-range.reach * 3, -range.to]);
    poly(c, vertices, palette.sand);
    const water = [[-range.reach * 3, -range.from]];
    for (let s = range.from; s <= range.to; s += 40) water.push([bank(s) - 32, -s]);
    water.push([-range.reach * 3, -range.to]);
    poly(c, water, palette.water);
    if (biome === 0 || biome === 3) {
      for (let s = Math.floor(range.from / 65) * 65; s < range.to; s += 65) {
        c.strokeStyle = biome === 0 ? '#b7d8c13b' : '#9ac9bf18'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(bank(s) - 48, -s); c.quadraticCurveTo(bank(s) - 67, -s - 10, bank(s) - 64, -s - 32); c.stroke();
      }
    }
  }

  function scenery(c, range, palette, biome, view) {
    for (let row = Math.floor(range.from / 84); row <= Math.ceil(range.to / 84); row++) {
      for (let column = -5; column <= 8; column++) {
        const key = row * 29 + column * 417;
        const s = row * 84 + seeded(key + 17) * 65;
        const lateral = column * 83 + (seeded(key + 31) - .5) * 52;
        const x = roadX(s) + lateral;
        if (Math.abs(lateral) < 93 || lateral < -195) continue;
        const screen = project(x,s,view);
        if (screen.x < -90 || screen.x > width+90 || screen.y < -90 || screen.y > height+90) continue;
        const size = 10 + seeded(key + 81) * 15;
        if (seeded(key + 20) > .73) rock(c, x, -s, size, palette);
        else tree(c, x, -s, size, palette, biome);
        if (seeded(key + 150) > .66) tree(c, x + Math.sign(lateral) * size * 1.4, -s + size, size * .65, palette, biome);
      }
    }
    // Reflectors pass at regular intervals and make acceleration easy to read.
    for (let s = Math.floor(range.from / 140) * 140; s < range.to; s += 140) {
      for (const side of [-1, 1]) {
        const x = roadX(s) + side * 65;
        round(c, x - 2, -s - 5, 4, 11, 1, '#dae1c8');
        round(c, x - 2, -s - 5, 4, 3, 0, side < 0 ? '#cd8267' : '#cbe885');
        if (biome === 3 && side === 1) {
          const glow = c.createRadialGradient(x, -s, 1, x, -s, 27);
          glow.addColorStop(0, '#e6e6a944'); glow.addColorStop(1, '#e6e6a900');
          ellipse(c, x, -s, 27, 27, glow);
        }
      }
    }
    // Occasional course markers, anchored in the world rather than the camera.
    for (let s = Math.ceil(range.from / 850) * 850; s < range.to; s += 850) {
      const x = roadX(s) + 93;
      c.save(); c.translate(x, -s); c.rotate(-CAMERA_ANGLE);
      round(c, -16, -12, 35, 22, 2, '#203e36');
      c.fillStyle = '#dcebad'; c.textAlign = 'center'; c.font = '600 7px "DM Sans", sans-serif';
      c.fillText(String(Math.max(0, Math.round(s / 100))).padStart(2, '0'), 1, 2); c.restore();
    }
  }

  function renderEnvironment(c, biome, view, range) {
    const palette = themes[biome];
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = palette.ground; c.fillRect(0, 0, width, height);
    c.save(); c.translate(view.x, view.y); c.rotate(CAMERA_ANGLE); c.scale(view.scale, view.scale);
    c.translate(-roadX(distance), distance);
    // Broad terrain patches are attached to the same world coordinates as the road.
    for (let s = Math.floor(range.from / 300) * 300; s < range.to; s += 300) {
      ellipse(c, roadX(s) + 330, -s, 235, 167, palette.dark);
      ellipse(c, roadX(s) + 390, -s - 140, 194, 146, palette.light);
    }
    shore(c, range, palette, biome);
    c.save(); c.translate(4, 6); stroke(c, range.from, range.to, '#18342f24', 124); c.restore();
    stroke(c, range.from, range.to, palette.sand, 122);
    stroke(c, range.from, range.to, '#e1e2c9', CURB_WIDTH);
    for (let s = Math.floor(range.from / 32) * 32; s < range.to; s += 32) stroke(c, s, s + 16, '#b97662', CURB_WIDTH);
    stroke(c, range.from, range.to, palette.road, ROAD_WIDTH);
    stroke(c, range.from, range.to, '#ffffff05', 56);
    stroke(c, range.from, range.to, '#e7ebcf77', 1.2, -43);
    stroke(c, range.from, range.to, '#e7ebcf77', 1.2, 43);
    // Two subtle lane dividers leave clear space for three cars.
    for (let s = Math.floor(range.from / 88) * 88; s < range.to; s += 88) {
      for (const side of [-1, 1]) stroke(c, s, s + 26, '#e4e9cd55', 1.1, side * 16);
    }
    scenery(c, range, palette, biome, view);
    if (distance < 650) {
      c.save(); c.translate(roadX(40), -40); c.rotate(Math.atan(roadSlope(40)));
      for (let i = 0; i < 2; i++) for (let j = 0; j < 20; j++) {
        c.fillStyle = (i + j) % 2 ? '#293d37' : '#ecedd5';
        c.fillRect(j * ROAD_WIDTH / 20 - ROAD_WIDTH / 2, i * 5, ROAD_WIDTH / 20, 5);
      }
      c.restore();
    }
    c.restore();
  }

  function beginTransition() {
    if (!transition && currentBiome < requestedBiome) {
      transition = { from: currentBiome, to: currentBiome + 1, elapsed: 0, travel: 0 };
    }
  }

  function updateTransition(dt, moved) {
    beginTransition();
    if (!transition) return;
    transition.elapsed += dt; transition.travel += moved;
    // The boundary sweeps from ahead of the car to behind it. A gentle time floor
    // keeps transitions readable even when the driver is crawling or has stopped.
    const progress = Math.max(transition.elapsed / (reduced ? 1.6 : 4.5), transition.travel / 1050);
    transition.progress = Math.min(1, progress);
    if (progress >= 1) {
      currentBiome = transition.to; transition = null; beginTransition();
    }
  }

  function drawTransition(view, range) {
    if (!transition) return;
    renderEnvironment(incomingContext, transition.to, view, range);
    const progress = transition.progress || 0;
    incomingContext.save(); incomingContext.globalCompositeOperation = 'destination-in';
    if (reduced) {
      incomingContext.fillStyle = `rgba(0,0,0,${smoothstep(progress)})`;
      incomingContext.fillRect(0, 0, width, height);
    } else {
      const sweep = (width * .48 + height * .7) / view.scale;
      const center = distance + sweep * (1 - 2 * smoothstep(progress));
      const behind = project(roadX(distance), center - 210, view);
      const ahead = project(roadX(distance), center + 210, view);
      const mask = incomingContext.createLinearGradient(behind.x, behind.y, ahead.x, ahead.y);
      // Fade in and out the very edges too; rapid successive stages never cut.
      const floor = smoothstep((progress - .78) / .22);
      const ceiling = smoothstep(progress / .22);
      mask.addColorStop(0, `rgba(0,0,0,${floor})`);
      mask.addColorStop(1, `rgba(0,0,0,${ceiling})`);
      incomingContext.fillStyle = mask; incomingContext.fillRect(0, 0, width, height);
    }
    incomingContext.restore();
    ctx.drawImage(incomingCanvas, 0, 0, width, height);
  }

  function carBody(c, ghost = false) {
    for (const x of [-15, 11]) for (const y of [-13, 8]) round(c, x, y, 9, 5, 1, '#172426');
    round(c,-25,-9,49,22,5,ghost?'#387a83':'#67803a');
    round(c,-25,-12,49,22,5,ghost?'#8be1ed':'#d9ef85');
    round(c,-20,-11,37,18,4,ghost?'#b6f2f6':'#e6f5a4');
    poly(c,[[-5,-9],[7,-9],[11,7],[-7,7]],'#213b3e');
    poly(c,[[-4,-8],[6,-8],[8,-2],[-5,-2]],ghost?'#8ac3d0':'#609092');
    round(c,-5,-9,5,17,1,ghost?'#76cbd6':'#bdd478');
    c.fillStyle='#344b3a'; c.fillRect(-22,-2,13,3); c.fillRect(12,-2,10,3);
    round(c,-24,-14,4,26,1,'#213b36'); round(c,-23,-13,2,24,1,ghost?'#7fcdd6':'#aabe72');
    c.fillStyle='#f7f8db'; c.fillRect(21,-9,3,5); c.fillRect(21,4,3,5);
    c.fillStyle='#f17755'; c.fillRect(-25,-8,2,4); c.fillRect(-25,4,2,4);
  }

  function drawGhost(view) {
    // Driven by a real (or reference) run: ghostDistance is simulated just like the player's.
    const s = ghostDistance;
    const position = project(roadX(s) + 32, s, view);
    const angle = Math.atan2(-1, roadSlope(s)) + CAMERA_ANGLE;
    ctx.save(); ctx.translate(position.x,position.y); ctx.scale(view.scale,view.scale); ctx.rotate(angle);
    ctx.globalAlpha = .42; carBody(ctx,true);
    ctx.globalAlpha = .8; ctx.strokeStyle = '#a9eff4'; ctx.lineWidth = .8;
    ctx.setLineDash([3,3]); ctx.beginPath(); ctx.roundRect(-27,-15,54,30,5); ctx.stroke();
    ctx.restore();
    const y = position.y - 37 * view.scale;
    ctx.font='600 7px "DM Sans", sans-serif';
    const labelWidth = Math.max(56, ctx.measureText(ghostName).width + 18);
    round(ctx,position.x-labelWidth/2,y-14,labelWidth,19,3,'#163238e6');
    ctx.fillStyle='#b3e8ef'; ctx.textAlign='center';
    ctx.fillText(ghostName,position.x,y-1);
  }

  function drawCar(t, view) {
    const angle = Math.atan2(-1, roadSlope(distance)) + CAMERA_ANGLE;
    const surge = reduced ? 0 : boost / BOOST_DURATION * 8;
    const x = view.x + Math.cos(angle) * surge, y = view.y + Math.sin(angle) * surge;
    ctx.save(); ctx.translate(x, y); ctx.scale(view.scale, view.scale);
    ctx.rotate(angle + (skid > 0 && !reduced ? Math.sin(t * .03) * .06 : 0));
    ellipse(ctx, 4, 6, 26, 14, '#091a244d');
    const night = currentBiome === 3 ? 1 : transition?.to === 3 ? smoothstep(transition.progress || 0) : 0;
    if (night > 0) {
      ctx.save(); ctx.globalAlpha = night;
      const beam = ctx.createLinearGradient(23, 0, 128, 0);
      beam.addColorStop(0, '#f6f4bc66'); beam.addColorStop(1, '#f6f4bc00');
      poly(ctx, [[23,-9],[128,-42],[128,42],[23,9]], beam); ctx.restore();
    }
    if (!reduced && speed > 35) {
      const length = 32 + Math.min(speed, 300) * .12 + boost / BOOST_DURATION * 40;
      const trail = ctx.createLinearGradient(-length, 0, -20, 0);
      trail.addColorStop(0, '#dbf47a00'); trail.addColorStop(1, boost > 0 ? '#dbf47aaa' : '#dbf47a33');
      poly(ctx, [[-length,-10],[-20,-7],[-20,7],[-length,10]], trail);
      if (boost > 0) {
        ctx.strokeStyle = '#e9ffa7aa'; ctx.lineWidth = 1.2;
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-length * .75, side * 17); ctx.lineTo(-29, side * 17); ctx.stroke(); }
      }
    }
    carBody(ctx); ctx.restore();
    const labelY = y - 37 * view.scale;
    round(ctx, x - 21, labelY - 14, 42, 19, 3, '#142a2de6');
    ctx.fillStyle='#e5f89b'; ctx.font='600 8px "DM Sans", sans-serif'; ctx.textAlign='center'; ctx.fillText('YOU',x,labelY-1);
  }

  function interfaceShade(view) {
    if (!view.mobile) {
      const shade = ctx.createLinearGradient(0,0,width*.55,0);
      shade.addColorStop(0,'#101f21fa'); shade.addColorStop(.55,'#101f21e8'); shade.addColorStop(1,'#101f2100');
      ctx.fillStyle=shade; ctx.fillRect(0,0,width,height);
    } else {
      const shade = ctx.createLinearGradient(0,view.sceneBottom-18,0,view.sceneBottom+100);
      shade.addColorStop(0,'#10212800'); shade.addColorStop(1,'#102128ef');
      ctx.fillStyle=shade; ctx.fillRect(0,view.sceneBottom-18,width,height);
    }
    const vignette=ctx.createLinearGradient(0,0,0,height);
    vignette.addColorStop(0,'#0b1c2735'); vignette.addColorStop(.65,'#0b1c2700'); vignette.addColorStop(1,'#0b1c2790');
    ctx.fillStyle=vignette; ctx.fillRect(0,0,width,height);
  }

  function draw(t) {
    const elapsed = (t-last)/1000 || 0;
    const dt = Math.min(elapsed, .05); last=t;
    speed += (target-speed) * (1-Math.exp(-dt*7));
    const moved = reduced ? 0 : speed * dt * MOVEMENT_SCALE * (1+.5*boost/BOOST_DURATION);
    distance += moved; boost=Math.max(0,boost-dt); skid=Math.max(0,skid-dt);
    if (ghostRunning) {
      ghostElapsed += Math.min(elapsed,.05) * 1000;
      while (ghostIndex < ghostSchedule.length && ghostElapsed >= ghostSchedule[ghostIndex].atMs) {
        const event = ghostSchedule[ghostIndex];
        if (event.correct) { ghostStreak++; const streakBoost = ghostStreak%3===0; ghostTarget = Math.min(300, ghostTarget + 15 + (streakBoost?15:0)); ghostBoost = BOOST_DURATION; }
        else { ghostStreak = 0; ghostTarget = Math.max(15, ghostTarget - 20); }
        ghostIndex++;
      }
    }
    ghostBoost = Math.max(0, ghostBoost - dt);
    ghostSpeed += (ghostTarget-ghostSpeed) * (1-Math.exp(-dt*7));
    ghostDistance += reduced ? 0 : ghostSpeed * dt * MOVEMENT_SCALE * (1+.5*ghostBoost/BOOST_DURATION);
    // Crossfades follow elapsed time even when a background tab throttles frames.
    updateTransition(Math.min(elapsed,4.5),moved);
    const view=camera(), range=bounds(view);
    renderEnvironment(ctx,currentBiome,view,range); drawTransition(view,range); drawGhost(view); drawCar(t,view); interfaceShade(view);
    if (++frame%4===0) {
      speedDisplay.textContent=Math.round(speed);
      document.querySelectorAll('.speed-bars i').forEach((bar,i)=>bar.classList.toggle('lit',speed>(i+1)*20));
      if (biomeIndicator) biomeIndicator.textContent=transition ? `${themes[transition.from].name} → ${themes[transition.to].name}` : themes[currentBiome].name;
    }
    requestAnimationFrame(draw);
  }

  window.RaceWorld = {
    reset() { distance=0; speed=0; target=0; boost=0; skid=0; currentBiome=0; requestedBiome=0; transition=null; ghostDistance=0; ghostSpeed=0; ghostTarget=30; ghostIndex=0; ghostElapsed=0; ghostStreak=0; ghostBoost=0; ghostRunning=false; },
    setSpeed(value) { target=value; if(value===0) boost=0; },
    setStage(value) { requestedBiome=Math.max(0,Math.min(3,value)); if(value===0) { currentBiome=0; transition=null; } },
    boost() { boost=BOOST_DURATION; },
    skid() { skid=.5; boost=0; },
    setReduced(value) { reduced=value; },
    get reduced() { return reduced; },
    setGhostRun(schedule, name) { ghostSchedule=Array.isArray(schedule)?schedule:[]; ghostName=(name||'GHOST').toString().slice(0,16).toUpperCase(); },
    startGhost() { ghostRunning=true; },
    stopGhost() { ghostRunning=false; }
  };
  addEventListener('resize',resize); resize(); requestAnimationFrame(draw);
})();




'use strict';
const $ = id => document.getElementById(id);
const TOTAL = 14, DURATION = 140;
const stageNames = ['Coastal cruise', 'Desert dash', 'Alpine ascent', 'Midnight run'];
const state = { running:false, answered:false, index:0, score:0, speed:0, topSpeed:0, streak:0, history:[], answerTimes:[], order:[], deadline:0, questionStarted:0, timer:null, next:null, date:'' };
let soundEnabled=false, audioContext, boostTimeout;
function dailyDate(){return new Date().toISOString().slice(0,10)}
function dateSeed(date){return Number(date.replaceAll('-',''))||0}
function previousDailyDate(date){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
function shuffledPool(seedValue){let seed=seedValue;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};const pool=allQuestions.map(q=>({...q,options:[...q.options]}));for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}return pool}
function seededQuestions(date){const pool=shuffledPool(dateSeed(date));const usedYesterday=new Set(shuffledPool(dateSeed(previousDailyDate(date))).slice(0,TOTAL).map(q=>q.q));const fresh=pool.filter(q=>!usedYesterday.has(q.q));const repeats=pool.filter(q=>usedYesterday.has(q.q));return fresh.concat(repeats).slice(0,TOTAL)}
// --- Ghost car: replays a run (correct/incorrect + time-per-question) with the same physics as the player. ---
function toBase64Url(bytes){let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function fromBase64Url(str){str=str.replace(/-/g,'+').replace(/_/g,'/');while(str.length%4)str+='=';const binary=atob(str);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function packGhost(name,history,times){const nameBytes=new TextEncoder().encode((name||'RACER').slice(0,16));const len=history.length;let bits=len.toString(2).padStart(4,'0');for(let i=0;i<len;i++)bits+=history[i]?'1':'0';while(bits.length%8)bits+='0';const flagBytes=[];for(let i=0;i<bits.length;i+=8)flagBytes.push(parseInt(bits.slice(i,i+8),2));const timeBytes=[];for(let i=0;i<len;i++){const v=Math.min(65535,Math.max(0,Math.round((times[i]||0)/50)));timeBytes.push(v>>8&255,v&255)}return new Uint8Array([1,nameBytes.length,...nameBytes,...flagBytes,...timeBytes])}
function unpackGhost(bytes){let offset=0;const version=bytes[offset++];if(version!==1)return null;const nameLen=bytes[offset++];const name=new TextDecoder().decode(bytes.slice(offset,offset+nameLen));offset+=nameLen;const len=bytes[offset]>>4;const flagByteCount=Math.ceil((4+len)/8);let bits='';for(let i=0;i<flagByteCount;i++)bits+=bytes[offset+i].toString(2).padStart(8,'0');offset+=flagByteCount;const history=[];for(let i=0;i<len;i++)history.push(bits[4+i]==='1');const times=[];for(let i=0;i<len;i++){const hi=bytes[offset++],lo=bytes[offset++];times.push(((hi<<8)|lo)*50)}return{name:(name||'RACER').trim().slice(0,16).toUpperCase()||'RACER',history,times}}
function defaultGhostRun(){const perQuestion=Math.round(DURATION*1000/TOTAL/2);return{name:'DEMO GHOST',date:'',history:Array(TOTAL).fill(true),times:Array(TOTAL).fill(perQuestion)}}
function parseGhostFromURL(){try{const raw=new URLSearchParams(location.search).get('g');if(!raw)return null;const parsed=unpackGhost(fromBase64Url(raw));if(!parsed||!Array.isArray(parsed.history))return null;return{name:parsed.name,date:'',history:parsed.history,times:parsed.times}}catch{return null}}
function buildGhostSchedule(run){const fallback=Math.round(DURATION*1000/TOTAL/2),gap=1100;let cursor=0;return run.history.map((correct,i)=>{const answerMs=Number.isFinite(run.times[i])?run.times[i]:fallback;cursor+=Math.max(400,answerMs);const event={atMs:cursor,correct:!!correct};cursor+=gap;return event})}
function computeGhostStats(run){const fallback=Math.round(DURATION*1000/TOTAL/2);let score=0,speed=30,topSpeed=30,streak=0,correct=0;run.history.forEach((wasCorrect,i)=>{const ms=Number.isFinite(run.times[i])?run.times[i]:fallback;if(wasCorrect){correct++;streak++;const bonus=Math.max(0,Math.round(100-ms/100));const boost=streak%3===0;score+=100+bonus;speed=Math.min(300,speed+15+(boost?15:0))}else{streak=0;speed=Math.max(15,speed-20)}topSpeed=Math.max(topSpeed,speed)});return{score,correct,topSpeed,total:run.history.length}}
function buildGhostLink(name){const bytes=packGhost(name,state.history,state.answerTimes);const encoded=toBase64Url(bytes);const base=location.href.split(/[?#]/)[0];return`${base}?g=${encoded}`}
const sharedGhostRun=parseGhostFromURL();
const ghostRun=sharedGhostRun||defaultGhostRun();
RaceWorld.setGhostRun(buildGhostSchedule(ghostRun),ghostRun.name);
function updateDate(){const date=dailyDate();$('date-display').textContent=new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).toUpperCase();$('race-number').textContent=String(Math.max(1,Math.floor((Date.parse(date)-Date.UTC(2026,8,1))/86400000)+1)).padStart(3,'0')}
function tone(frequency,duration=.12){if(!soundEnabled)return;try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume().catch(()=>{});const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='triangle';oscillator.frequency.setValueAtTime(frequency,audioContext.currentTime);gain.gain.setValueAtTime(.045,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+duration)}catch{soundEnabled=false;$('sound-btn').setAttribute('aria-pressed','false');$('sound-btn').setAttribute('aria-label','Sound unavailable')}}
function changeStage(index){RaceWorld.setStage(index);document.body.dataset.stage=index;$('stage-number').textContent=`STAGE 0${index+1} / 04`;$('stage-name').textContent=stageNames[index]}
function startGame(){clearInterval(state.timer);clearTimeout(state.next);clearTimeout(boostTimeout);Object.assign(state,{running:true,answered:false,index:0,score:0,speed:30,topSpeed:30,streak:0,history:[],answerTimes:[],date:dailyDate(),deadline:Date.now()+DURATION*1000});state.order=seededQuestions(state.date);$('start-screen').classList.add('hidden');$('route-preview').classList.add('hidden');$('end-screen').classList.add('hidden');$('quiz-screen').classList.remove('hidden');$('boost-label').classList.remove('show');$('share-status').textContent='';RaceWorld.reset?.();RaceWorld.setGhostRun(buildGhostSchedule(ghostRun),ghostRun.name);RaceWorld.startGhost();RaceWorld.setSpeed(30);changeStage(0);updateDate();updateDashboard();drawQuestion();tick();state.timer=setInterval(tick,100);tone(330)}
function tick(){if(!state.running)return;const remaining=Math.max(0,(state.deadline-Date.now())/1000),seconds=Math.ceil(remaining);$('time-display').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;$('timer-bar').style.width=`${remaining/DURATION*100}%`;document.querySelector('.timer-track').setAttribute('aria-valuenow',seconds);document.querySelector('.time-stat').classList.toggle('urgent',seconds<=20);if(remaining<=0)finishRace(true)}
function updateDashboard(){const progress=state.history.length/TOTAL*100;$('score-display').textContent=String(state.score).padStart(4,'0');$('streak-display').textContent=state.streak?`${state.streak} CORRECT IN A ROW`:'FIND YOUR FLOW';$('journey-fill').style.width=`${progress}%`;$('journey-marker').style.left=`${progress}%`;$('journey-label').textContent=state.running?'EVERY ANSWER TAKES YOU SOMEWHERE.':'YOUR DAILY ESCAPE, COMPLETE.';$('distance-display').textContent=`${state.history.length} / ${TOTAL} CHECKPOINTS`}
function drawQuestion(){if(!state.running)return;if(state.index>=state.order.length){finishRace();return}const current=state.order[state.index];state.answered=false;state.questionStarted=Date.now();changeStage(Math.min(3,Math.floor(state.index/4)));$('progress-display').textContent=`QUESTION ${String(state.index+1).padStart(2,'0')} / ${TOTAL}`;$('question-text').textContent=current.q;$('answer-buttons').replaceChildren();current.options.forEach((option,index)=>{const button=document.createElement('button');button.className='answer-btn';const key=document.createElement('span');key.className='answer-key';key.textContent=index+1;key.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=option;button.append(key,text);button.addEventListener('click',()=>answerQuestion(index));$('answer-buttons').append(button)});$('feedback').textContent=state.streak>=2?'Keep it going. Your next boost is close.':'Pick an answer. Pick up speed.';$('question-text').focus({preventScroll:true})}
function answerQuestion(index){if(!state.running||state.answered||$('help-dialog').open)return;if(Date.now()>=state.deadline){finishRace(true);return}state.answered=true;const current=state.order[state.index],correct=index===current.a;state.history.push(correct);state.answerTimes.push(Date.now()-state.questionStarted);document.querySelectorAll('.answer-btn').forEach((button,i)=>{button.disabled=true;if(i===current.a){button.classList.add('correct');const mark=document.createElement('span');mark.className='answer-state';mark.textContent='✓';button.append(mark)}else if(i===index){button.classList.add('incorrect');const mark=document.createElement('span');mark.className='answer-state';mark.textContent='×';button.append(mark)}});
  if(correct){state.streak++;const bonus=Math.max(0,Math.round(100-(Date.now()-state.questionStarted)/100));const boost=state.streak%3===0;state.score+=100+bonus;state.speed=Math.min(300,state.speed+15+(boost?15:0));$('feedback').textContent=`Correct! +${100+bonus} points · +${boost?30:15} km/h`;$('boost-label').textContent=boost?'STREAK BOOST! +30 KM/H':'+15 KM/H · NICE THINKING';RaceWorld.boost();tone(boost?880:660)}else{state.streak=0;const lost=Math.min(20,Math.max(0,state.speed-15));state.speed=Math.max(15,state.speed-20);$('feedback').textContent=`It’s ${current.options[current.a]}. Keep driving.`;$('boost-label').textContent=lost?`−${lost} KM/H · YOU’VE GOT THE NEXT ONE`:'KEEP GOING · YOU’VE GOT THIS';RaceWorld.skid();tone(150,.2)}
  state.topSpeed=Math.max(state.topSpeed,state.speed);RaceWorld.setSpeed(state.speed);$('boost-label').classList.add('show');clearTimeout(boostTimeout);boostTimeout=setTimeout(()=>$('boost-label').classList.remove('show'),1600);updateDashboard();state.next=setTimeout(()=>{if(!state.running)return;state.index++;drawQuestion()},1100)
}
function finishRace(timedOut=false){if(!state.running)return;timedOut=timedOut&&state.history.length<TOTAL;state.running=false;clearInterval(state.timer);clearTimeout(state.next);$('quiz-screen').classList.add('hidden');$('end-screen').classList.remove('hidden');RaceWorld.setSpeed(0);RaceWorld.stopGhost();const correct=state.history.filter(Boolean).length;$('result-title').textContent=timedOut?'Time to pull over.':correct>=11?'What a ride.':'A road well travelled.';$('final-status').textContent=timedOut?`${state.history.length} of ${TOTAL} checkpoints reached. The open road will be here.`:'You made it through the daily rally. Take a breath. Take a bow.';$('final-score').textContent=state.score.toLocaleString();$('final-correct').textContent=`${correct}/${TOTAL}`;$('final-speed').textContent=state.topSpeed;$('result-dots').replaceChildren();for(let i=0;i<TOTAL;i++){const dot=document.createElement('span');const answer=state.history[i];dot.className='result-dot '+(answer===true?'correct':answer===false?'incorrect':'');dot.title=`Question ${i+1}: ${answer===undefined?'unanswered':answer?'correct':'incorrect'}`;$('result-dots').append(dot)}$('result-dots').setAttribute('aria-label',`${correct} correct, ${state.history.length-correct} incorrect, ${TOTAL-state.history.length} unanswered`);if(sharedGhostRun){const ghostStats=computeGhostStats(sharedGhostRun);const name=sharedGhostRun.name||'RACER';$('versus-compare').classList.remove('hidden');$('versus-you-score').textContent=state.score.toLocaleString();$('versus-you-correct').textContent=`${correct}/${TOTAL}`;$('versus-you-speed').textContent=state.topSpeed;$('versus-ghost-who').textContent=name;$('versus-ghost-score').textContent=ghostStats.score.toLocaleString();$('versus-ghost-correct').textContent=`${ghostStats.correct}/${ghostStats.total}`;$('versus-ghost-speed').textContent=ghostStats.topSpeed;const diff=Math.abs(state.score-ghostStats.score).toLocaleString();const headline=$('versus-headline');if(state.score>ghostStats.score)headline.textContent=`You beat ${name}'s ghost by ${diff} points!`;else if(state.score<ghostStats.score)headline.textContent=`${name}'s ghost beat you by ${diff} points.`;else headline.textContent=`Dead heat with ${name}'s ghost!`}else{$('versus-compare').classList.add('hidden')}updateDashboard();$('share-btn').focus({preventScroll:true});tone(523,.3)}
async function copyResults(){const correct=state.history.filter(Boolean).length;const nameInput=$('ghost-name');const name=((nameInput?.value||'').trim().slice(0,16).toUpperCase())||'RACER';if(nameInput)nameInput.value=name;try{localStorage.setItem('thinkfast-name',name)}catch{}const link=buildGhostLink(name);const text=`ThinkFast · Daily Rally · ${state.date}\n${state.score} points · ${correct}/${TOTAL} correct · ${state.topSpeed} km/h top speed\n${Array.from({length:TOTAL},(_,i)=>state.history[i]===true?'🟩':state.history[i]===false?'🟧':'⬜').join('')}\n\nRace ${name}'s ghost: ${link}`;try{await navigator.clipboard.writeText(text);$('share-status').textContent=`Copied! Whoever opens that link races against ${name}.`}catch{$('share-status').textContent=text;$('share-status').style.userSelect='text'}}
$('start-btn').addEventListener('click',startGame);$('replay-btn').addEventListener('click',startGame);$('share-btn').addEventListener('click',copyResults);$('help-btn').addEventListener('click',()=>$('help-dialog').showModal());$('close-help').addEventListener('click',()=>$('help-dialog').close());$('got-it').addEventListener('click',()=>$('help-dialog').close());$('sound-btn').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound-btn').setAttribute('aria-pressed',String(soundEnabled));$('sound-btn').setAttribute('aria-label',soundEnabled?'Turn sound off':'Turn sound on');$('sound-path').setAttribute('d',soundEnabled?'M15 8q5 4 0 8m3-11q8 7 0 14':'m16 9 6 6m0-6-6 6');tone(440)});
function updateMotion(){const reduced=RaceWorld.reduced;$('motion-btn').setAttribute('aria-pressed',String(reduced));$('motion-btn').setAttribute('aria-label',reduced?'Enable motion':'Reduce motion')}
$('motion-btn').addEventListener('click',()=>{RaceWorld.setReduced(!RaceWorld.reduced);updateMotion()});matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{RaceWorld.setReduced(event.matches);updateMotion()});document.addEventListener('keydown',event=>{if(!event.repeat&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&/^[1-4]$/.test(event.key)){answerQuestion(Number(event.key)-1)}});for(let i=0;i<12;i++)document.querySelector('.speed-bars').append(document.createElement('i'));updateDate();updateMotion();
if(sharedGhostRun){
  const name=sharedGhostRun.name||'RACER';
  const correct=sharedGhostRun.history.filter(Boolean).length;
  const total=sharedGhostRun.history.length||TOTAL;
  const eyebrow=$('eyebrow-text');if(eyebrow)eyebrow.textContent='VERSUS RACE';
  const hero=$('hero-title');if(hero)hero.innerHTML=`RACE<br><em>${name}</em>`;
  const introCopy=$('intro-copy');if(introCopy)introCopy.textContent=`${name} scored ${correct}/${total} correct. Answer fast and correctly to catch their ghost before the line.`;
  const fact3=$('fact-3');if(fact3)fact3.textContent=`${name}: ${correct}/${total} correct`;
}
try{const savedName=localStorage.getItem('thinkfast-name');if(savedName&&$('ghost-name'))$('ghost-name').value=savedName}catch{}
$('start-btn').disabled=true;$('start-btn').innerHTML='Loading questions…';
fetch('questions.json').then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json()}).then(data=>{if(!Array.isArray(data)||data.length<TOTAL)throw new Error('questions.json is missing or too short');allQuestions=data;$('start-btn').disabled=false;$('start-btn').innerHTML=sharedGhostRun?`Race ${sharedGhostRun.name||'RACER'} <span>→</span>`:'Start your engines <span>→</span>'}).catch(error=>{console.error('Failed to load questions.json',error);$('start-btn').innerHTML='Questions failed to load';$('intro-copy').textContent='Could not load questions.json. Make sure it sits next to this page, then refresh.'});