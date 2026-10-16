import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.querySelector("#race-canvas");
const stage = canvas.parentElement;
const $ = s => document.querySelector(s);
const BEST_KEY = "pocketjam.kart.best.v1";
const GHOST_KEY = "pocketjam.kart.ghost.v1";
const TOTAL_LAPS = 3;
const TRACK = { road: 13 };
let trackCurve, trackSamples = [], boostPads = [], trees = [], lastBoostAt = 0, driftAngle = 0, driftFx = [], driftFxClock = 0;
let renderer, scene, camera, kart, wheels = [], ghostKart, ghostWheels = [];
let clock = new THREE.Clock();
let running = false, finished = false, paused = false, startTime = 0, raceElapsed = 0, lapStart = 0;
let lap = 1, speed = 0, heading = 0, steer = 0, distance = 0, prevProgress = 0, lastLapProgress = 0;
let lapSamples = [], ghostSamples = [], ghostElapsed = 0, bestLap = Number(localStorage.getItem(BEST_KEY)) || 0;
const keys = new Set();
const UP = new THREE.Vector3(0,1,0);
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const fmt = ms => { if(!ms || !Number.isFinite(ms)) return "--:--.---"; const m=Math.floor(ms/60000),s=Math.floor(ms%60000/1000),t=Math.floor(ms%1000);return String(m).padStart(2,"0")+":"+String(s).padStart(2,"0")+"."+String(t).padStart(3,"0"); };
const mat = (color, roughness=.88) => new THREE.MeshStandardMaterial({color,roughness});
function makeKart(color=0xff684f, isGhost=false){
  const root=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2.2,.65,3.4),mat(color));body.position.y=.7;root.add(body);
  const nose=new THREE.Mesh(new THREE.BoxGeometry(1.7,.28,1.1),mat(isGhost?0x9ef7ff:0xffd55a));nose.position.set(0,.88,-1.25);root.add(nose);
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.05,.75,1.05),mat(0x243b38));seat.position.set(0,1.12,.25);root.add(seat);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.42,12,8),mat(0xffd2a0));head.position.set(0,1.68,.1);root.add(head);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.46,12,8),mat(isGhost?0xb5f7ff:0x5746a6));helmet.position.set(0,1.88,.1);root.add(helmet);
  const wheelGeo=new THREE.CylinderGeometry(.43,.43,.28,12);wheelGeo.rotateZ(Math.PI/2);
  const wheels=[];
  for(const x of [-1.12,1.12])for(const z of [-1.05,1.05]){const w=new THREE.Mesh(wheelGeo,mat(0x20292a));w.position.set(x,.43,z);root.add(w);wheels.push(w);}
  if(isGhost){root.traverse(o=>{if(o.material){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.36;}});}
  root.userData.wheels=wheels;
  scene.add(root);return root;
}
function makeTrack(){
 const grass=mat(0x8ecf72),line=mat(0xffffff);const ground=new THREE.Mesh(new THREE.PlaneGeometry(280,230),grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.12;scene.add(ground);
 const control=[[-68,55],[-25,65],[30,65],[62,55],[68,32],[68,-5],[54,-24],[28,-27],[8,-18],[4,-42],[-8,-62],[-42,-64],[-68,-48],[-72,-18],[-54,2],[-30,8],[-20,27],[-30,43],[-52,43]].map(p=>new THREE.Vector3(p[0],0,p[1]));
 trackCurve=new THREE.CatmullRomCurve3(control,true,"catmullrom",.16);const N=500;trackSamples=trackCurve.getSpacedPoints(N);const left=[],right=[],verts=[];
 for(let i=0;i<=N;i++){const p=trackCurve.getPointAt(i/N),t=trackCurve.getTangentAt(i/N).setY(0).normalize(),side=new THREE.Vector3(t.z,0,-t.x);left.push(p.clone().addScaledVector(side,TRACK.road/2));right.push(p.clone().addScaledVector(side,-TRACK.road/2));}
 for(let i=0;i<N;i++){const a=left[i],b=right[i],c=left[i+1],d=right[i+1];verts.push(a.x,.025,a.z,b.x,.025,b.z,c.x,.025,c.z,b.x,.025,b.z,d.x,.025,d.z,c.x,.025,c.z);}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();scene.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0x535d5b,roughness:.95,side:THREE.DoubleSide})));
 const lineFor=(pts,color)=>scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(p.x,.09,p.z))),new THREE.LineBasicMaterial({color})));lineFor(left,0xf6f0d8);lineFor(right,0xf6f0d8);
 for(let i=0;i<N;i+=9){const p=trackCurve.getPointAt(i/N),t=trackCurve.getTangentAt(i/N).setY(0).normalize(),d=new THREE.Mesh(new THREE.BoxGeometry(.25,.035,2.1),line);d.position.set(p.x,.09,p.z);d.rotation.y=Math.atan2(t.x,t.z);scene.add(d);}
 for(let i=0;i<N;i+=3){const p=trackCurve.getPointAt(i/N),t=trackCurve.getTangentAt(i/N).setY(0).normalize(),side=new THREE.Vector3(t.z,0,-t.x);for(const sign of [-1,1]){const c=new THREE.Mesh(new THREE.BoxGeometry(1.05,.16,.85),mat(i%2?0xf7f0df:0xf46d57));c.position.copy(p).addScaledVector(side,sign*(TRACK.road/2-.35));c.position.y=.12;c.rotation.y=Math.atan2(t.x,t.z);scene.add(c);}}
 const start=trackCurve.getPointAt(0),tan=trackCurve.getTangentAt(0).setY(0).normalize();for(let i=0;i<12;i++){const q=new THREE.Mesh(new THREE.BoxGeometry(1.05,.04,1.5),mat(i%2?0xffffff:0x263331));q.position.copy(start).add(new THREE.Vector3(tan.z,0,-tan.x).multiplyScalar(-TRACK.road/2+(i+.5)*TRACK.road/12));q.position.y=.12;q.rotation.y=Math.atan2(tan.x,tan.z);scene.add(q);}
 boostPads=[];for(const u of [.13,.39,.67,.87]){const p=trackCurve.getPointAt(u),t=trackCurve.getTangentAt(u).setY(0).normalize(),side=new THREE.Vector3(t.z,0,-t.x),pad=new THREE.Group(),padPosition=p.clone().addScaledVector(side,2.6);pad.position.copy(padPosition);pad.position.y=.13;pad.rotation.y=Math.atan2(t.x,t.z);pad.add(new THREE.Mesh(new THREE.BoxGeometry(5,.12,3.2),mat(0x13cfe8)));for(let j=-1;j<=1;j++){const ar=new THREE.Mesh(new THREE.ConeGeometry(.65,.95,3),mat(0xeaffff));ar.rotation.x=Math.PI/2;ar.position.set(j*1.35,.12,-.15);pad.add(ar);}scene.add(pad);boostPads.push({position:padPosition,mesh:pad,usedLap:0});}
 trees=[];
 // Place trees only after checking their distance from the full sampled road centerline.
 // This avoids trees cutting onto the tarmac at tight bends where a simple side offset fails.
 const roadClearance=TRACK.road/2+3.2;
 const treeCandidates=[];
 for(let i=0;i<100;i++){
   const u=(i+Math.random()*.6)/100,p=trackCurve.getPointAt(u),t=trackCurve.getTangentAt(u).setY(0).normalize(),side=new THREE.Vector3(t.z,0,-t.x);
   const sign=i%2?1:-1;
   const offset=TRACK.road/2+16+Math.random()*20;
   const q=p.clone().addScaledVector(side,offset*sign);
   treeCandidates.push(q);
 }
 // Repeatedly sample the entire loop so each candidate is validated against nearby and distant track sections.
 for(const q of treeCandidates){
   let nearestSq=Infinity;
   for(const p of trackSamples){
     const dx=p.x-q.x,dz=p.z-q.z,d=dx*dx+dz*dz;
     if(d<nearestSq)nearestSq=d;
   }
   if(nearestSq<roadClearance*roadClearance)continue;
   // Keep trees separated from each other too.
   if(trees.some(tree=>tree.position.distanceTo(q)<4.5))continue;
   const tree=new THREE.Group();tree.position.set(q.x,0,q.z);
   const tr=new THREE.Mesh(new THREE.CylinderGeometry(.32,.42,1.8,6),mat(0x8d603a));tr.position.y=.9;tree.add(tr);
   const crown=new THREE.Mesh(new THREE.ConeGeometry(1.45,3.1,6),mat([0x3b985b,0x4eaa60,0x6dbd63][trees.length%3]));crown.position.y=2.65;tree.add(crown);scene.add(tree);trees.push({mesh:tree,position:new THREE.Vector3(q.x,0,q.z),radius:1.55});
 }
 for(const sign of [-1,1]){const p=start.clone().add(new THREE.Vector3(tan.z,0,-tan.x).multiplyScalar(sign*8)),post=new THREE.Mesh(new THREE.BoxGeometry(.35,4,.35),mat(0xfaf4dc));post.position.set(p.x,2,p.z);scene.add(post);}const banner=new THREE.Mesh(new THREE.BoxGeometry(16,.8,.35),mat(0xffdc58));banner.position.set(start.x,3.8,start.z);banner.rotation.y=Math.atan2(tan.x,tan.z);scene.add(banner);
}
function spawnDriftFX(dt, drifting){
  driftFxClock -= dt;
  if (!drifting) return;
  // Each rear tire gets its own stream of smoke puffs and tiny orange sparks.
  if (driftFxClock <= 0) {
    driftFxClock = 0.055;
    const rear = new THREE.Vector3(0, 0.28, 1.32);
    for (const side of [-1, 1]) {
      const local = rear.clone(); local.x = side * 1.22;
      const world = local.applyAxisAngle(UP, kart.rotation.y).add(kart.position);
      const puffMat = new THREE.MeshBasicMaterial({color:0xdfe6e2, transparent:true, opacity:0.42, depthWrite:false});
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22 + Math.random()*0.12, 7, 6), puffMat);
      puff.position.set(world.x, 0.22, world.z);
      scene.add(puff);
      driftFx.push({mesh:puff, type:"smoke", age:0, life:0.65 + Math.random()*0.35, vx:(Math.random()-.5)*1.5-speed*0.018, vz:(Math.random()-.5)*1.5-speed*0.018, vy:0.8+Math.random()*0.8});
      for (let j=0; j<2; j++) {
        const sparkMat = new THREE.MeshBasicMaterial({color:j%2?0xfff06a:0xff5b19, toneMapped:false});
        const spark = new THREE.Mesh(new THREE.SphereGeometry(0.105, 6, 5), sparkMat);
        spark.position.set(world.x, 0.3, world.z);
        scene.add(spark);
        driftFx.push({mesh:spark, type:"spark", age:0, life:0.32+Math.random()*0.28, vx:(Math.random()-.5)*8-speed*0.025, vz:(Math.random()-.5)*8-speed*0.025, vy:0.9+Math.random()*3.2});
      }
    }
  }
}
function updateDriftFX(dt){
  for (let i=driftFx.length-1; i>=0; i--) {
    const p=driftFx[i]; p.age+=dt;
    if(p.age>=p.life){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();driftFx.splice(i,1);continue;}
    p.mesh.position.x+=p.vx*dt; p.mesh.position.z+=p.vz*dt; p.mesh.position.y+=p.vy*dt;
    if(p.type==="smoke"){
      const k=p.age/p.life; p.mesh.scale.setScalar(1+k*2.8); p.mesh.material.opacity=0.42*(1-k);
    } else {p.vy-=7*dt; p.mesh.scale.setScalar(1.7*(1-p.age/p.life));}
  }
}
function clearDriftFX(){for(const p of driftFx){scene.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();}driftFx=[];driftFxClock=0;}
function setup(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.setSize(stage.clientWidth,stage.clientHeight,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x9bdaf2);scene.fog=new THREE.Fog(0x9bdaf2,100,230);
  camera=new THREE.PerspectiveCamera(62,stage.clientWidth/stage.clientHeight,.1,450);
  scene.add(new THREE.HemisphereLight(0xe8f7ff,0x597b45,2.1));
  const sun=new THREE.DirectionalLight(0xfff0cf,2.3);sun.position.set(-45,80,35);scene.add(sun);
  makeTrack();
  kart=makeKart();wheels=kart.userData.wheels;ghostKart=makeKart(0x8ef1ff,true);ghostWheels=ghostKart.userData.wheels;ghostKart.visible=false;
  resetKart();camera.position.set(kart.position.x,-0+6,kart.position.z+12);camera.lookAt(kart.position.x,1,kart.position.z);window.addEventListener("resize",resize);animate();
}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function trackPose(t,offset=0){const u=((t%1)+1)%1,p=trackCurve.getPointAt(u),tan=trackCurve.getTangentAt(u).setY(0).normalize(),side=new THREE.Vector3(tan.z,0,-tan.x);p.addScaledVector(side,offset);return {x:p.x,z:p.z,yaw:Math.atan2(tan.x,tan.z)};}
function nearestTrack(x,z){let best=Infinity,progress=0;for(let i=0;i<trackSamples.length;i++){const p=trackSamples[i],d=(p.x-x)**2+(p.z-z)**2;if(d<best){best=d;progress=i/(trackSamples.length-1);}}return {distance:Math.sqrt(best),progress};}
function progressOf(x,z){return nearestTrack(x,z).progress;}
function resetKart(){clearDriftFX();driftAngle=0;for(const pad of boostPads)pad.usedLap=0;const p=trackPose(0,-1.5);kart.position.set(p.x,0,p.z);heading=p.yaw;kart.rotation.y=heading;speed=0;steer=0;distance=0;prevProgress=0;lastLapProgress=0;lap=1;raceElapsed=0;lapStart=0;lapSamples=[];ghostElapsed=0;ghostSamples=JSON.parse(localStorage.getItem(GHOST_KEY)||"[]");ghostKart.visible=ghostSamples.length>1;$("#lap").textContent="1 / "+TOTAL_LAPS;$("#race-time").textContent=fmt(0);$("#speed").textContent="0 km/h";}
function startRace(){resetKart();running=true;finished=false;paused=false;startTime=performance.now();lapStart=0;$("#overlay").hidden=true;$("#pause").textContent="Ⅱ Pause";canvas.focus();}
function stopRace(title,copy,button="Race again"){running=false;paused=false;$("#overlay-title").textContent=title;$("#overlay-copy").textContent=copy;$("#start").textContent=button;$("#overlay").hidden=false;}
function pauseRace(){if(!running||finished)return;paused=true;running=false;$("#overlay-title").textContent="Race paused";$("#overlay-copy").textContent="Take a breather. Your current lap will continue when you resume.";$("#start").textContent="Resume racing";$("#overlay").hidden=false;$("#pause").textContent="▶ Resume";}
function updateKart(dt){
  const accelerating=keys.has("ArrowUp")||keys.has("KeyW"),braking=keys.has("ArrowDown")||keys.has("KeyS"),left=keys.has("ArrowLeft")||keys.has("KeyA"),right=keys.has("ArrowRight")||keys.has("KeyD"),hand=keys.has("Space");
  if(accelerating)speed+=27*dt;else speed-=11*dt;
  if(braking)speed-=34*dt;
  if(hand)speed*=Math.pow(.982,dt*60);
  speed=clamp(speed,-9,38);
  const target=(right?1:0)-(left?1:0);steer+=(target-steer)*Math.min(1,dt*7);
  // Arcade-style steering: responsive even at low speed so recovery from grass is quick.
  const drifting=hand&&Math.abs(speed)>8;
  const steerSpeed=0.58+Math.min(Math.abs(speed),30)*0.032;
  heading-=steer*steerSpeed*dt*(drifting?1.75:1)*Math.sign(speed||1);
  const targetDrift=drifting?-steer*0.48*Math.sign(speed||1):0;
  driftAngle=THREE.MathUtils.damp(driftAngle,targetDrift,drifting?3.2:7,dt);
  const movementHeading=heading+driftAngle;
  const forward=new THREE.Vector3(Math.sin(movementHeading),0,Math.cos(movementHeading));
  kart.position.addScaledVector(forward,speed*dt);
  const nearest=nearestTrack(kart.position.x,kart.position.z);
  // Off-road speed is capped at 90 km/h (the HUD converts internal speed by 4.2).
  if(nearest.distance>TRACK.road/2+0.8){speed=clamp(speed,-9,90/4.2);}
  // Trees are kept clear of the tarmac and block the kart if it reaches their trunks/crowns.
  for(const tree of trees){
    const dx=kart.position.x-tree.position.x,dz=kart.position.z-tree.position.z,dist=Math.hypot(dx,dz),minDist=tree.radius+0.8;
    if(dist<minDist){
      if(dist<0.001){kart.position.x+=minDist;}
      else {const push=(minDist-dist)/dist;kart.position.x+=dx*push;kart.position.z+=dz*push;}
      speed*=0.45;
    }
  }
  const now=performance.now();for(const pad of boostPads){if(pad.usedLap!==lap&&kart.position.distanceTo(pad.position)<4&&now-lastBoostAt>350){speed=clamp(speed+13,0,46);lastBoostAt=now;pad.usedLap=lap;pad.mesh.scale.set(1.2,1.2,1.2);setTimeout(()=>pad.mesh.scale.set(1,1,1),180);break;}}
  kart.position.y=0;kart.rotation.y=heading+driftAngle*.55;
  wheels.forEach(w=>w.rotation.x+=speed*dt*1.6);
  spawnDriftFX(dt,drifting);
  // Smooth chase camera with a little height and distance for visibility.
  const behind=new THREE.Vector3(-Math.sin(heading)*10,6.1,-Math.cos(heading)*10);
  const desired=kart.position.clone().add(behind);camera.position.lerp(desired,Math.min(1,dt*4.5));camera.lookAt(kart.position.x,kart.position.y+1.1,kart.position.z);
  const progress=progressOf(kart.position.x,kart.position.z);
  const forwardMotion=speed>2;
  if(forwardMotion){
    const delta=progress-prevProgress;
    if(delta<-.7)distance+=1;
    if(progress<.08 && prevProgress>.92 && distance>0){
      const lapMs=performance.now()-startTime-lapStart;
      if(lapMs>5000){
        if(!bestLap||lapMs<bestLap){bestLap=lapMs;localStorage.setItem(BEST_KEY,String(bestLap));localStorage.setItem(GHOST_KEY,JSON.stringify(lapSamples));ghostSamples=lapSamples.slice();$("#best-lap").textContent=fmt(bestLap);$("#record-copy").textContent="New personal best: "+fmt(bestLap)+". Can you beat your own ghost?";$("#ghost-status").textContent="Ghost racer ready — your best lap is loaded.";}
        lap++;lapStart=performance.now()-startTime;lapSamples=[];
        if(lap>TOTAL_LAPS){finished=true;running=false;$("#record-copy").textContent="Race complete! Total time: "+fmt(raceElapsed)+". Best lap: "+fmt(bestLap)+".";stopRace("🏆 Race complete!", "You finished all three laps in "+fmt(raceElapsed)+". Best lap: "+fmt(bestLap)+".","Race again");}
        else $("#lap").textContent=lap+" / "+TOTAL_LAPS;
      }
    }
  }
  prevProgress=progress;
  lapSamples.push({t:raceElapsed,x:kart.position.x,y:kart.position.y,z:kart.position.z,rot:heading});
  if(lapSamples.length>2400)lapSamples.shift();
  $("#speed").textContent=Math.round(Math.abs(speed)*4.2)+" km/h";
}
function updateGhost(dt){if(!ghostSamples||ghostSamples.length<2||!ghostKart.visible)return;ghostElapsed+=dt*1000;let i=ghostSamples.findIndex(p=>p.t>=ghostElapsed);if(i<0){ghostElapsed=0;i=0;}const a=ghostSamples[Math.max(0,i-1)],b=ghostSamples[i];if(!a||!b)return;const f=b.t===a.t?0:(ghostElapsed-a.t)/(b.t-a.t);ghostKart.position.set(THREE.MathUtils.lerp(a.x,b.x,f),.04,THREE.MathUtils.lerp(a.z,b.z,f));ghostKart.rotation.y=THREE.MathUtils.lerp(a.rot,b.rot,f);}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);updateDriftFX(dt);if(running){raceElapsed=performance.now()-startTime;updateKart(dt);updateGhost(dt);$("#race-time").textContent=fmt(raceElapsed);}renderer.render(scene,camera);}
$("#start").addEventListener("click",()=>{if(paused){paused=false;running=true;startTime=performance.now()-raceElapsed;$("#overlay").hidden=true;$("#pause").textContent="Ⅱ Pause";}else startRace();});
$("#pause").addEventListener("click",()=>{if(paused){paused=false;running=true;startTime=performance.now()-raceElapsed;$("#overlay").hidden=true;$("#pause").textContent="Ⅱ Pause";}else pauseRace();});
$("#restart").addEventListener("click",()=>stopRace("Ready to race?","Start a fresh three-lap run around Sunny Meadow.","Start your engine"));
window.addEventListener("keydown",e=>{if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();if(e.code==="Escape"){if(running)pauseRace();return;}keys.add(e.code);});
window.addEventListener("keyup",e=>keys.delete(e.code));
window.addEventListener("blur",()=>{keys.clear();if(running)pauseRace();});
$("#best-lap").textContent=fmt(bestLap);
$("#record-copy").textContent=bestLap?"Current best lap: "+fmt(bestLap)+". Records stay on this device.":"Finish a lap to set your first record. Your best time is saved on this device.";
$("#ghost-status").textContent=bestLap?"Ghost racer: best lap replay available.":"Ghost racer: waiting for a best lap.";
if(bestLap)ghostSamples=JSON.parse(localStorage.getItem(GHOST_KEY)||"[]");
try{setup();}catch(err){console.error(err);$("#overlay-title").textContent="3D graphics unavailable";$("#overlay-copy").textContent="This browser could not start the 3D scene. Try a recent browser with WebGL enabled.";}
