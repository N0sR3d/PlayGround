(() => {
  const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const $ = (s) => document.querySelector(s);
  const hud = $('#gameHud'), overlay = $('#titleOverlay'), completion = $('#completion');
  const keys = { left:false, right:false, jump:false, interact:false };
  const pressed = { jump:false, interact:false };
  let started=false, paused=false, finished=false, audioOn=false, room=false, toastTimer=0, frame=0, soundCtx;
  let levelIndex=0, lives=3, camera=0, score=0, checkpoint=24, savedX=24;
  const levels = [
    { name:'IL SENTIERO DEI FUNGHI', quest:'Le briciole<br>perdute', text:'Il vento ha sparpagliato i biscotti di Nonna. Recuperali e trova l’uscita del bosco!', tip:'Quel vecchio tronco sembra un po’ sospetto… prova ad avvicinarti e premere <b>E</b>.', width:1780, spawn:24,
      ground:[[0,220,405],[455,220,380],[875,220,355],[1275,220,505]],
      platforms:[[142,177,73],[265,145,58],[548,179,73],[686,151,64],[955,177,74],[1080,147,65],[1322,179,70],[1490,152,70]],
      items:[[202,160],[601,160],[1000,158]], enemySpawns:[[550,202,650],[1090,202,1210]], secretX:744, leverX:1194, gateX:1455, exitX:1717 },
    { name:'LE ROVINE DI MUSCHIO', quest:'I campanelli<br>del guardiano', text:'Tre campanelli risveglieranno il ponte antico. Spingi la cassa sulla lastra e raggiungi le rovine!', tip:'La lastra si attiva con un peso. Spingi la cassa fin sopra il cerchio inciso.', width:2010, spawn:24,
      ground:[[0,220,475],[510,220,455],[1005,220,465],[1470,220,540]],
      platforms:[[120,176,66],[255,145,66],[550,174,70],[689,144,64],[1130,176,70],[1280,145,66],[1535,175,70],[1710,143,78]],
      items:[[300,128],[761,126],[1575,155]], enemySpawns:[[570,202,730],[1180,202,1380],[1600,202,1800]], secretX:910, crateX:795, plateX:1038, gateX:1433, exitX:1950 }
  ];
  let player, items, enemies, crate, gateOpen=false, leverOn=false, collected=0;
  const solid=(x,y,w,h)=>({x,y,w,h});
  function loadLevel(index){
    levelIndex=index; const L=levels[index]; player={x:L.spawn,y:190,w:18,h:20,vx:0,vy:0,ground:false,face:1,walk:0,invuln:0};
    checkpoint=L.spawn; camera=0; items=L.items.map(([x,y])=>({x,y,got:false,bob:Math.random()*6}));
    enemies=L.enemySpawns.map(([x,y,min,max],i)=>({x,y,w:17,h:15,vx:i%2?-.55:.55,min,max,alive:true,phase:i*2}));
    crate=L.crateX?{x:L.crateX,y:194,w:25,h:26,vx:0}:null; collected=0; gateOpen=false;leverOn=false;room=false;score=0;
    $('#levelName').textContent=L.name;$('#chapterNum').textContent=String(index+1).padStart(2,'0');
    $('#questTitle').innerHTML=L.quest;$('#questText').textContent=L.text;$('#tipText').innerHTML=L.tip;
    $('#routeSecond').classList.toggle('unlocked',index===1);$('#routeSecond').classList.toggle('active',index===1);
    document.querySelector('.map-count').innerHTML=(index+1).toString().padStart(2,'0')+' <i>/</i> 02';
    updateProgress();
  }
  function begin(){started=true;paused=false;finished=false;overlay.classList.add('gone');completion.hidden=true;hud.hidden=false;loadLevel(levelIndex);toast('Vai, Biscotto! Segui le briciole.');}
  function beep(freq=520,dur=.07){if(!audioOn)return;try{soundCtx ||= new(window.AudioContext||window.webkitAudioContext)();const o=soundCtx.createOscillator(),g=soundCtx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.035,soundCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,soundCtx.currentTime+dur);o.connect(g);g.connect(soundCtx.destination);o.start();o.stop(soundCtx.currentTime+dur)}catch(e){}}
  function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');toastTimer=145;}
  function updateProgress(){const total=items?items.length:3;$('#itemCount').textContent=`${collected} / ${total}`;$('#questProgress').textContent=`${collected} / ${total}`;$('#progressFill').style.width=`${Math.min(100,collected/total*100)}%`;$('#lifeCount').textContent=lives;}
  function rects(){const L=levels[levelIndex];const all=L.ground.map(([x,y,w])=>solid(x,y,w,65)).concat(L.platforms.map(([x,y,w])=>solid(x,y,w,10)));if(!gateOpen)all.push(solid(L.gateX,176,27,44));return all;}
  function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
  function near(x,range=32){return Math.abs(player.x+player.w/2-x)<range;}
  function interact(){if(room){room=false;player.x=savedX;player.y=180;player.vy=0;camera=Math.max(0,player.x-150);toast('Di nuovo nel bosco. Il segreto è tuo!');beep(440);return}
    const L=levels[levelIndex];
    if(near(L.secretX,38)){room=true;savedX=player.x;player.x=54;player.y=180;player.vx=0;player.vy=0;toast('Una stanza segreta!');beep(750);return}
    if(levelIndex===0&&near(L.leverX,39)){leverOn=true;gateOpen=true;toast('CLACK! Il cancello si è aperto.');beep(680);return}
    if(levelIndex===1&&crate&&Math.abs(player.x+player.w/2-(L.plateX+12))<48){toast('Spingi la cassa sopra la lastra!');return}
    if(near(L.exitX,48)){if(collected<items.length){toast(`Mancano ancora ${items.length-collected} briciole!`);return}if(levelIndex===1&&!gateOpen){toast('Il ponte è ancora chiuso. Attiva la lastra!');return}if(levelIndex===0&&!gateOpen){toast('C’è un cancello chiuso più avanti. Cerca la leva!');return}winLevel();}
  }
  function winLevel(){beep(820,.2);if(levelIndex===0){finished=true;completion.hidden=false;$('#completeTitle').textContent='Il bosco ti sorride';$('#completeText').textContent='Hai trovato tutte le briciole. Le rovine ti aspettano!';$('#continueBtn').textContent='VERSO LE ROVINE  →';$('#routeSecond').classList.add('unlocked');}else{finished=true;completion.hidden=false;$('#completeTitle').textContent='Una coda da campione!';$('#completeText').textContent='Biscotto ha salvato il Regno dei Funghi.';$('#continueBtn').textContent='GIOCA ANCORA  ↻';}}
  function respawn(){lives--;updateProgress();if(lives<=0){lives=3;loadLevel(levelIndex);toast('Una nuova avventura, forza Biscotto!')}else{player.x=checkpoint;player.y=175;player.vx=0;player.vy=0;player.invuln=95;toast('Ops! Riproviamo insieme.')}beep(180,.13)}
  function update(){if(!started||paused||finished)return;frame++;
    if(toastTimer>0&&--toastTimer===0)$('#toast').classList.remove('show');
    if(pressed.interact){interact();pressed.interact=false;if(room||finished)return}
    if(room){player.vx=(keys.right?1:0)-(keys.left?1:0);player.x=Math.max(26,Math.min(445,player.x+player.vx*2.2));player.vy=Math.min(6,player.vy+.38);player.y+=player.vy;if(player.y>199){player.y=199;player.vy=0;player.ground=true}if(pressed.jump&&player.ground){player.vy=-6.5;player.ground=false}pressed.jump=false;return}
    const L=levels[levelIndex], solids=rects();player.vx=(keys.right?1:0)-(keys.left?1:0);if(player.vx)player.face=player.vx>0?1:-1;player.vx*=2.0;player.x+=player.vx;
    if(player.x<0)player.x=0;if(player.x>L.width-player.w)player.x=L.width-player.w;
    for(const s of solids){if(overlaps(player,s)){if(player.vx>0)player.x=s.x-player.w;else if(player.vx<0)player.x=s.x+s.w;}}
    if(pressed.jump&&player.ground){player.vy=-7.2;player.ground=false;beep(420,.045)}pressed.jump=false;
    player.vy=Math.min(8,player.vy+.38);const oldBottom=player.y+player.h;player.y+=player.vy;player.ground=false;
    for(const s of solids){if(overlaps(player,s)){if(player.vy>=0&&oldBottom<=s.y+3){player.y=s.y-player.h;player.vy=0;player.ground=true}else if(player.vy<0){player.y=s.y+s.h;player.vy=0}}}
    if(player.ground){player.walk+=Math.abs(player.vx)*.11;if(player.x>checkpoint+240)checkpoint=player.x-40}
    if(player.y>290){respawn();return}
    if(player.invuln>0)player.invuln--;
    items.forEach(it=>{if(!it.got&&overlaps({x:player.x-3,y:player.y-3,w:player.w+6,h:player.h+6},{x:it.x-5,y:it.y-5,w:15,h:15})){it.got=true;collected++;score+=100;updateProgress();toast('Briciola trovata! ✦');beep(740,.1)}});
    for(const e of enemies){if(!e.alive)continue;e.x+=e.vx;if(e.x<e.min||e.x>e.max)e.vx*=-1;e.phase+=.09;if(overlaps(player,e)){if(player.vy>1&&player.y+player.h<e.y+9){e.alive=false;player.vy=-4.5;score+=150;beep(640)}else if(player.invuln===0){respawn();return}}}
    if(crate){crate.x+=crate.vx;crate.vx*=.77;if(Math.abs(crate.vx)<.08)crate.vx=0;crate.x=Math.max(480,Math.min(1405,crate.x));if(player.y+player.h>crate.y&&player.y<crate.y+crate.h&&player.x<crate.x+crate.w&&player.x+player.w>crate.x){if(player.vx>0){player.x=crate.x-player.w;crate.vx=1.6}else if(player.vx<0){player.x=crate.x+crate.w;crate.vx=-1.6}}
      if(crate.x+crate.w>L.plateX-4&&crate.x<L.plateX+37){if(!gateOpen){gateOpen=true;toast('La lastra si illumina: ponte aperto!');beep(680)}}}
    if(levelIndex===0&&leverOn)gateOpen=true;
    camera=Math.max(0,Math.min(L.width-480,player.x-190));
  }
  function draw(){ctx.clearRect(0,0,480,270);if(!started){drawScene(0,false);drawDog(102,191,1,0,false);return}if(room){drawSecret();drawDog(player.x-camera,player.y,player.face,player.walk,player.invuln>0);return}drawScene(camera,true);const L=levels[levelIndex];
    // platforms and ground
    for(const [x,y,w] of L.ground){ctx.fillStyle='#594d3b';ctx.fillRect(x-camera,y,w,60);ctx.fillStyle='#77905a';ctx.fillRect(x-camera,y,w,5);ctx.fillStyle='#a1a36b';for(let px=x;px<x+w;px+=18){ctx.fillRect(px-camera,y+5,9,2);ctx.fillRect(px-camera+8,y+13,5,2)}ctx.fillStyle='#3d4739';for(let px=x+9;px<x+w;px+=32)ctx.fillRect(px-camera,y+24,2,7)}
    for(const [x,y,w] of L.platforms){ctx.fillStyle='#675543';ctx.fillRect(x-camera,y,w,10);ctx.fillStyle='#9da56d';ctx.fillRect(x-camera,y,w,4);for(let px=x+8;px<x+w;px+=17){ctx.fillStyle='#6b8055';ctx.fillRect(px-camera,y-2,4,3)}}
    // Secret tree entrance marker
    drawTree(L.secretX-camera-14,206,true);
    if(levelIndex===0){drawLever(L.leverX-camera,218,leverOn);drawGate(L.gateX-camera,220,gateOpen)}
    else{drawPlate(L.plateX-camera,220,gateOpen);if(crate){ctx.fillStyle='#634b37';ctx.fillRect(crate.x-camera,crate.y,crate.w,crate.h);ctx.fillStyle='#b68754';ctx.fillRect(crate.x-camera+3,crate.y+3,crate.w-6,crate.h-6);ctx.strokeStyle='#493d32';ctx.lineWidth=2;ctx.strokeRect(crate.x-camera+6,crate.y+6,crate.w-12,crate.h-12);ctx.fillStyle='#d3b47a';ctx.fillRect(crate.x-camera+10,crate.y+10,5,5)}drawGate(L.gateX-camera,220,gateOpen)}
    items.forEach(it=>{if(it.got)return;let y=it.y+Math.sin(frame*.08+it.bob)*2;ctx.fillStyle='#f8d783';ctx.fillRect(it.x-camera+2,y-5,5,5);ctx.fillStyle='#ffe9a8';ctx.fillRect(it.x-camera,y,9,7);ctx.fillStyle='#d99b58';ctx.fillRect(it.x-camera+2,y+2,2,2);ctx.fillRect(it.x-camera+6,y+2,2,2)});
    enemies.forEach(e=>{if(e.alive)drawSlug(e.x-camera,e.y,e.phase,e.vx>0)});
    drawExit(L.exitX-camera,220,gateOpen,collected===items.length);
    drawDog(player.x-camera,player.y,player.face,player.walk,player.invuln>0);
    // foreground flowers
    for(let x=Math.floor(camera/47)*47;x<camera+480;x+=47){if(x%3) {ctx.fillStyle='#527b53';ctx.fillRect(x-camera,214,1,7);ctx.fillStyle=x%2?'#eea078':'#f3d37e';ctx.fillRect(x-camera-1,212,3,3)}}
    if(levelIndex===1&&crate&&Math.abs(player.x+player.w/2-(levels[1].plateX+12))<58&&!gateOpen)drawPrompt(160,'SPINGI LA CASSA →');
    else if(near(L.secretX,42))drawPrompt(Math.max(34,Math.min(392,L.secretX-camera-38)),'E  ENTRA');
    else if(levelIndex===0&&near(L.leverX,46)&&!leverOn)drawPrompt(L.leverX-camera-26,'E  TIRA');
    else if(near(L.exitX,54))drawPrompt(350,collected<items.length?'TROVA LE BRICIOLE':'E  ESCI');
  }
  function drawScene(cam,world){
    const sky=ctx.createLinearGradient(0,0,0,270);sky.addColorStop(0,'#83bec4');sky.addColorStop(.63,'#b1d6b7');sky.addColorStop(1,'#e5d7a2');ctx.fillStyle=sky;ctx.fillRect(0,0,480,270);
    // clouds
    for(let i=0;i<5;i++){let x=((i*123-cam*.16+frame*.025)%580+580)%580-50,y=35+(i%3)*20;ctx.fillStyle='#e7e9ca99';ctx.fillRect(x,y,31,7);ctx.fillRect(x+7,y-5,17,13);ctx.fillRect(x+24,y+2,11,5)}
    // far hills
    ctx.fillStyle='#91b79a';for(let i=-1;i<7;i++){let x=i*102-(cam*.22%102);ctx.beginPath();ctx.moveTo(x,193);ctx.lineTo(x+45,105+(i%3)*12);ctx.lineTo(x+112,193);ctx.fill()}
    ctx.fillStyle='#6d9c79';for(let i=-1;i<8;i++){let x=i*92-(cam*.4%92);ctx.fillRect(x,177,56,48);ctx.fillRect(x+9,164,39,13);ctx.fillRect(x+18,154,22,10)}
    // sunlight / distant speckles
    ctx.fillStyle='#f6d990';ctx.fillRect(398,44,15,15);ctx.fillStyle='#ffedb3';ctx.fillRect(402,40,7,23);
    for(let i=0;i<18;i++){let x=((i*73-cam*.55)%520+520)%520;let y=104+(i*29%68);ctx.fillStyle=i%2?'#d9e8ba':'#f4dda1';ctx.fillRect(x,y,2,2)}
    if(!world){for(let i=0;i<4;i++)drawTree(38+i*126,218,false)}
  }
  function drawTree(x,y,secret){if(x<-60||x>530)return;ctx.fillStyle='#615343';ctx.fillRect(x+17,y-30,13,35);ctx.fillRect(x+9,y-22,7,5);ctx.fillStyle=secret?'#355946':'#497656';ctx.fillRect(x+4,y-48,38,25);ctx.fillRect(x+10,y-57,26,12);ctx.fillStyle=secret?'#416849':'#5f8a5e';ctx.fillRect(x+1,y-41,9,15);ctx.fillRect(x+35,y-39,9,13);ctx.fillStyle='#9c9861';ctx.fillRect(x+9,y-26,3,2);if(secret){ctx.fillStyle='#213b39';ctx.fillRect(x+19,y-22,10,20);ctx.fillStyle='#d5b078';ctx.fillRect(x+18,y-23,12,2);ctx.fillStyle='#f5cb78';ctx.fillRect(x+23,y-20,2,2)}}
  function drawDog(x,y,face,walk,blink){const bob=Math.sin(walk)*1.5,flip=face<0;ctx.save();ctx.translate(Math.round(x+9),Math.round(y+bob));if(flip)ctx.scale(-1,1);
    // shadow
    ctx.fillStyle='#34483f55';ctx.fillRect(-10,19,21,3);
    // tail wag
    ctx.fillStyle='#9f6041';let wag=Math.sin(frame*.35)*2;ctx.fillRect(-12,3+wag,5,3);ctx.fillRect(-15,1+wag,4,3);ctx.fillStyle='#e8b17b';ctx.fillRect(-15,1+wag,2,2);
    // legs
    let step=Math.sin(walk*2)*2;ctx.fillStyle='#77462f';ctx.fillRect(-6,11,4,7+Math.max(0,step));ctx.fillRect(4,11,4,7+Math.max(0,-step));ctx.fillStyle='#e5b080';ctx.fillRect(-7,17+Math.max(0,step),6,2);ctx.fillRect(3,17+Math.max(0,-step),6,2);
    // long body and back
    ctx.fillStyle='#a66541';ctx.fillRect(-8,2,15,11);ctx.fillStyle='#c68150';ctx.fillRect(-7,1,12,3);ctx.fillRect(-7,5,13,5);ctx.fillStyle='#e8bd89';ctx.fillRect(-7,10,13,3);ctx.fillStyle='#8c5538';ctx.fillRect(-8,3,2,7);
    // neck and head
    ctx.fillStyle='#b9754b';ctx.fillRect(3,-3,8,11);ctx.fillStyle='#d29461';ctx.fillRect(5,-6,9,10);ctx.fillRect(10,-2,7,6);ctx.fillStyle='#edc795';ctx.fillRect(11,2,7,4);ctx.fillStyle='#3f332d';ctx.fillRect(17,0,3,3);
    // floppy ear
    ctx.fillStyle='#74452f';ctx.fillRect(6,-8,6,6);ctx.fillRect(5,-5,4,5);ctx.fillStyle='#a45f3d';ctx.fillRect(7,-7,3,4);
    // eye and eyebrow
    ctx.fillStyle=blink?'#d0925e':'#2e2925';if(!blink)ctx.fillRect(12,-2,2,2);ctx.fillStyle='#f5dfbd';ctx.fillRect(13,0,1,1);
    // collar
    ctx.fillStyle='#dc7357';ctx.fillRect(3,5,8,2);ctx.fillStyle='#f0c967';ctx.fillRect(7,7,2,2);
    ctx.restore();}
  function drawLever(x,y,on){ctx.fillStyle='#574b3a';ctx.fillRect(x-9,y-4,19,4);ctx.fillStyle='#916e47';ctx.fillRect(x-2,y-18,4,15);ctx.fillStyle=on?'#f7d780':'#c77d59';ctx.fillRect(x+(on?1:-6),y-23,7,6);ctx.fillStyle='#e5c27e';ctx.fillRect(x-2,y-6,4,2)}
  function drawGate(x,y,open){if(open){ctx.fillStyle='#e9cd8a';ctx.fillRect(x,y-2,26,3);ctx.fillStyle='#fff0b0';ctx.fillRect(x+8,y-6,9,2);return}ctx.fillStyle='#65583f';ctx.fillRect(x-2,y-44,5,44);ctx.fillRect(x+24,y-44,5,44);ctx.fillStyle='#a88859';ctx.fillRect(x+4,y-39,3,37);ctx.fillRect(x+12,y-39,3,37);ctx.fillRect(x+20,y-39,3,37);ctx.fillStyle='#d1b476';ctx.fillRect(x-3,y-45,34,4)}
  function drawPlate(x,y,on){ctx.fillStyle=on?'#e7d185':'#786849';ctx.fillRect(x,y-3,35,3);ctx.fillStyle=on?'#fff0a5':'#b09b69';ctx.fillRect(x+5,y-5,25,2);if(on){ctx.fillStyle='#fff0a588';ctx.fillRect(x+10,y-8,15,3)}}
  function drawExit(x,y,open,ready){ctx.fillStyle='#4b453a';ctx.fillRect(x-12,y-37,25,37);ctx.fillStyle=ready?'#d59b62':'#75694f';ctx.fillRect(x-9,y-34,19,34);ctx.fillStyle=ready?'#f6d38e':'#a39569';ctx.fillRect(x-6,y-30,13,30);ctx.fillStyle='#42483b';ctx.fillRect(x+3,y-17,2,2);if(ready){ctx.fillStyle='#ffe49c';ctx.fillRect(x-2,y-27,4,4);ctx.fillRect(x-3,y-22,6,2)}}
  function drawSlug(x,y,phase,right){const bob=Math.sin(phase*2);ctx.fillStyle='#506b54';ctx.fillRect(x,y+5+bob,16,9);ctx.fillRect(x+4,y+1+bob,11,8);ctx.fillStyle='#78a16e';ctx.fillRect(x+5,y+2+bob,7,5);ctx.fillStyle='#263a35';ctx.fillRect(x+(right?12:5),y+3+bob,2,2);ctx.fillStyle='#d3b27e';ctx.fillRect(x+2,y+12+bob,3,2);ctx.fillRect(x+11,y+12+bob,3,2)}
  function drawPrompt(x,text){ctx.font='7px "DM Mono", monospace';let w=ctx.measureText(text).width+12;ctx.fillStyle='#233b3bea';ctx.fillRect(Math.round(x),174,w,15);ctx.fillStyle='#f9e8bd';ctx.fillText(text,Math.round(x+6),184);}
  function drawSecret(){ctx.fillStyle='#182a35';ctx.fillRect(0,0,480,270);ctx.fillStyle='#213b42';ctx.fillRect(0,0,480,212);ctx.fillStyle='#2d5050';ctx.fillRect(0,0,480,8);for(let x=15;x<480;x+=48){ctx.fillStyle='#38615a';ctx.fillRect(x,33+(x%3)*9,12,3);ctx.fillRect(x+7,36+(x%3)*9,3,10)}ctx.fillStyle='#3a3b32';ctx.fillRect(0,210,480,60);ctx.fillStyle='#71835a';ctx.fillRect(0,207,480,5);for(let i=0;i<24;i++){let x=(i*37+12)%480;ctx.fillStyle=i%2?'#aac77b':'#d0b77a';ctx.fillRect(x,205-(i%3),2,2)}
    // warm secret glow and treasure
    ctx.fillStyle='#725b3c';ctx.fillRect(340,148,72,54);ctx.fillStyle='#a57948';ctx.fillRect(345,153,62,44);ctx.fillStyle='#d3a85e';ctx.fillRect(345,150,62,8);ctx.fillStyle='#735239';ctx.fillRect(353,161,46,29);ctx.fillStyle='#c89955';ctx.fillRect(356,164,40,23);ctx.fillStyle='#f1d48b';ctx.fillRect(373,164,7,5);ctx.fillStyle='#fff1b1';ctx.fillRect(375,165,3,3);
    ctx.fillStyle='#f6dda0';ctx.fillRect(370,130,6,6);ctx.fillRect(358,138,4,4);ctx.fillRect(391,135,5,5);ctx.fillStyle='#d99460';ctx.fillRect(20,178,38,29);ctx.fillStyle='#ebba7a';ctx.fillRect(25,182,28,21);ctx.fillStyle='#493a31';ctx.fillRect(32,190,2,2);ctx.fillRect(43,190,2,2);ctx.fillStyle='#eccb91';ctx.fillRect(32,196,13,3);
    ctx.fillStyle='#fff2ca';ctx.font='8px "DM Mono", monospace';ctx.fillText('PICCOLO RIFUGIO',181,37);ctx.font='6px "DM Mono", monospace';ctx.fillStyle='#b4c6a5';ctx.fillText('PREMI E PER TORNARE',175,50);drawPrompt(25,'E  ESCI');}
  function updateUiState(){
    $('#lifeCount').textContent=lives;
    $('#pauseBtn').textContent=paused?'▶':'Ⅱ';
    $('#soundBtn').style.color=audioOn?'#f2bd84':'#f7d8b8';
  }
  function loop(){update();draw();requestAnimationFrame(loop)}
  $('#startBtn').addEventListener('click',begin);
  $('#continueBtn').addEventListener('click',()=>{
    completion.hidden=true;
    if(levelIndex===0){loadLevel(1);lives=Math.max(lives,3);started=true;finished=false;hud.hidden=false;toast('Benvenuto alle Rovine di muschio!')}
    else{levelIndex=0;lives=3;begin()}
  });
  $('#pauseBtn').addEventListener('click',()=>{if(!started||finished)return;paused=!paused;$('#pauseBtn').textContent=paused?'▶':'Ⅱ';toast(paused?'Pausa — premi ▶ per ripartire':'Si riparte!')});
  $('#soundBtn').addEventListener('click',()=>{audioOn=!audioOn;updateUiState();if(audioOn)beep(640)});
  window.addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();if(['arrowleft','arrowright','arrowup',' ','w','a','d'].includes(k))e.preventDefault();
    if(k==='arrowleft'||k==='a')keys.left=true;if(k==='arrowright'||k==='d')keys.right=true;
    if(k===' '||k==='arrowup'||k==='w'){if(!keys.jump)pressed.jump=true;keys.jump=true}
    if(k==='e'||k==='enter'){if(!keys.interact)pressed.interact=true;keys.interact=true}
    if(k==='escape'&&started&&!finished){paused=!paused;$('#pauseBtn').textContent=paused?'▶':'Ⅱ'}
  },{passive:false});
  window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k==='arrowleft'||k==='a')keys.left=false;if(k==='arrowright'||k==='d')keys.right=false;if(k===' '||k==='arrowup'||k==='w')keys.jump=false;if(k==='e'||k==='enter')keys.interact=false});
  window.addEventListener('blur',()=>{keys.left=keys.right=keys.jump=keys.interact=false});
  document.querySelectorAll('[data-control]').forEach(button=>{
    const control=button.dataset.control;
    const down=e=>{e.preventDefault();if(control==='jump'){if(!keys.jump)pressed.jump=true;keys.jump=true}else if(control==='interact'){if(!keys.interact)pressed.interact=true;keys.interact=true}else keys[control]=true;try{button.setPointerCapture(e.pointerId)}catch(_){} };
    const up=e=>{e.preventDefault();if(control==='jump')keys.jump=false;else if(control==='interact')keys.interact=false;else keys[control]=false};
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('lostpointercapture',up);
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  loadLevel(0);updateUiState();requestAnimationFrame(loop);
})();
