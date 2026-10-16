import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const canvas = document.querySelector("#race-canvas");
const stage = canvas.parentElement;
const $ = s => document.querySelector(s);
const BEST_KEY = "pocketjam.kart.best.v1";
const GHOST_KEY = "pocketjam.kart.ghost.v1";
const TOTAL_LAPS = 3;
const TRACK = { road: 13 };
let trackCurve, trackSamples = [], boostPads = [], lastBoostAt = 0;
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
  const grass=mat(0x8ecf72),road=mat(0x535d5b),line=mat(0xffffff);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(280,230),grass);ground.rotation.x=-Math.PI/2;ground.position.y=-.12;scene.add(ground);
  // A wider, flowing circuit with long straights and several unmistakable right-hand corners.
  const control=[
    new THREE.Vector3(-68,0,55),new THREE.Vector3(-25,0,65),new THREE.Vector3(30,0,65),
    new THREE.Vector3(62,0,55),new THREE.Vector3(68,0,32),new THREE.Vector3(68,0,-5),
    new THREE.Vector3(54,0,-24),new THREE.Vector3(28,0,-27),new THREE.Vector3(8,0,-18),
    new THREE.Vector3(4,0,-42),new THREE.Vector3(-8,0,-62),new THREE.Vector3(-42,0,-64),
    new THREE.Vector3(-68,0,-48),new THREE.Vector3(-72,0,-18),new THREE.Vector3(-54,0,2),
    new THREE.Vector3(-30,0,8),new THREE.Vector3(-20,0,27),new THREE.Vector3(-30,0,43),
    new THREE.Vector3(-52,0,43)
  ];
  trackCurve=new THREE.CatmullRomCurve3(control,true,"catmullrom",0.16);
  const N=500;trackSamples=trackCurve.getSpacedPoints(N);
  const left=[],right=[],inner=[],outer=[];
  for(let i=0;i<=N;i++){
    const p=trackCurve.getPointAt(i/N),t=trackCurve.getTangentAt(i/N).setY(0).normalize();
    const side=new THREE.Vector3(t.z,0,-t.x);
    left.push(p.clone().addScaledVector(side,TRACK.road/2));right.push(p.clone().addScaledVector(side,-TRACK.road/2));
    inner.push(p.clone().addScaledVector(side,TRACK.road/2-.45));outer.push(p.clone().addScaledVector(side,-TRACK.road/2+.45));
  }
  const verts=[],uv=[];
  for(let i=0;i<N;i++){const a=left[i],b=right[i],c=left[i+1],d=right[i+1];verts.push(a.x,.025,a.z,b.x,.025,b.z,c.x,.025,c.z,b.x,.025,b.z,d.x,.025,d.z,c.x,.025,c.z);}
  const geom=new THREE.BufferGeometry();geom.setAttribute("position",new THREE.Float32BufferAttribute(verts,3));geom.computeVertexNormals();
  const asphalt=new THREE.Mesh(geom,new THREE.MeshStandardMaterial({color:0x535d5b,roughness:.95,side:THREE.DoubleSide}));scene.add(asphalt);
  const makeLine=(points,color)=>scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,.09,p.z))),new THREE.LineBasicMaterial({color})));
  makeLine(left,0xf6f0d8);makeLine(right,0xf6f0d8);
  for(let i=0;i<N;i+=9){const p=trackCurve.getPointAt(i/N),t=trackCurve.getTangentAt(i/N).setY(0).normalize();const dash=new THREE.Mesh(new THREE.BoxGeometry(.25,.035,2.1),line);dash.position.set(p.x,.09,p.z);dash.rotation.y=Math.atan2(t.x,t.z);scene.add(dash);}
  // Alternating kerbs make corners easier to read.
  for(let i=0;i<N;i+=3){const p=trackCurve.getPointAt(i/N),t=trackCurve.getTangentAt(i/N).setY(0).normalize(),side=new THREE.Vector3(t.z,0,-t.x);for(const sign of [-1,1]){const c=new THREE.Mesh(new THREE.BoxGeometry(1.05,.16,.85),mat((Math.floor(i/3)%2)?0xf7f0df:0xf46d57));c.position.copy(p).addScaledVector(side,sign*(TRACK.road/2-.35));c.position.y=.12;c.rotation.y=Math.atan2(t.x,t.z);scene.add(c);}}
  // Start/finish stripe across the road.
  const start=trackCurve.getPointAt(0),tan=trackCurve.getTangentAt(0).setY(0).normalize();
  for(let i=0;i<12;i++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.05,.04,1.5),mat(i%2?0xffffff:0x263331));stripe.position.copy(start).add(new THREE.Vector3(tan.z,0,-tan.x).multiplyScalar(-TRACK.road/2+(i+.5)*TRACK.road/12));stripe.position.y=.12;stripe.rotation.y=Math.atan2(tan.x,tan.z);scene.add(stripe);}
  // Neon boost strips placed on safe sections of the course.
  boostPads=[];
  for(const t of [.13,.39,.67,.87]){
    const p=trackCurve.getPointAt(t),tan=trackCurve.getTangentAt(t).setY(0).normalize();
    const pad=new THREE.Group();pad.position.copy(p);pad.position.y=.13;pad.rotation.y=Math.atan2(tan.x,tan.z);
    const base=new THREE.Mesh(new THREE.BoxGeometry(5,.12,3.2),mat(0x13cfe8));pad.add(base);
    for(let j=-1;j<=1;j++){const arrow=new THREE.Mesh(new THREE.ConeGeometry(.65,.95,3),mat(0xeaffff));arrow.rotation.x=Math.PI/2;arrow.position.set(j*1.35,.12,-.15);pad.add(arrow);}
    scene.add(pad);boostPads.push({position:p.clone(),mesh:pad});
  }
  // Trackside trees and meadow details, kept outside the enlarged course.
  for(let i=0;i<100;i++){const t=i/100;const p=trackCurve.getPointAt(t),tan=trackCurve.getTangentAt(t).setY(0).normalize(),side=new THREE.Vector3(tan.z,0,-tan.x);const sign=i%2?1:-1;const q=p.clone().addScaledVector(side,TRACK.road/2+11+Math.random()*13);const tree=new THREE.Group();tree.position.set(q.x,0,q.z);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.26,1.5,5),mat(0x8d603a));trunk.position.y=.75;tree.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.05+Math.random()*.35,2.2+Math.random()*1.1,6),mat([0x3b985b,0x4eaa60,0x6dbd63][i%3]));crown.position.y=2.45;tree.add(crown);scene.add(tree);}
  for(let i=0;i<90;i++){const x=(Math.random()-.5)*240,z=(Math.random()-.5)*190;const flower=new THREE.Mesh(new THREE.SphereGeometry(.22,6,5),mat([0xffd45c,0xff8fc1,0xffffff][i%3]));flower.position.set(x,.2,z);scene.add(flower);}
  // Start banner across the start line.
  for(const sign of [-1,1]){const p=start.clone().add(new THREE.Vector3(tan.z,0,-tan.x).multiplyScalar(sign*8));const post=new THREE.Mesh(new THREE.BoxGeometry(.35,4,.35),mat(0xfaf4dc));post.position.set(p.x,2,p.z);scene.add(post);}
  const banner=new THREE.Mesh(new THREE.BoxGeometry(16,.8,.35),mat(0xffdc58));banner.position.set(start.x,3.8,start.z);banner.rotation.y=Math.atan2(tan.x,tan.z);scene.add(banner);
}
