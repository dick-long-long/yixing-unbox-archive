// Reuse the uploaded mesh, its texture and one WebGL context across draws.
let kernelRenderer;
async function prepareKernel(){
 const canvas=document.createElement('canvas');
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true});
 if(!gl) throw new Error('WebGL unavailable');
 const [mesh,texture]=await Promise.all([
  fetch('art-kernel.mesh').then(response=>{
   if(!response.ok) throw new Error('Mesh unavailable');
   return response.arrayBuffer();
  }),
  new Promise((resolve,reject)=>{
   const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;
   img.src='art-kernel-color.webp';
  })
 ]);
 const vertex=`
  attribute vec3 position,normal;attribute vec2 uv;
  uniform float angle,side,split,aspect;
  varying vec2 tex;varying vec3 n,local;
  void main(){
   local=position;tex=uv;
   float r=side*split*.38, c=cos(r), s=sin(r);
   mat3 tilt=mat3(c,-s,0.,s,c,0.,0.,0.,1.);
   mat3 spin=mat3(cos(angle),0.,-sin(angle),0.,1.,0.,sin(angle),0.,cos(angle));
   vec3 p=tilt*spin*position;p.x+=side*split*.48;p.y-=split*.08;
   n=tilt*spin*normal;
   gl_Position=vec4(p.x*.86/aspect,p.y*.86,-p.z*.48,1.);
  }`;
 const fragment=`
  precision mediump float;
  uniform sampler2D skin;uniform float side,split,heat;
  varying vec2 tex;varying vec3 n,local;
  void main(){
   float edge=local.x-.028*sin(local.y*11.)-.014*sin(local.y*32.+local.z*5.);
   if(side*edge<0.) discard;
   vec3 base=texture2D(skin,tex).rgb;
   float light=.67+.62*max(dot(normalize(n),normalize(vec3(-.55,.75,.9))),0.);
   vec3 shell=base*light;
   if(!gl_FrontFacing && split>.005) shell=base*.48+vec3(.12,.068,.025);
   float seam=1.-smoothstep(.002,.016,abs(edge));
   gl_FragColor=vec4(mix(shell,vec3(1.,.73,.30),seam*heat),1.);
  }`;
 const program=gl.createProgram();
 for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
  const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error('Shader unavailable');
  gl.attachShader(program,shader);
 }
 gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Program unavailable');
 gl.useProgram(program);
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
 for(const [name,size,offset] of [['position',3,0],['normal',3,12],['uv',2,24]]){
  const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,offset);
 }
 gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,texture);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,axis,gl.CLAMP_TO_EDGE);
 gl.enable(gl.DEPTH_TEST);
 const uniforms={};
 for(const name of ['angle','side','split','aspect','heat'])uniforms[name]=gl.getUniformLocation(program,name);
 return {canvas,draw(t){
  if(gl.isContextLost())throw new Error('Context lost');
  const ratio=Math.min(devicePixelRatio||1,1.5);
  const w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const phase=Math.min(1,Math.max(0,(t-1.25)/.85));
  const open=phase*phase*(3-2*phase);
  const tremble=Math.sin(t*55)*.026*Math.min(1,t)*Math.max(0,1-open);
  gl.uniform1f(uniforms.angle,.14+.48*Math.sin(Math.min(t,1.25)*2)+tremble);
  gl.uniform1f(uniforms.aspect,w/h);gl.uniform1f(uniforms.split,open);
  gl.uniform1f(uniforms.heat,Math.max(0,Math.min(1,(t-.85)*3))*(1-.55*open));
  for(const side of [-1,1]){
   gl.uniform1f(uniforms.side,side);gl.drawArrays(gl.TRIANGLES,0,mesh.byteLength/32);
  }
 }};
}
function prepareOpening(stage,signal,reveal){
 let renderer,frame,start=null;
 function paint(time){
  if(!renderer)return;
  try{renderer.draw(time);stage.classList.add('live')}
  catch{renderer=null;kernelRenderer=null;stage.classList.remove('live')}
 }
 if(!kernelRenderer)kernelRenderer=prepareKernel();
 kernelRenderer.then(ready=>{
  if(signal.aborted || (start!==null && performance.now()-start>700))return;
  renderer=ready;
  stage.querySelector('canvas').replaceWith(ready.canvas);
  if(start===null)paint(0);
 }).catch(()=>{kernelRenderer=null});
 function tick(now){
  if(signal.aborted)return;
  const time=.8+(now-start)/1000;
  paint(time);
  if(time>=1.25)stage.classList.add('opened');
  if(time>=2.45){reveal();return}
  frame=requestAnimationFrame(tick);
 }
 signal.addEventListener('abort',()=>cancelAnimationFrame(frame),{once:true});
 return ()=>{
  if(start!==null || signal.aborted)return;
  start=performance.now();
  frame=requestAnimationFrame(tick);
 };
}
