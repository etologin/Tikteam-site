import { languages } from './languages.js';
import { aliases } from './language-aliases.js';
import './locale-web.js';

const codes=new Set(languages.map(x=>x.code));
const storageKey='tikteam.ui.language';
let selected='ru', dictionary={}, instance=null, choiceVersion=0;
const browser=typeof document!=='undefined';
const assets=new URL('../',import.meta.url);
function stored(){try{return localStorage.getItem(storageKey);}catch{return null;}}
function save(code){try{localStorage.setItem(storageKey,code);}catch{/* Private browsing can refuse storage. */}}
function accountLinks(){
  for(const link of document.querySelectorAll('a[href]')){
    const url=new URL(link.href,location.href);
    if(url.protocol!=='https:' || url.hostname!=='account.tikteam.live')continue;
    const base=url.pathname.startsWith('/en/')?'en':'ru';
    if(selected===base)url.searchParams.delete('lang');else url.searchParams.set('lang',selected);
    link.href=url;
  }
}
function heroHeading(){
  const heading=document.querySelector('.hero h1');if(!heading)return;
  // Translate the complete thought. The original Russian splits its preposition
  // from the highlighted words, which cannot be safely reordered by a DOM translator.
  heading.setAttribute('data-no-i18n','');
  const accent=document.createElement('span');accent.className='grad';
  if(selected==='ru' || selected==='en'){
    const russian=selected==='ru';accent.textContent=russian?'ваш эфир':'join the game';
    heading.replaceChildren(document.createTextNode(russian?'Зрители играют':'Your viewers'),document.createElement('br'),
      document.createTextNode(russian?'в ':''),accent);
  }else{
    const source='TikTeam — зрители играют в ваш эфир';
    accent.textContent=(dictionary[source]??source).replace(/^TikTeam\s*[—–-]\s*/u,'');
    heading.replaceChildren(accent);
  }
}
export function pageLanguage(){return browser?selected:'ru';}
export function translateCopy(source,code=selected){return code===selected&&code!=='ru'?(dictionary[source]??source):source;}
function script(url){return new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=url;tag.onload=resolve;tag.onerror=()=>{tag.remove();reject(Error('Language file unavailable'));};document.head.append(tag);});}
async function load(code){
  if(code==='ru')return {};
  if(!globalThis.TikTeamSiteDictionaries?.[code])await script(new URL('i18n/'+code+'.js',assets));
  const words=globalThis.TikTeamSiteDictionaries?.[code];
  if(!words)throw Error('Language file is incomplete');
  return words;
}
function picker(){
  const old=document.querySelector('.top .lang');if(!old)return;
  const wrapper=document.createElement('label');wrapper.className='language-picker';wrapper.setAttribute('data-no-i18n','');
  const image=document.createElement('img');image.width=22;image.height=16;image.alt='';
  const select=document.createElement('select');select.setAttribute('aria-label','Language / Язык');
  for(const language of languages){const option=document.createElement('option');option.value=language.code;option.textContent=language.name;select.append(option);}
  select.value=selected;image.src=new URL('i18n/flags/'+languages.find(x=>x.code===selected).country+'.png',assets);
  select.addEventListener('change',async()=>{
    const next=select.value,version=++choiceVersion;select.disabled=true;
    const previous=selected,previousDictionary=dictionary;
    try{
      const words=await load(next);if(version!==choiceVersion)return;
      selected=next;dictionary=words;
      if(!await instance.select(next,words))throw Error('Language change cancelled');
      save(next);
      accountLinks();heroHeading();
      image.src=new URL('i18n/flags/'+languages.find(x=>x.code===next).country+'.png',assets);
      const url=new URL(location.href);url.searchParams.set('lang',next);history.replaceState(null,'',url);
    }catch{
      if(version===choiceVersion){selected=previous;dictionary=previousDictionary;select.value=previous;}
    }finally{if(version===choiceVersion)select.disabled=false;}
  });
  wrapper.append(image,select);old.replaceWith(wrapper);
}
export const localizationReady=browser?(async()=>{
  const base=document.documentElement.lang==='en'?'en':'ru';
  const url=new URL(location.href);
  const paymentHint=['/pay','/pay/','/pay/index.html'].includes(url.pathname)
    ? /^#lang=([a-z]{2})$/.exec(url.hash)?.[1] : undefined;
  const requested=paymentHint??url.searchParams.get('lang');
  const preference=stored();
  selected=codes.has(requested)?requested:(codes.has(preference)?preference:base);
  const ready=()=>document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();
  try { dictionary=await load(selected); }
  catch { selected=base;dictionary={}; }
  await ready();
  instance=globalThis.TikTeamLocalization.create(document,{code:selected,languages,dictionary,sourceLanguage:base,aliases:base==='en'?aliases:undefined,translateImageAlt:true,load});
  await instance.start();
  save(selected);picker();accountLinks();heroHeading();
    // Existing EN/RU footer links remain explicit choices, not an accidental language reset.
    for(const link of document.querySelectorAll('a[hreflang]')){
      const code=link.getAttribute('hreflang');if(!codes.has(code))continue;
      const url=new URL(link.href);if(url.origin!==location.origin)continue;
      url.searchParams.set('lang',code);link.href=url;link.addEventListener('click',()=>save(code));
    }
})():Promise.resolve();
