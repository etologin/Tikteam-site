// RU/EN strings for account pages. Server messages are never shown as-is: the UI
// translates stable codes and states and treats unknown ones neutrally.

const STRINGS = {
  ru: {
    "mode.mock": "Демо-режим: данные ненастоящие, оплата и письма не выполняются.",
    "mode.real": "",
    "mode.disabled": "",
    "show": "Показать", "hide": "Скрыть",
    "busy": "Подождите…",
    "err.invalid_request": "Сервер не принял запрос. Проверьте поля и попробуйте ещё раз.",
    "err.invalid_credentials": "Неверный email или пароль.",
    "err.session_expired": "Сеанс на сайте завершён. Войдите снова.",
    "err.csrf_invalid": "Защита страницы обновилась. Нажмите кнопку ещё раз.",
    "err.csrf_missing": "Страница ещё не готова. Обновите её и попробуйте снова.",
    "err.origin_denied": "Этому сайту закрыт доступ к серверу аккаунтов.",
    "err.https_required": "Этому сайту закрыт доступ к серверу аккаунтов.",
    "err.forbidden": "Доступ запрещён.",
    "err.password_invalid": "Пароль должен быть от 8 до 128 символов и отличаться от текущего.",
    "err.current_password_invalid": "Текущий пароль неверен.",
    "err.device_not_found": "Компьютер не найден. Список обновлён.",
    "err.link_invalid": "Ссылка недействительна, истекла или уже использована. Запросите новую в кабинете.",
    "err.billing_unavailable": "Оплата или управление подпиской сейчас недоступны.",
    "err.logout_required": "Сначала выйдите из текущего аккаунта.",
    "err.rate_limited": "Слишком много попыток. Подождите немного и попробуйте снова.",
    "err.rate_limited_for": "Слишком много попыток. Повторите через {seconds} с.",
    "err.service_unavailable": "Сервер аккаунтов временно недоступен. Попробуйте позже.",
    "err.internal_error": "На сервере произошла ошибка. Попробуйте позже.",
    "err.network": "Нет связи с сервером аккаунтов. Проверьте интернет и попробуйте снова.",
    "err.not_found": "Сервер не нашёл этот раздел.",
    "err.conflict": "Действие сейчас невозможно.",
    "err.unexpected": "Неожиданный ответ сервера. Попробуйте позже.",
    "err.email_unconfirmed": "Подтвердите почту. До подтверждения функции TikTeam и оплата недоступны.",
    "err.google_link_required": "Этот email уже зарегистрирован. Войдите с паролем и привяжите Google в кабинете.",
    "err.google_link_conflict": "Этот Google-аккаунт нельзя привязать: он уже связан с другим аккаунтом TikTeam или его адрес отличается от адреса аккаунта.",
    "err.google_flow_expired": "Вход через Google устарел или уже завершён. Начните заново.",
    "load.failed": "Не удалось загрузить.",
    "google.badLink": "Сервер прислал ссылку входа, которую сайт не может открыть безопасно. Ничего не изменилось — сообщите нам.",
    "google.mockStart": "Демо-режим: здесь откроется вход Google ({host}). Переход отключён — завершите вход в демо-панели.",
    "check.email": "Введите email.",
    "check.password": "Введите пароль.",
    "check.length": "Пароль — от 8 до 128 символов.",
    "check.repeat": "Пароли не совпадают.",
    "check.same": "Новый пароль должен отличаться от текущего.",
    "check.current": "Введите текущий пароль.",
    "login.done": "Вы вошли.",
    "register.done": "Если этот адрес ещё не зарегистрирован, аккаунт создан. Подтвердите почту по ссылке из письма и войдите.",
    "forgot.done": "Если аккаунт с этим адресом есть, мы отправили ссылку для нового пароля. Она действует 15 минут.",
    "logout.done": "Вы вышли с сайта. Программа и эфир продолжают работать.",
    "password.confirm": "Сменить пароль? Завершатся все сеансы — на сайте и в программе, идущий эфир прервётся.",
    "password.done": "Пароль изменён. Все сеансы завершены — войдите снова.",
    "logoutAll.confirm": "Выйти везде? Завершатся все сеансы — на сайте и в программе, идущий эфир прервётся.",
    "logoutAll.done": "Вы вышли на всех устройствах. Программа тоже попросит войти заново.",
    "email.confirmed": "Почта подтверждена",
    "email.unconfirmed": "Почта не подтверждена",
    "email.sent": "Если адрес ещё не подтверждён, письмо со ссылкой отправлено. Она действует 30 минут.",
    "status.updated": "Статус обновлён.",
    "recovery.newPassword": "Прислать ссылку для нового пароля",
    "recovery.firstPassword": "Прислать ссылку, чтобы задать пароль",
    "recovery.sent": "Мы отправили ссылку на {email}. Она действует 15 минут. Новый пароль завершит все сеансы — на сайте и в программе.",
    "module.activeUntil": "Активен до {date}",
    "module.active": "Активен",
    "module.inactive": "Не подключён",
    "pack.included": "Входит в подписку Avatar Overlay",
    "pack.includedNoSub": "Входит в подписку Avatar Overlay · подписки нет",
    "pack.ownedPlaying": "Куплен",
    "pack.ownedNeedsSub": "Куплен · для воспроизведения нужна подписка Avatar Overlay",
    "pack.none": "Не куплен",
    "pack.empty": "Паков пока нет.",
    "pack.standard": "Стандартный пак",
    "devices.limit": "Подключено {count} из {limit}.",
    "devices.empty": "Компьютеров пока нет. Войдите в программу TikTeam на компьютере, чтобы он появился здесь.",
    "devices.added": "Добавлен {date}",
    "devices.online": "Программа в сети",
    "devices.offline": "Сеанса нет",
    "devices.remove": "Удалить",
    "devices.confirm": "Удалить компьютер",
    "devices.cancel": "Отмена",
    "devices.password": "Текущий пароль",
    "devices.warning": "Программа на этом компьютере выйдет из аккаунта. Подписка и покупки останутся.",
    "devices.done": "Компьютер удалён.",
    "billing.until": "Оплачено до {date}.",
    "billing.stops": "Подписка закончится {date}.",
    "billing.none": "",
    "billing.badLink": "Сервер прислал ссылку, которую сайт не может открыть безопасно. Ничего не оплачено — сообщите нам.",
    "billing.mockCheckout": "Демо-режим: здесь откроется страница оплаты ({host}). Переход отключён.",
    "billing.mockPortal": "Демо-режим: здесь откроется кабинет подписки Paddle. Переход отключён.",
    "billing.unknownOutcome": "Связь прервалась. Не нажимайте оплату повторно — сначала нажмите «Проверить оплату».",
    "billing.checked": "Состояние оплаты обновлено.",
    "state.disabled": "Оплата отключена",
    "state.none": "Подписки нет",
    "state.ready": "Можно оформить",
    "state.creating": "Готовим оплату",
    "state.unknown": "Состояние уточняется",
    "state.processing": "Платёж обрабатывается",
    "state.active": "Подписка активна",
    "state.canceled": "Подписка отменена",
    "state.past_due": "Оплата просрочена",
    "state.paused": "Подписка приостановлена",
    "state.refunded": "Платёж возвращён",
    "state.payment_review": "Платёж на проверке",
    "state.verification_expired": "Проверка оплаты истекла",
    "state.awaiting_payment": "Ждём оплату",
    "state.expired": "Подписка закончилась",
    "state.other": "Состояние уточняется",
    "recovery.missing": "",
    "recovery.confirmDone.title": "Почта подтверждена",
    "recovery.confirmDone.text": "Спасибо! Адрес подтверждён. Войдите в кабинет или в программу.",
    "recovery.resetDone.title": "Пароль изменён",
    "recovery.resetDone.text": "Все сеансы завершены — на сайте и в программе. Войдите с новым паролем.",
  },
  en: {
    "mode.mock": "Demo mode: data is fake, no payments or emails are made.",
    "mode.real": "",
    "mode.disabled": "",
    "show": "Show", "hide": "Hide",
    "busy": "Please wait…",
    "err.invalid_request": "The server rejected the request. Check the fields and try again.",
    "err.invalid_credentials": "Wrong email or password.",
    "err.session_expired": "Your session on the website has ended. Please sign in again.",
    "err.csrf_invalid": "Page protection was refreshed. Press the button again.",
    "err.csrf_missing": "The page is not ready yet. Reload it and try again.",
    "err.origin_denied": "This website is not allowed to reach the account server.",
    "err.https_required": "This website is not allowed to reach the account server.",
    "err.forbidden": "Access denied.",
    "err.password_invalid": "The password must be 8–128 characters and differ from the current one.",
    "err.current_password_invalid": "The current password is wrong.",
    "err.device_not_found": "Computer not found. The list has been refreshed.",
    "err.link_invalid": "This link is invalid, expired or already used. Request a new one from your account.",
    "err.billing_unavailable": "Payments or subscription management are unavailable right now.",
    "err.logout_required": "Sign out of the current account first.",
    "err.rate_limited": "Too many attempts. Wait a little and try again.",
    "err.rate_limited_for": "Too many attempts. Try again in {seconds} s.",
    "err.service_unavailable": "The account server is temporarily unavailable. Please try later.",
    "err.internal_error": "Something went wrong on the server. Please try later.",
    "err.network": "No connection to the account server. Check your internet and try again.",
    "err.not_found": "The server could not find this section.",
    "err.conflict": "This action is not possible right now.",
    "err.unexpected": "Unexpected server response. Please try later.",
    "err.email_unconfirmed": "Confirm your email. Until then TikTeam features and payments are unavailable.",
    "err.google_link_required": "This email is already registered. Sign in with your password and link Google in your account.",
    "err.google_link_conflict": "This Google account cannot be linked: it is already linked to another TikTeam account or its address differs from your account's.",
    "err.google_flow_expired": "The Google sign-in expired or was already completed. Please start again.",
    "load.failed": "Could not load.",
    "google.badLink": "The server sent a sign-in link the website cannot open safely. Nothing has changed — please let us know.",
    "google.mockStart": "Demo mode: Google sign-in would open here ({host}). Navigation is off — finish the sign-in in the demo panel.",
    "check.email": "Enter your email.",
    "check.password": "Enter your password.",
    "check.length": "The password must be 8–128 characters.",
    "check.repeat": "The passwords do not match.",
    "check.same": "The new password must differ from the current one.",
    "check.current": "Enter your current password.",
    "login.done": "You are signed in.",
    "register.done": "If this address was not registered yet, the account has been created. Confirm your email from the link we sent, then sign in.",
    "forgot.done": "If an account with this address exists, we have sent a link to set a new password. It is valid for 15 minutes.",
    "logout.done": "You have signed out of the website. The app and your stream keep running.",
    "password.confirm": "Change your password? Every session ends — on the website and in the app, and a running stream will stop.",
    "password.done": "Password changed. All sessions have ended — please sign in again.",
    "logoutAll.confirm": "Sign out everywhere? Every session ends — on the website and in the app, and a running stream will stop.",
    "logoutAll.done": "You have signed out on every device. The app will ask you to sign in again too.",
    "email.confirmed": "Email confirmed",
    "email.unconfirmed": "Email not confirmed",
    "email.sent": "If your address is not confirmed yet, we have sent a link. It is valid for 30 minutes.",
    "status.updated": "Status updated.",
    "recovery.newPassword": "Email me a link for a new password",
    "recovery.firstPassword": "Email me a link to set a password",
    "recovery.sent": "We have sent a link to {email}. It is valid for 15 minutes. A new password ends every session — on the website and in the app.",
    "module.activeUntil": "Active until {date}",
    "module.active": "Active",
    "module.inactive": "Not active",
    "pack.included": "Included with Avatar Overlay",
    "pack.includedNoSub": "Included with Avatar Overlay · no subscription",
    "pack.ownedPlaying": "Purchased",
    "pack.ownedNeedsSub": "Purchased · plays with an Avatar Overlay subscription",
    "pack.none": "Not purchased",
    "pack.empty": "No packs yet.",
    "pack.standard": "Standard pack",
    "devices.limit": "{count} of {limit} connected.",
    "devices.empty": "No computers yet. Sign in to the TikTeam app on a computer to see it here.",
    "devices.added": "Added {date}",
    "devices.online": "App online",
    "devices.offline": "No session",
    "devices.remove": "Remove",
    "devices.confirm": "Remove computer",
    "devices.cancel": "Cancel",
    "devices.password": "Current password",
    "devices.warning": "The app on this computer will be signed out. Your subscription and purchases stay.",
    "devices.done": "Computer removed.",
    "billing.until": "Paid until {date}.",
    "billing.stops": "The subscription ends on {date}.",
    "billing.none": "",
    "billing.badLink": "The server sent a link the website cannot open safely. Nothing was charged — please let us know.",
    "billing.mockCheckout": "Demo mode: the payment page would open here ({host}). Navigation is off.",
    "billing.mockPortal": "Demo mode: the Paddle subscription portal would open here. Navigation is off.",
    "billing.unknownOutcome": "The connection dropped. Do not pay again — press “Check payment” first.",
    "billing.checked": "Payment status updated.",
    "state.disabled": "Payments are off",
    "state.none": "No subscription",
    "state.ready": "Ready to subscribe",
    "state.creating": "Preparing payment",
    "state.unknown": "Checking status",
    "state.processing": "Payment processing",
    "state.active": "Subscription active",
    "state.canceled": "Subscription cancelled",
    "state.past_due": "Payment overdue",
    "state.paused": "Subscription paused",
    "state.refunded": "Payment refunded",
    "state.payment_review": "Payment under review",
    "state.verification_expired": "Payment check expired",
    "state.awaiting_payment": "Awaiting payment",
    "state.expired": "Subscription ended",
    "state.other": "Checking status",
    "recovery.missing": "",
    "recovery.confirmDone.title": "Email confirmed",
    "recovery.confirmDone.text": "Thank you! Your address is confirmed. Sign in to your account or the app.",
    "recovery.resetDone.title": "Password changed",
    "recovery.resetDone.text": "All sessions have ended — on the website and in the app. Sign in with your new password.",
  },
};

