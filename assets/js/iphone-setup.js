(() => {
  const code = window.location.hash.slice(1);
  if (/^ttsp1\.[0-9a-f]{64}\.[0-9a-f]{64}$/.test(code)) {
    window.location.replace("https://api.tikteam.live/api/tikdonate/shortcuts/v1/setup#" + code);
  }
})();
