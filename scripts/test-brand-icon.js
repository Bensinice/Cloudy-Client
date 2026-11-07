const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+process.cwd()+'/index.html');await p.waitForTimeout(500);
const q=async v=>{await p.evaluate(v=>document.querySelector('.brand').dataset.plus=v,v);return p.evaluate(()=>getComputedStyle(document.querySelector('.bplus')).display)};
const a=await q('0'),c=await q('1');
const img=await p.evaluate(()=>!!document.querySelector('.brand img'));
await p.locator('.brand').screenshot({path:'/tmp/brand-plus.png'});
console.log(a,c,img);if(a!=='none'||c==='none'||img)process.exit(1);console.log('OK');await b.close()})();
