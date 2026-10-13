import { chromium } from '@playwright/test';
const browser = await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto(process.env.PRODUCTION_URL||'http://127.0.0.1:4173/');
  await page.getByRole('button',{name:'進場逛逛 →',exact:true}).click();
  await page.getByRole('button',{name:'靜音進場',exact:true}).click();
  await page.getByRole('button',{name:'知道了，去逛逛 →'}).click();
  await page.getByRole('button',{name:'攤位目錄',exact:true}).click();
  const boothCount=await page.locator('.directory-row').count();
  await page.getByRole('searchbox').fill('A01');
  await page.getByRole('button',{name:'查看資料',exact:true}).click();
  await page.getByRole('button',{name:/寄給明天的信 漫畫/}).click();
  await page.getByRole('button',{name:'翻開試閱 →'}).click();
  const previewPages=await page.locator('.preview-page').count();
  const devHook=await page.evaluate(()=>Object.hasOwn(window,'streetDemo'));
  if(boothCount!==12||previewPages!==3||devHook||errors.length)throw Error(JSON.stringify({boothCount,previewPages,devHook,errors}));
  console.log(JSON.stringify({production:'passed',boothCount,previewPages,devHook,errors}));
} finally {await browser.close();}