const MODULE_NAMES = {
  "sor4": "Streets of Rage 4",
  "dead-as-disco": "Dead as Disco",
  "avatar-overlay": "Avatar Overlay",
  "kaspi-app": "TikDonate", // Display name only: the id stays kaspi-app.
  "tiktok-overlay": "Battle Overlay", // Display name only: the id stays tiktok-overlay.
};

const STATES_ON = new Set(["active"]);
const STATES_WARN = new Set(["past_due", "paused", "payment_review", "verification_expired", "awaiting_payment", "processing", "creating", "refunded"]);

export function pageLang() {
  const value = typeof document !== "undefined" ? document.documentElement.lang : "ru";
  return value === "en" ? "en" : "ru";
}

export function t(key, values = {}, lang = pageLang()) {
  const text = STRINGS[lang][key] ?? STRINGS.ru[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}

export function errorText(error, lang = pageLang()) {
  const code = error && typeof error.code === "string" ? error.code : "unexpected";
  if (code === "rate_limited" && Number.isFinite(error.retryAfter) && error.retryAfter > 0)
    return t("err.rate_limited_for", { seconds: error.retryAfter }, lang);
  const key = "err." + code;
  return key in STRINGS[lang] ? t(key, {}, lang) : t("err.unexpected", {}, lang);
}

export function billingState(state, lang = pageLang()) {
  const known = typeof state === "string" && ("state." + state) in STRINGS[lang];
  return {
    text: t(known ? "state." + state : "state.other", {}, lang),
    tone: STATES_ON.has(state) ? "on" : STATES_WARN.has(state) ? "warn" : "",
  };
}

export function moduleName(module) {
  if (module && MODULE_NAMES[module.id]) return MODULE_NAMES[module.id];
  return module && typeof module.name === "string" && module.name ? module.name : String(module?.id ?? "");
}

export function packName(pack, lang = pageLang()) {
  if (pack?.id === "standard") return t("pack.standard", {}, lang);
  return String(pack?.id ?? "");
}

/** UTC ISO date from the server, shown in the visitor's own time zone. Empty for null or garbage. */
export function formatDate(value, lang = pageLang()) {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
