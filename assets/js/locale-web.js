/* Offline UI dictionaries only. This code never sends page text, input values or viewer data anywhere. */
(function(root) {
  'use strict';
  const USER_CONTENT = 'script,style,textarea,input,code,pre,[data-no-i18n],[data-user-content],.tw-msg,.tw-nick,.lb-nick,.lu-nick,.tr-nick,.mv-name,.pk-name,.ac-nick,.tw-plate-nick,.gb-name,.tw-gift-name,.gift-name,.viewer-name';
  const ATTRIBUTES = ['title','placeholder','aria-label','data-empty','alt'];
  function create(doc, options) {
    const sources = new WeakMap(), attributes = new WeakMap(), nodes = new Set();
    let dictionary = {}, code = 'ru', generation = 0, observer = null;
    function tr(source) {
      if (typeof source !== 'string' || !source) return source;
      const core = source.trim().replace(/\s+/g,' ');
      const canonical=options.aliases?.[core] ?? core;
      const value = code==='ru'?(options.aliases?.[core]):(dictionary[source.trim()] ?? dictionary[canonical]);
      return value === undefined ? source : source.slice(0,source.length-source.trimStart().length) + value + source.slice(source.trimEnd().length);
    }
    function protectedNode(element) { return !element || element.closest(USER_CONTENT); }
    function remember(node) { nodes.add(new WeakRef(node)); if(nodes.size>4000) for(const ref of nodes) if(!ref.deref()?.isConnected) nodes.delete(ref); }
    function text(node) {
      if(protectedNode(node.parentElement)) return;
      let state=sources.get(node);
      if(!state) { state={source:node.nodeValue,shown:node.nodeValue};sources.set(node,state);remember(node); }
      else if(node.nodeValue!==state.shown) state.source=node.nodeValue;
      const translated=tr(state.source);state.shown=translated;
      // An option without value would otherwise change its saved value when its label is translated.
      if(node.parentElement.tagName==='OPTION' && !node.parentElement.hasAttribute('value')) node.parentElement.value=node.parentElement.textContent;
      if(node.nodeValue!==translated) node.nodeValue=translated;
    }
    function attribute(element,name) {
      if(element.closest('[data-no-i18n],[data-user-content]')) return;
      const value=element.getAttribute(name);if(value===null)return;
      let map=attributes.get(element);if(!map){map={};attributes.set(element,map);remember(element);}
      let state=map[name];if(!state)state=map[name]={source:value,shown:value};else if(value!==state.shown)state.source=value;
      state.shown=tr(state.source);if(value!==state.shown)element.setAttribute(name,state.shown);
    }
    function visit(node) {
      if(node.nodeType===3){text(node);return;}
      if(node.nodeType!==1||node.closest('[data-no-i18n],[data-user-content],script,style'))return;
      for(const name of ATTRIBUTES) attribute(node,name);
      for(const child of [...node.childNodes])visit(child);
    }
    async function select(language, supplied) {
      const id=++generation;
      const found=options.languages.find(x=>x.code===language);if(!found)return false;
      let next={};
      if(language!=='ru') {
        try { next=supplied ?? await options.load(language); }
        catch { return false; }
      }
      if(id!==generation)return false;
      dictionary=next;code=language;
      doc.documentElement.lang=code;
      // Keep scene coordinates and video transforms unchanged. Direction applies only to UI documents.
      if(options.direction!==false)doc.documentElement.dir=found.rtl?'rtl':'ltr';
      visit(doc.documentElement);
      for(const ref of nodes){const node=ref.deref();if(!node?.isConnected){nodes.delete(ref);continue;}if(node.nodeType===3)text(node);else for(const name of ATTRIBUTES)attribute(node,name);}
      doc.dispatchEvent(new CustomEvent('tikteam-language-changed',{detail:code}));
      return true;
    }
    function start() {
      observer=new MutationObserver(changes=>{
        for(const change of changes) {
          if(change.type==='characterData')text(change.target);
          else if(change.type==='attributes')attribute(change.target,change.attributeName);
          else for(const node of change.addedNodes)visit(node);
        }
      });
      observer.observe(doc.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRIBUTES});
      return select(options.code||'ru',options.dictionary);
    }
    return {start,select,tr,get code(){return code;},dispose(){observer?.disconnect();nodes.clear();generation++;}};
  }
  root.TikTeamLocalization={create};
  if(typeof module!=='undefined'&&module.exports)module.exports={create};
  if(root.__TTLocaleBoot && root.document) {
    const boot=root.__TTLocaleBoot;
    const instance=create(root.document,{...boot,direction:!location.pathname.startsWith('/widgets/'),load:async code=>{
      const response=await fetch('/ui-localization/'+encodeURIComponent(code)+'.json');if(!response.ok)throw Error('locale unavailable');return response.json();
    }});
    root.TikTeamLocale=instance;
    const start=()=>instance.start();
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
    root.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='tikteam-ui-language')instance.select(e.data.code);});
  }
})(globalThis);
