const $=id=>document.getElementById(id);
const dialog=document.querySelector('dialog');
const key='yixing-box-collection-v1';
let counts={};
try{counts=JSON.parse(localStorage.getItem(key))||{}}catch{}
let filtered=false;
let pendingDraw=null;
const count=w=>Number.isSafeInteger(counts[w.id])&&counts[w.id]>0?counts[w.id]:0;
function render(){
 const owned=works.filter(w=>count(w));
 $('total').textContent=owned.length;
 $('mine').setAttribute('aria-pressed',filtered);
 $('all').setAttribute('aria-pressed',!filtered);
 $('grid').replaceChildren();
 const visible=filtered?owned:works;
 $('empty').hidden=!!visible.length;
 for(const w of visible){
  const quantity = count(w);
  const image = quantity ? 'front' : 'silhouette';
  const status = quantity ? '已收藏 ×' + quantity : '未解锁';
  const card = document.createElement('button');
  card.className = 'card' + (quantity ? '' : ' locked');
  card.innerHTML = `<img loading="lazy" src="art-${w.id}-${image}.webp" alt="">
   <span class="num">FIG. 0${w.id}</span>
   <div class="caption"><h3>${w.name}</h3><span><b>${status}</b> ↗</span></div>`;
  card.onclick=()=>show(w,false);$('grid').append(card);
 }
}
function show(w, drawn) {
 if (!count(w)) {
  const detail = $('detail');
  detail.innerHTML = `
   <div class="stage"><img class="portrait" src="art-${w.id}-silhouette.webp" alt="${w.name}剪影"></div>
   <div class="info"><small class="series">FIG. 0${w.id} / 08</small>
    <h2 id="title">${w.name}</h2><p>未解锁</p>
    <p class="guide">抽中这个角色后，即可查看正视图和 AR 作品。</p>
    <button class="ar">免费抽一盒</button></div>`;
  detail.querySelector('button').onclick = draw;
  if (!dialog.open) dialog.showModal();
  return;
 }
 const viewerURL = new URL(w.url);
 viewerURL.searchParams.delete('x-qr');
 const detail = $('detail');
 detail.innerHTML = `
  <div class="stage"><img class="portrait" src="art-${w.id}-front.webp" alt="${w.name}角色正面"></div>
  <div class="info">
   <small class="series">FIG. 0${w.id} / 08</small>
   <h2 id="title">${w.name}</h2>
   <p>${drawn ? '本次抽中 · 已收藏 ×' + count(w) : '异形志系列角色'}</p>
   <button class="ar preview">查看 3D 模型</button>
   <a class="external" href="${viewerURL.href}" target="_blank" rel="noopener">独立打开 3D / AR ↗</a>
   <img class="qr" src="art-${w.id}-qr.png" alt="${w.name} AR 二维码">
   <p class="guide">用手机相机扫码，在查看器中点右下角按钮进入 AR。</p>
   <button class="again">再抽一盒</button>
  </div>`;
 const stage = detail.querySelector('.stage');
 const preview = detail.querySelector('.preview');
 const poster = stage.firstElementChild;
 preview.onclick = () => {
  if (stage.firstElementChild === poster) {
   const frame = document.createElement('iframe');
   frame.title = w.name + ' · MyARStudio 3D 查看器';
   frame.allow = 'xr-spatial-tracking *; fullscreen *; web-share *';
   frame.allowFullscreen = true;
   frame.src = viewerURL.href;
   stage.replaceChildren(frame);
   preview.textContent = '返回角色图';
  } else {
   stage.replaceChildren(poster);
   preview.textContent = '查看 3D 模型';
  }
 };
 detail.querySelector('.again').onclick = draw;
 if (!dialog.open) dialog.showModal();
}
function draw(){
 if(pendingDraw) return;
 const random=crypto.getRandomValues(new Uint32Array(1))[0];
 const work=works[random%works.length];
 const detail=$('detail');
 detail.innerHTML=`<section class="opening"><h2 id="title">乌榄开核</h2>
  <button type="button" class="kernel-stage" aria-labelledby="kernel-hint"><span class="kernel-halo"></span>
  <span class="kernel-fallback"><i></i><i></i></span><canvas aria-hidden="true"></canvas></button>
  <p id="kernel-hint" aria-live="polite">手动点击乌榄核，揭晓角色</p></section>`;
 if(!dialog.open)dialog.showModal();
 const opening=detail.querySelector('.opening');
 const controller=new AbortController();
 pendingDraw=controller;
 function reveal(){
  if(pendingDraw!==controller || !dialog.open)return;
  pendingDraw=null;
  controller.abort();
  counts[work.id]=count(work)+1;
  try{localStorage.setItem(key,JSON.stringify(counts))}catch{}
  render();show(work,true);
 }
 const stage=opening.querySelector('.kernel-stage');
 const startOpening=prepareOpening(stage,controller.signal,reveal);
 stage.focus();
 stage.onclick=()=>{
  if(stage.disabled || controller.signal.aborted)return;
  stage.disabled=true;
  opening.querySelector('#kernel-hint').textContent='果核正在裂开…';
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)reveal();
  else startOpening();
 };
}
function filter(value){filtered=value;render()}
$('draw').onclick=draw;$('mine').onclick=()=>filter(true);$('all').onclick=()=>filter(false);
$('owned').onclick=()=>{filter(true);$('catalog').scrollIntoView()};
$('close').onclick=()=>dialog.close();dialog.onclose=()=>{pendingDraw?.abort();pendingDraw=null;$('detail').replaceChildren()};
dialog.onclick=e=>{if(e.target===dialog)dialog.close()};render();
