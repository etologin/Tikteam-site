import { languages } from '../assets/js/languages.js';

(() => {
  'use strict';
  const status = document.getElementById('checkout-status');
  if (!status || document.documentElement.dataset.tikteamCheckout) return;
  document.documentElement.dataset.tikteamCheckout = 'started';
  const tell = text => { status.textContent = text; };
  const token = window.TikTeamPaddleToken;
  const url = new URL(window.location.href);
  const values = url.searchParams.getAll('_ptxn');
  const codes = new Set(languages.map(language => language.code));
  const requested = /^#lang=([a-z]{2})$/.exec(url.hash)?.[1];
  const allowedFragment = codes.has(requested);
  if (window.top !== window.self || url.origin !== 'https://tikteam.live'
      || !['/pay', '/pay/', '/pay/index.html'].includes(url.pathname) || (url.hash && !allowedFragment)) {
    tell('Откройте оплату из личного кабинета TikTeam.');
    return;
  }
  if (values.length === 0 && url.search === '') return;
  if (values.length !== 1 || !/^txn_[a-z0-9]{26}$/.test(values[0])
      || [...url.searchParams.keys()].some(key => key !== '_ptxn')
      || typeof token !== 'string' || !/^live_[A-Za-z0-9_-]{16,160}$/.test(token)) {
    tell('Ссылка оплаты неполная. Откройте существующую покупку в личном кабинете.');
    return;
  }
  let stored;
  try { stored = localStorage.getItem('tikteam.ui.language'); } catch { /* Storage is optional. */ }
  const language = allowedFragment ? requested : codes.has(stored) ? stored : 'ru';
  const paddleLanguages = new Set(['ar', 'da', 'de', 'en', 'es', 'fr', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'sv', 'tr']);
  tell('Открываем защищённую форму Paddle…');
  let initialized = false;
  let settled = false;
  const sdk = document.createElement('script');
  sdk.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
  sdk.async = true;
  sdk.onerror = () => { settled = true; tell('Не удалось загрузить форму Paddle. Проверьте соединение и откройте эту ссылку снова.'); };
  sdk.onload = () => {
    if (initialized || settled) return;
    settled = true;
    try {
      if (!window.Paddle || typeof window.Paddle.Initialize !== 'function') throw new Error();
      initialized = true;
      // Paddle opens the existing _ptxn after initialization. Never pass items,
      // a customer email, account session, API key or browser-provided prices.
      window.Paddle.Initialize({
        token,
        checkout: { settings: { displayMode: 'overlay', theme: 'dark', locale: paddleLanguages.has(language) ? language : 'en' } },
        eventCallback: event => {
          switch (event?.name) {
            case 'checkout.loaded': tell('Проверьте сумму и условия в форме Paddle.'); break;
            case 'checkout.completed': tell('Платёж отправлен на проверку. Статус подписки появится в личном кабинете после подтверждения сервером.'); break;
            case 'checkout.closed': tell('Окно Paddle закрыто. Проверьте состояние покупки в личном кабинете перед повторной оплатой.'); break;
            case 'checkout.error': tell('Не удалось завершить оплату. Проверьте состояние существующей покупки в личном кабинете.'); break;
          }
        }
      });
    } catch {
      tell('Не удалось открыть форму Paddle. Проверьте состояние существующей покупки в личном кабинете.');
    }
  };
  document.head.appendChild(sdk);
  window.setTimeout(() => {
    if (!settled) { settled = true; tell('Форма Paddle не загрузилась. Проверьте соединение и откройте эту ссылку снова.'); }
  }, 15000);
})();
