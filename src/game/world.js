import * as THREE from 'three';

export class World {
  constructor(scene) {
    this.scene = scene; this.colliders = [];
    scene.background = new THREE.Color(0x9aaab2);
    scene.fog = new THREE.Fog(0x9aaab2, 28, 65);
    scene.add(new THREE.HemisphereLight(0xdce8ed, 0x55545a, 2.1));
    const sun = new THREE.DirectionalLight(0xffe3c1, 2.4); sun.position.set(-8,18,7); scene.add(sun);
    this.materials = {
      ground: new THREE.MeshStandardMaterial({color:0x666d70, roughness:1}),
      wall: new THREE.MeshStandardMaterial({color:0x858b8b, roughness:1}),
      dark: new THREE.MeshStandardMaterial({color:0x343d43, roughness:1}),
      orange: new THREE.MeshStandardMaterial({color:0xc86b3e, roughness:1}),
      blue: new THREE.MeshStandardMaterial({color:0x536e7c, roughness:1})
    };
    this.box(0,-0.35,0,40,.5,40,this.materials.ground,false);
    // Limites de l'arène
    this.box(0,2,-20,40,4,.8,this.materials.dark);
    this.box(0,2,20,40,4,.8,this.materials.dark);
    this.box(-20,2,0,.8,4,40,this.materials.dark);
    this.box(20,2,0,.8,4,40,this.materials.dark);
    // Ruelles et couvertures, symétriques pour les duels.
    const props = [
      [-8,1,-7,4,2,2,'orange'], [8,1,7,4,2,2,'orange'],
      [8,1,-7,3,2,2,'blue'], [-8,1,7,3,2,2,'blue'],
      [0,1,-10,7,2,1.2,'wall'], [0,1,10,7,2,1.2,'wall'],
      [-13,.65,0,1.5,1.3,4,'orange'], [13,.65,0,1.5,1.3,4,'orange'],
      [-5,1.5,0,1.2,3,1.2,'dark'], [5,1.5,0,1.2,3,1.2,'dark'],
      [-13,2,-12,6,4,5,'wall'], [13,2,12,6,4,5,'wall'],
      [0,1,-2,2,2,2,'blue'], [0,1,2,2,2,2,'blue']
    ];
    props.forEach(([x,y,z,w,h,d,m])=>this.box(x,y,z,w,h,d,this.materials[m]));
    // Marquages au sol
    const lineMat = new THREE.MeshBasicMaterial({color:0xa9a59b});
    for(let x=-16;x<=16;x+=4){ const line=new THREE.Mesh(new THREE.BoxGeometry(.06,.012,32),lineMat); line.position.set(x,.0,0); scene.add(line); }
  }
  box(x,y,z,w,h,d,mat,collide=true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z); mesh.castShadow=false; mesh.receiveShadow=true; this.scene.add(mesh);
    if(collide) this.colliders.push({x,z,hw:w/2,hd:d/2});
    return mesh;
  }
  resolve(p) {
    p.x=Math.max(-18.8,Math.min(18.8,p.x)); p.z=Math.max(-18.8,Math.min(18.8,p.z));
    for(const c of this.colliders) {
      const nx=Math.max(c.x-c.hw-.42,Math.min(c.x+c.hw+.42,p.x));
      const nz=Math.max(c.z-c.hd-.42,Math.min(c.z+c.hd+.42,p.z));
      const dx=p.x-nx,dz=p.z-nz;
      if(dx*dx+dz*dz<.42*.42){ if(Math.abs(dx)>Math.abs(dz)) p.x=nx+Math.sign(dx||1)*.43; else p.z=nz+Math.sign(dz||1)*.43; }
    }
  }
  hasLineOfSight(from,to) {
    const a=new THREE.Vector3(from.x,from.y+1.2,from.z), b=new THREE.Vector3(to.x,to.y+1.2,to.z);
    const dir=b.clone().sub(a); const dist=dir.length(); dir.normalize();
    const ray=new THREE.Raycaster(a,dir,0,dist);
    const hits=ray.intersectObjects(this.scene.children,true);
    return !hits.some(h=>h.object.geometry?.type==='BoxGeometry' && h.distance<dist-.5);
  }
}