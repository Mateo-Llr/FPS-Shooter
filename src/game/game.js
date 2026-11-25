import * as THREE from 'three';
import { World } from './world.js';
import { PlayerController } from './player.js';
import { WeaponSystem, WEAPONS } from './weapons.js';
import { HUD } from './hud.js';
import { MSG } from '../network/protocol.js';

export class Game {
  constructor(canvas, network) {
    this.canvas=canvas; this.network=network; this.scene=new THREE.Scene();
    this.camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,100);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)); this.renderer.setSize(innerWidth,innerHeight);
    this.world=new World(this.scene); this.controller=new PlayerController(this.camera,canvas,this.world);
    this.weapon=new WeaponSystem(); this.hud=new HUD(); this.clock=new THREE.Clock();
    this.active=false; this.host=false; this.health=100; this.remoteHealth=100; this.remote={x:0,y:0,z:-7,yaw:0};
    this.score=[0,0]; this.elapsed=0; this.deadUntil=0; this.config=null; this.enemyMesh=null;
    this.buildRemote(); this.bindNetwork(); this.bindKeys();
    addEventListener('resize',()=>this.resize()); this.animate();
  }
  buildRemote(){
    const group=new THREE.Group();
    const body=new THREE.Mesh(new THREE.CapsuleGeometry(.38,.85,4,8),new THREE.MeshStandardMaterial({color:0xc96b43}));
    body.position.y=1.05; group.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),new THREE.MeshStandardMaterial({color:0xd6aa8d}));
    head.position.y=1.72; group.add(head);
    this.enemyMesh=group; this.scene.add(group);
  }
  bindNetwork(){
    this.network.on(MSG.INPUT,data=>{if(this.host)this.receiveInput(data);});
    this.network.on(MSG.STATE,data=>{if(!this.host)this.applyState(data);});
    this.network.on(MSG.GAMEOVER,data=>this.finish(data.reason||'Fin de partie'));
    this.network.on(MSG.EVENT,data=>{if(data.kind==='hit')this.hud.message(`-${data.damage} PV`);});
    this.network.on(MSG.DISCONNECTED,()=>this.remoteDisconnected());
  }
  bindKeys(){
    document.addEventListener('keydown',e=>{
      if(!this.active)return;
      if(e.code==='Digit1')this.chooseWeapon('shotgun');
      if(e.code==='Digit2')this.chooseWeapon('rifle');
      if(e.code==='Digit3')this.chooseWeapon('sniper');
      if(e.code==='KeyR')this.weapon.reload();
    });
    this.controller.onShoot=shot=>this.shoot(shot);
  }
  chooseWeapon(name){if(this.config.weapon!=='all'&&this.config.weapon!==name)return;this.weapon.select(name);}
  start(config,host,youName,enemyName){
    this.config=config;this.host=host;this.youName=youName;this.enemyName=enemyName;
    this.health=100;this.remoteHealth=100;this.score=[0,0];this.elapsed=0;this.active=true;this.deadUntil=0;
    this.controller.position={x:0,y:0,z:host?7:-7};this.controller.yaw=host?Math.PI:0;
    this.controller.enabled=true;this.weapon.select(config.weapon==='all'?'rifle':config.weapon);
    document.querySelector('#menu').classList.add('hidden');
    document.querySelector('#lobby').classList.add('hidden');
    document.querySelector('#game').classList.remove('hidden');
    this.hud.show();this.hud.clearMessage();
    document.querySelector('#lock-hint').classList.remove('hidden');
    this.updateHUD();
  }
  receiveInput(data){
    if(!data.input)return;
    this.remote=data.input;
    this.enemyMesh.position.set(this.remote.x,0,this.remote.z);
    this.enemyMesh.rotation.y=this.remote.yaw;
    if(data.shot)this.validateShot(data.shot,0);
  }
  validateShot(shot,target=0){
    if(!this.active)return;
    const from={x:this.controller.position.x,y:this.controller.position.y,z:this.controller.position.z};
    const to={x:this.remote.x,y:this.remote.y,z:this.remote.z};
    const dx=to.x-from.x,dz=to.z-from.z,dist=Math.hypot(dx,dz);
    const aimX=Math.sin(shot.yaw),aimZ=Math.cos(shot.yaw);
    const dot=(dx*aimX+dz*aimZ)/Math.max(dist,.001);
    const range=WEAPONS[shot.weapon]?.range||0;
    const spread=shot.weapon==='shotgun'?.82:.96;
    if(dot>spread&&dist<range&&this.world.hasLineOfSight(from,to)){
      const damage=WEAPONS[shot.weapon].damage;
      if(target===0)this.health=Math.max(0,this.health-damage); else this.remoteHealth=Math.max(0,this.remoteHealth-damage);
      this.network.send(MSG.EVENT,{kind:'hit',damage});
      if(target===0&&this.health<=0)this.eliminate(0);
      if(target===1&&this.remoteHealth<=0)this.eliminate(1);
    }
  }
  shoot(shot){
    if(!this.active||this.deadUntil>performance.now())return;
    if(!this.weapon.consume()) {this.weapon.reload();return;}
    if(this.host)this.validateShot(shot,1);
    else this.network.send(MSG.INPUT,{input:this.controller.snapshot(),shot});
  }
  eliminate(victim){
    if(!this.host)return;
    const scorer=victim===0?1:0;this.score[scorer]++;
    this.network.send(MSG.STATE,{state:this.statePayload()});
    if(this.config.mode==='kills'&&this.score[scorer]>=this.config.target){this.end(scorer===0?'Victoire de l’hôte':'Victoire de l’adversaire');return;}
    if(victim===0)this.health=100;else this.remoteHealth=100;
    this.deadUntil=performance.now()+2000;
    if(victim===0)this.controller.position={x:0,y:0,z:7};
  }
  statePayload(){return {health:this.health,remoteHealth:this.remoteHealth,score:this.score,remote:this.remote,hostPos:this.controller.snapshot(),time:this.remaining()};}
  applyState(data){
    const s=data.state;if(!s)return;
    this.health=s.remoteHealth??100;this.remoteHealth=s.health;this.score=s.score;this.remote=s.hostPos;
    this.enemyMesh.position.set(this.remote.x,0,this.remote.z);
    this.enemyMesh.rotation.y=this.remote.yaw;
    this.enemyMesh.userData.score=s.score;
    this.remoteScore=s.score?.[0]??0;
    this.remoteTime=s.time;
  }
  remaining(){return this.config.mode==='time'?Math.max(0,this.config.duration-this.elapsed):0;}
  updateHUD(){
    const youScore=this.host?this.score[0]:this.score[1], enemyScore=this.host?this.score[1]:this.score[0];
    this.hud.update({health:this.health,youScore,enemyScore,time:this.config.mode==='time'?this.remaining():this.config.duration,weapon:this.weapon.stats(),ammo:this.weapon.ammo[this.weapon.current],youName:this.youName,enemyName:this.enemyName});
  }
  end(reason){this.active=false;this.controller.enabled=false;this.network.send(MSG.GAMEOVER,{reason});this.finish(reason);}
  finish(reason){
    this.active=false;this.controller.enabled=false;document.exitPointerLock?.();
    this.hud.message(`${reason} — ${this.score[0]} / ${this.score[1]}. Recharge la page pour revenir au menu.`);
  }
  remoteDisconnected(){
    if(!this.active)return;
    if(this.host){this.controller.enabled=false;this.hud.message('Adversaire déconnecté — reconnexion pendant 30 secondes…');this.disconnectDeadline=performance.now()+30000;}
    else this.hud.message('Connexion perdue. Retourne au salon et réessaie.');
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  animate=()=>{
    requestAnimationFrame(this.animate);
    const dt=Math.min(this.clock.getDelta(),.05);
    if(this.active){
      if(!this.disconnectDeadline)this.controller.update(dt);
      if(this.host){
        this.elapsed+=dt;
        if(this.config.mode==='time'&&this.remaining()<=0)this.end(this.score[0]>=this.score[1]?'Temps écoulé — hôte vainqueur':'Temps écoulé — adversaire vainqueur');
        if(this.disconnectDeadline&&performance.now()>this.disconnectDeadline){this.end('Victoire par forfait');this.disconnectDeadline=null;}
        if(this.deadUntil&&performance.now()>this.deadUntil){this.deadUntil=0;this.health=100;}
        this.network.send(MSG.STATE,{state:{health:this.health,remoteHealth:this.remoteHealth,score:this.score,hostPos:this.controller.snapshot(),remote:this.remote,time:this.remaining()}});
      } else {
        this.network.send(MSG.INPUT,{input:this.controller.snapshot()});
      }
      this.updateHUD();
    }
    this.renderer.render(this.scene,this.camera);
  };
}