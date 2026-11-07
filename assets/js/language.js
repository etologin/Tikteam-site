import { languages } from './languages.js';
import { aliases } from './language-aliases.js';

const codes=new Set(languages.map(x=>x.code));
const storageKey='tikteam.ui.language';
let selected='ru', dictionary={}, instance=null, choiceVersion=0;
const browser=typeof document!=='undefined';
const assets=new URL('../',import.meta.url);
function stored(){try{return localStorage.getItem(storageKey);}catch{return null;}}
function save(code){try{localStorage.setItem(storageKey,code);}catch{/* Private browsing can refuse storage. */}}
export function pageLanguage(){return browser?selected:'ru';}
export function translateCopy(source,code=selected){return code===selected&&code!=='ru'?(dictionary[source]??source):source;}
function route(code) {
  const url=new URL(location.href);
  // Preserve tokens in the fragment and unrelated query fields on recovery/account pages.
  const withoutEnglish=url.pathname.replace(/^\/en(?=\/|$)/,'')||'/';
  url.pathname=code==='en'?'/en'+withoutEnglish:withoutEnglish;
  url.searchParams.set('lang',code);return url;
}
function script(url){return new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=url;tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});}
async function load(code){
  if(code==='ru')return {};
  if(!globalThis.TikTeamSiteDictionaries?.[code])await script(new URL('i18n/'+code+'.js',assets));
  return globalThis.TikTeamSiteDictionaries?.[code]??{};
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
    try{
      const words=await load(next);if(version!==choiceVersion)return;
      selected=next;dictionary=words;save(next);
      image.src=new URL('i18n/flags/'+languages.find(x=>x.code===next).country+'.png',assets);
      const url=new URL(location.href);url.searchParams.set('lang',next);history.replaceState(null,'',url);
      await instance.select(next,words);
    }catch{select.value=selected;}finally{select.disabled=false;}
  });
  wrapper.append(image,select);old.replaceWith(wrapper);
}
export const localizationReady=browser?(async()=>{
  const base=document.documentElement.lang==='en'?'en':'ru';
  const requested=new URL(location.href).searchParams.get('lang');
  selected=codes.has(requested)?requested:(codes.has(stored())?stored():base);
  save(selected);
  const ready=()=>document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();
  try {
    dictionary=await load(selected);
    await ready();
    picker();
    instance=globalThis.TikTeamLocalization.create(document,{code:selected,languages,dictionary,aliases:base==='en'?aliases:undefined,load});
    await instance.start();
    // Existing EN/RU footer links remain explicit choices, not an accidental language reset.
    for(const link of document.querySelectorAll('a[hreflang]')){
      const code=link.getAttribute('hreflang');if(!codes.has(code))continue;
      const url=new URL(link.href);if(url.origin!==location.origin)continue;
      url.searchParams.set('lang',code);link.href=url;link.addEventListener('click',()=>save(code));
    }
  } catch {await ready();picker();/* A failed local asset keeps the original usable page. */}
})():Promise.resolve();
