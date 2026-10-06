import * as THREE from 'three';
import { OrbitControls } from '../vendor/three/OrbitControls.js';

export function createPortScene(container, onSelect) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bdd2df');
  scene.fog = new THREE.Fog('#bdd2df', 2100, 6500);
  const camera = new THREE.PerspectiveCamera(43, 1, 2, 8500);
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  renderer.domElement.setAttribute('aria-label','Puerto 3D: arrastrá para girar y usá la rueda para acercarte');
  container.append(renderer.domElement);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=180;controls.maxDistance=2600;
  controls.maxPolarAngle=Math.PI*.47;controls.target.set(80,0,230);
  const home=()=>{camera.position.set(1000,1050,1480);controls.target.set(80,0,230);controls.update()};home();
  scene.add(new THREE.HemisphereLight('#e3f3ff','#7a8174',2.0));
  const sun=new THREE.DirectionalLight('#ffe9c6',3.5);sun.position.set(-600,1000,400);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-1000;sun.shadow.camera.right=1000;sun.shadow.camera.top=1000;sun.shadow.camera.bottom=-1000;sun.shadow.camera.far=2200;sun.shadow.bias=-.0004;scene.add(sun);
  const mat=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const concrete=mat('#969d95'),steel=mat('#a6b3b6',.4,.4),darkSteel=mat('#434e50',.5,.4),road=mat('#646f6c'),white=mat('#eeeadd');
  const geometries=new Map();
  function box(parent,x,y,z,w,h,d,material){
    const key=`${w}:${h}:${d}`;if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));
    const mesh=new THREE.Mesh(geometries.get(key),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function cylinder(parent,x,y,z,r,h,material,segments=16){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  function beam(parent,a,b,r,material){const pa=new THREE.Vector3(...a),pb=new THREE.Vector3(...b),mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,pa.distanceTo(pb),6),material);mesh.position.copy(pa).add(pb).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pb.sub(pa).normalize());mesh.castShadow=true;parent.add(mesh);return mesh;}
  // A broad water surface with procedural normal detail, lit by the same sun as the port.
  const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=128;
  const ctx=normalCanvas.getContext('2d'),pixels=ctx.createImageData(128,128);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;pixels.data[i]=128+Math.sin(x*.4+y*.17)*17;pixels.data[i+1]=128+Math.cos(y*.49+x*.1)*14;pixels.data[i+2]=248;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
  const normal=new THREE.CanvasTexture(normalCanvas);normal.wrapS=normal.wrapT=THREE.RepeatWrapping;normal.repeat.set(65,65);
  const waterMaterial=new THREE.MeshPhongMaterial({color:'#397b88',specular:'#e6f4f2',shininess:100,normalMap:normal,normalScale:new THREE.Vector2(.38,.38)});
  const water=new THREE.Mesh(new THREE.PlaneGeometry(11000,11000),waterMaterial);water.rotation.x=-Math.PI/2;water.position.y=-1;scene.add(water);
  box(scene,-80,0,-450,1750,16,900,concrete);
  box(scene,-80,8,-100,1750,1,100,road);
  for(let x=-900;x<760;x+=38)box(scene,x,8.8,-100,18,.2,1.7,white);
  for(const z of [-165,-170])box(scene,-80,8.6,z,1750,.25,.8,darkSteel);
  for(let x=-940;x<800;x+=14)box(scene,x,8.4,-167.5,2,.2,10,mat('#736d5e'));
  box(scene,-80,1,-4,1750,20,8,mat('#a3aaa3'));
  for(let x=-900;x<780;x+=30){cylinder(scene,x,13,-10,2.3,5,darkSteel,8);box(scene,x,1,3,6,12,5,mat('#252f32'));}
  const berthX=[-560,-230,100];
  const labels=[];
  function label(text,position,css='port-label'){const el=document.createElement('span');el.className=css;el.textContent=text;container.append(el);labels.push({el,position});return el;}
  for(let k=0;k<3;k++){
    const x=berthX[k];label(['ADM','TBB 9','Cargill'][k],new THREE.Vector3(x,90,-210));
    box(scene,x,29,-310,240,42,125,mat(['#afafa4','#a7b0ab','#a4ae9c'][k]));
    const roof=new THREE.Mesh(new THREE.CylinderGeometry(88,88,244,3),mat('#c0c4b8'));roof.rotation.z=Math.PI/2;roof.rotation.y=Math.PI/2;roof.position.set(x,49,-310);roof.castShadow=true;scene.add(roof);
    for(let j=0;j<8;j++){
      const sx=x-90+(j%4)*60,sz=-510-Math.floor(j/4)*65;
      cylinder(scene,sx,44,sz,25,72,steel,20);
      const lid=new THREE.Mesh(new THREE.ConeGeometry(25,12,20),steel);lid.position.set(sx,86,sz);lid.castShadow=true;scene.add(lid);
      box(scene,sx,83,sz,4,2,46,darkSteel);
    }
    beam(scene,[x,75,-475],[x,56,-215],2,darkSteel);
    for(const cx of [x-65,x+65]){
      const crane=new THREE.Group();crane.position.set(cx,8,-25);scene.add(crane);
      for(const px of [-10,10])for(const pz of [-9,9])beam(crane,[px,0,pz],[px,60,pz],1.8,darkSteel);
      for(let h=12;h<60;h+=12){beam(crane,[-10,h,-9],[10,h+12,-9],.8,steel);beam(crane,[-10,h,9],[10,h+12,9],.8,steel);}
      box(crane,0,58,0,28,7,25,mat('#697f81'));
      beam(crane,[0,66,-25],[0,66,70],2.3,steel);beam(crane,[0,88,0],[0,66,70],.8,darkSteel);beam(crane,[0,66,0],[0,88,0],1.5,darkSteel);
      beam(crane,[0,66,62],[0,14,62],.4,darkSteel);box(crane,9,62,12,7,8,9,white);
      box(crane,10,63,17,5,4,.3,mat('#283e48',.2));
    }
    // Loading lanes, parked trucks, and terminal equipment.
    for(let j=0;j<4;j++){const tx=x-100+j*55;box(scene,tx,12,-105,24,8,8,white);box(scene,tx+16,13,-105,9,10,8,mat('#d4a45a'));for(const wx of [-8,8,17])cylinder(scene,tx+wx,9,-100,2.4,2,darkSteel,8).rotation.x=Math.PI/2;}
  }
  for(let i=0;i<8;i++){box(scene,490+(i%4)*54,14,-220-Math.floor(i/4)*36,45,12,25,mat(['#7b927e','#a16248','#c9b277','#6a8e9c'][i%4]));}
  for(let i=0;i<7;i++)box(scene,430+i*57,9,-160,48,.3,1.5,white);
  label('Ingeniero White',new THREE.Vector3(-700,70,-670),'port-label region-label');
  label('Rada de espera',new THREE.Vector3(760,4,410),'port-label water-label');
  const buoys=[];
  for(let i=0;i<9;i++)for(const side of [-1,1]){
    const bx=-620+i*200,bz=460+side*90;const green=side===1,color=mat(green?'#2e7c56':'#b6533c');
    const buoy=new THREE.Group();buoy.position.set(bx,0,bz);cylinder(buoy,0,2,0,3,4,color,8);cylinder(buoy,0,6,0,1,7,color,8);scene.add(buoy);buoys.push(buoy);
  }
  function hullShape(length,width){const s=new THREE.Shape();s.moveTo(-length*.5,-width*.38);s.lineTo(length*.32,-width*.5);s.quadraticCurveTo(length*.48,-width*.4,length*.52,0);s.quadraticCurveTo(length*.48,width*.4,length*.32,width*.5);s.lineTo(-length*.5,width*.38);s.closePath();return s;}
  function hull(group,l,w,depth,y,color){const geo=new THREE.ExtrudeGeometry(hullShape(l,w),{depth,bevelEnabled:true,bevelThickness:1.2,bevelSize:1,bevelSegments:1,steps:1,curveSegments:8});const m=new THREE.Mesh(geo,mat(color,.45,.12));m.rotation.x=Math.PI/2;m.position.y=y;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
  const ships=new Map();
  function createShip(job){
    const group=new THREE.Group(),l=job.length??170,w=job.beam??l*.145;
    hull(group,l,w,4,3,'#7d3f35');const upper=hull(group,l,w,8,11,'#243b49');
    box(group,0,11,0,l*.83,1,w*.86,mat('#b9b5a1'));
    for(let i=0;i<5;i++){const x=-l*.2+i*l*.115;box(group,x,13,0,l*.10,3,w*.66,mat('#6c7975'));box(group,x,14.6,0,l*.087,.5,w*.6,mat('#a29f88'));}
    const bx=-l*.35;box(group,bx,17,0,l*.11,10,w*.80,white);box(group,bx+1,25,0,l*.095,7,w*.78,white);
    const glass=mat('#2a495c',.15,.3);box(group,bx+1,26,w*.40,l*.083,2,.4,glass);box(group,bx+l*.05,26,0,.4,2,w*.66,glass);
    box(group,bx-5,34,0,8,12,7,mat('#dcb45c'));box(group,bx-5,40,0,8,2,7,darkSteel);
    beam(group,[bx+5,29,0],[bx+5,44,0],.55,white);beam(group,[bx,39,-7],[bx,39,7],.35,white);
    for(const z of [-w*.43,w*.43]){
      beam(group,[-l*.44,14,z],[l*.30,14,z],.35,white);
      for(let x=-l*.44;x<l*.30;x+=12)beam(group,[x,11,z],[x,14,z],.22,white);
      box(group,bx,18,z,12,4,3,mat('#d77632'));
    }
    cylinder(group,l*.37,13,0,3,3,darkSteel);beam(group,[l*.42,11,0],[l*.42,20,0],.5,white);
    const ring=new THREE.Mesh(new THREE.RingGeometry(l*.55,l*.56,64),new THREE.MeshBasicMaterial({color:'#f5cd73',side:THREE.DoubleSide,transparent:true,opacity:.8}));ring.rotation.x=-Math.PI/2;ring.position.y=.2;ring.scale.y=.45;group.add(ring);
    group.traverse(o=>{if(o.isMesh)o.userData.vessel=job.id});scene.add(group);
    const el=label(job.name,new THREE.Vector3(),'port-label vessel-label');
    ships.set(job.id,{group,el,ring,upper,dimensions:`${job.length}:${job.beam}`});
  }
  const tugs=[];
  for(let i=0;i<3;i++){
    const g=new THREE.Group();hull(g,32,12,5,5,'#24323a');box(g,0,7,0,26,2,11,mat('#cb7240'));box(g,-4,11,0,12,8,8,white);box(g,-2,16,0,10,3,8,mat('#314c5b',.15));cylinder(g,6,10,0,2,9,darkSteel);beam(g,[-4,17,0],[-4,25,0],.4,white);
    for(let j=0;j<6;j++){const tire=new THREE.Mesh(new THREE.TorusGeometry(1.6,.65,6,10),darkSteel);tire.position.set(-12+j*4.5,5,6);g.add(tire);}scene.add(g);tugs.push(g);
  }
  const closure=new THREE.Mesh(new THREE.PlaneGeometry(285,38),new THREE.MeshBasicMaterial({color:'#dc7543',transparent:true,opacity:.55,side:THREE.DoubleSide}));closure.rotation.x=-Math.PI/2;closure.position.set(berthX[1],9,-20);closure.visible=false;scene.add(closure);
  function removeShip(id){
    const model=ships.get(id);if(!model)return;scene.remove(model.group);
    const cached=new Set(geometries.values());model.group.traverse(o=>{if(o.geometry&&!cached.has(o.geometry))o.geometry.dispose();if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(![concrete,steel,darkSteel,road,white].includes(m))m.dispose();});
    const used=new Set();scene.traverse(o=>{if(o.geometry)used.add(o.geometry)});for(const [key,g] of geometries)if(!used.has(g)){g.dispose();geometries.delete(key);}
    model.el.remove();const index=labels.findIndex(l=>l.el===model.el);if(index>=0)labels.splice(index,1);ships.delete(id);
  }
  let dataset=null,lastView=null;
  function update(view){
    lastView=view;
    if(dataset!==view.datasetId){for(const id of [...ships.keys()])removeShip(id);dataset=view.datasetId;}
    const ids=new Set(view.entities.map(e=>e.id));for(const id of [...ships.keys()])if(!ids.has(id))removeShip(id);
    for(const entity of view.entities){
      if(ships.has(entity.id)&&ships.get(entity.id).dimensions!==`${entity.length}:${entity.beam}`)removeShip(entity.id);
      if(!ships.has(entity.id))createShip(entity);const model=ships.get(entity.id),p=entity.pose;
      model.group.visible=!!p;model.el.hidden=!p;
      if(p){model.group.position.set(p.x,0,p.z);model.group.rotation.y=p.angle;model.ring.visible=view.selected===entity.id;model.el.textContent=entity.name;model.el.classList.toggle('selected',view.selected===entity.id);model.el.dataset.state=entity.state;labels.find(l=>l.el===model.el).position.set(p.x,50,p.z);}
    }
    tugs.forEach((g,i)=>{const p=view.tugs[i];g.visible=!!p;if(p){g.position.set(p.x,0,p.z);g.rotation.y=p.angle;}});closure.visible=view.closure;
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
  renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY]});
  renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...ships.values()].filter(x=>x.group.visible).map(x=>x.group),true).find(x=>x.object.userData.vessel!==undefined);if(hit)onSelect(hit.object.userData.vessel)});
  function resize(){const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}const observer=new ResizeObserver(resize);observer.observe(container);resize();
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let disposed=false,raf;
  function frame(now){if(disposed)return;raf=requestAnimationFrame(frame);if(document.hidden)return;
    controls.update();if(!reduce){normal.offset.x=now*.000003;normal.offset.y=now*.000002;}
    for(const {el,position} of labels){if(el.hidden)continue;const p=position.clone().project(camera);const w=container.clientWidth,h=container.clientHeight;el.style.left=`${(p.x*.5+.5)*w}px`;el.style.top=`${(-p.y*.5+.5)*h}px`;el.style.visibility=p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1?'hidden':'visible';}
    renderer.render(scene,camera);
  }raf=requestAnimationFrame(frame);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();container.querySelectorAll('.port-label').forEach(el=>el.hidden=true);container.classList.add('scene-failed');container.dataset.error='La vista 3D perdió la conexión gráfica. Recargá para recuperarla; la agenda sigue disponible.';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{if(disposed)return;container.classList.remove('scene-failed');delete container.dataset.error;for(const {el} of labels)el.hidden=false;if(lastView)update(lastView);resize();});
  return {update,home,dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();const gs=new Set(),ms=new Set();scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of (Array.isArray(o.material)?o.material:[o.material]))ms.add(m)});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());normal.dispose();renderer.dispose();renderer.forceContextLoss();labels.forEach(l=>l.el.remove());renderer.domElement.remove();}};
}
