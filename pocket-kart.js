import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.querySelector("#race-canvas");
const stage = canvas.parentElement;
const $ = s => document.querySelector(s);
const BEST_KEY = "pocketjam.kart.best.v1";
const GHOST_KEY = "pocketjam.kart.ghost.v1";
const TOTAL_LAPS = 3;
const TRACK = { a: 62, b: 39, road: 13 };
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
  const grass=mat(0x8ecf72),road=mat(0x535d5b),edge=mat(0xfff3d0),line=mat(0xffffff),dirt=mat(0xceb879);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(260,200),grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.12;scene.add(ground);
  const inner=new THREE.Mesh(new THREE.CylinderGeometry(TRACK.b-TRACK.road/2,TRACK.b-TRACK.road/2,.08,100),mat(0x79bb63));inner.scale.x=TRACK.a/TRACK.b;inner.position.y=-.01;scene.add(inner);
  const ringShape=new THREE.Shape();ringShape.absellipse(0,0,TRACK.a+TRACK.road/2,TRACK.b+TRACK.road/2,0,Math.PI*2,false,0);
  const hole=new THREE.Path();hole.absellipse(0,0,TRACK.a-TRACK.road/2,TRACK.b-TRACK.road/2,0,Math.PI*2,true,0);ringShape.holes.push(hole);
  const geom=new THREE.ShapeGeometry(ringShape,128);geom.rotateX(-Math.PI/2);
  const asphalt=new THREE.Mesh(geom,road);asphalt.position.y=.015;scene.add(asphalt);
  // Continuous pale edge lines and dashed center markings follow the loop.
  const pts=[];for(let i=0;i<=240;i++){const t=i/240*Math.PI*2;pts.push(new THREE.Vector3((TRACK.a)*Math.cos(t),.075,(TRACK.b)*Math.sin(t)));}
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xf6f0d8})));
  for(let i=0;i<96;i++){const t=i/96*Math.PI*2;const x=TRACK.a*Math.cos(t),z=TRACK.b*Math.sin(t);const tangent=new THREE.Vector3(-TRACK.a*Math.sin(t),0,TRACK.b*Math.cos(t)).normalize();const dash=new THREE.Mesh(new THREE.BoxGeometry(.22,.025,2.1),line);dash.position.set(x,.085,z);dash.rotation.y=-Math.atan2(tangent.z,tangent.x)+Math.PI/2;scene.add(dash);}
  // Red/white kerbs and a start-finish stripe at the south edge.
  for(let i=0;i<160;i++){const t=i/160*Math.PI*2;for(const side of [-1,1]){const x=(TRACK.a+side*(TRACK.road/2-.35))*Math.cos(t),z=(TRACK.b+side*(TRACK.road/2-.35))*Math.sin(t);const c=new THREE.Mesh(new THREE.BoxGeometry(2.15,.17,.85),mat(i%2?0xf7f0df:0xf46d57));c.position.set(x,.12,z);c.rotation.y=-Math.atan2(TRACK.b*Math.cos(t),-TRACK.a*Math.sin(t));scene.add(c);}}
  for(let i=0;i<12;i++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.05,.035,1.6),mat(i%2?0xffffff:0x263331));stripe.position.set(-5.8+i*1.05,.105,TRACK.b);scene.add(stripe);}
  // Low-poly trees, flowers, rocks, and trackside barriers.
  for(let i=0;i<72;i++){const t=i/72*Math.PI*2;const side=i%2?1:-1;const x=(TRACK.a+side*(TRACK.road/2+5+Math.random()*8))*Math.cos(t);const z=(TRACK.b+side*(TRACK.road/2+5+Math.random()*8))*Math.sin(t);const tree=new THREE.Group();tree.position.set(x,0,z);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.25,.35,2,5),mat(0x8d603a));trunk.position.y=1;tree.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.5+Math.random(),3+Math.random()*2,6),mat([0x3b985b,0x4eaa60,0x6dbd63][i%3]));crown.position.y=3.3;tree.add(crown);scene.add(tree);}
  for(let i=0;i<60;i++){const x=(Math.random()-.5)*180,z=(Math.random()-.5)*120;if((x*x/(TRACK.a*TRACK.a)<1.55)&&(z*z/(TRACK.b*TRACK.b)<1.55))continue;const flower=new THREE.Mesh(new THREE.SphereGeometry(.22,6,5),mat([0xffd45c,0xff8fc1,0xffffff][i%3]));flower.position.set(x,.2,z);scene.add(flower);}
  // Rolling hills in the distance.
  for(let i=0;i<18;i++){const h=7+Math.random()*12;const hill=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),mat([0x77bd69,0x6eb56d,0x9bd37a][i%3]));hill.scale.set(10+Math.random()*12,h,9+Math.random()*12);hill.position.set((Math.random()-.5)*230,h-2,(Math.random()-.5)*160);scene.add(hill);}
  // Small start banner posts.
  for(const x of [-7,7]){const post=new THREE.Mesh(new THREE.BoxGeometry(.35,5,.35),mat(0xfaf4dc));post.position.set(x,2.5,TRACK.b+1);scene.add(post);}
  const banner=new THREE.Mesh(new THREE.BoxGeometry(14,.8,.35),mat(0xffdc58));banner.position.set(0,4.6,TRACK.b+1);scene.add(banner);
}
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
function trackPose(t,offset=0){const a=TRACK.a+offset,b=TRACK.b+offset*.63;const angle=t*Math.PI*2;return {x:a*Math.sin(angle),z:b*Math.cos(angle),yaw:Math.atan2(a*Math.cos(angle),-b*Math.sin(angle))};}
function progressOf(x,z){return (Math.atan2(x/TRACK.a,z/TRACK.b)/(Math.PI*2)+1)%1;}
function resetKart(){const p=trackPose(0,-1.5);kart.position.set(p.x,0,p.z);heading=p.yaw;kart.rotation.y=heading;speed=0;steer=0;distance=0;prevProgress=0;lastLapProgress=0;lap=1;raceElapsed=0;lapStart=0;lapSamples=[];ghostElapsed=0;ghostSamples=JSON.parse(localStorage.getItem(GHOST_KEY)||"[]");ghostKart.visible=ghostSamples.length>1;$("#lap").textContent="1 / "+TOTAL_LAPS;$("#race-time").textContent=fmt(0);$("#speed").textContent="0 km/h";}
function startRace(){resetKart();running=true;finished=false;paused=false;startTime=performance.now();lapStart=0;$("#overlay").hidden=true;$("#pause").textContent="Ⅱ Pause";canvas.focus();}
function stopRace(title,copy,button="Race again"){running=false;paused=false;$("#overlay-title").textContent=title;$("#overlay-copy").textContent=copy;$("#start").textContent=button;$("#overlay").hidden=false;}
function pauseRace(){if(!running||finished)return;paused=true;running=false;$("#overlay-title").textContent="Race paused";$("#overlay-copy").textContent="Take a breather. Your current lap will continue when you resume.";$("#start").textContent="Resume racing";$("#overlay").hidden=false;$("#pause").textContent="▶ Resume";}
function updateKart(dt){
  const accelerating=keys.has("ArrowUp")||keys.has("KeyW"),braking=keys.has("ArrowDown")||keys.has("KeyS"),left=keys.has("ArrowLeft")||keys.has("KeyA"),right=keys.has("ArrowRight")||keys.has("KeyD"),hand=keys.has("Space");
  if(accelerating)speed+=27*dt;else speed-=11*dt;
  if(braking)speed-=34*dt;
  if(hand)speed*=Math.pow(.965,dt*60);
  speed=clamp(speed,-9,38);
  const target=(right?1:0)-(left?1:0);steer+=(target-steer)*Math.min(1,dt*7);
  // Arcade-style steering: responsive even at low speed so recovery from grass is quick.\n  const grip=hand?1.35:1;const steerSpeed=0.9+Math.min(Math.abs(speed),30)*0.055;heading-=steer*steerSpeed*dt*grip*Math.sign(speed||1);
  const forward=new THREE.Vector3(Math.sin(heading),0,Math.cos(heading));
  kart.position.addScaledVector(forward,speed*dt);
  const onRoad=(kart.position.x*kart.position.x/(TRACK.a*TRACK.a)+kart.position.z*kart.position.z/(TRACK.b*TRACK.b));
  if(onRoad>1.22){speed*=Math.pow(.92,dt*60);}
  kart.position.y=0;kart.rotation.y=heading;
  wheels.forEach(w=>w.rotation.x+=speed*dt*1.6);
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
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(running){raceElapsed=performance.now()-startTime;updateKart(dt);updateGhost(dt);$("#race-time").textContent=fmt(raceElapsed);}renderer.render(scene,camera);}
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
