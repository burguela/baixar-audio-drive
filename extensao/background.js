// Observa as requisições do player do Drive e guarda, por aba, as URLs dos
// streams de áudio (as mesmas que aparecem no DevTools como "videoplayback").

import { lerStream } from "./streams.js";

function chave(tabId) {
  return "tab:" + tabId;
}

async function guardar(tabId, stream) {
  const k = chave(tabId);
  const atual = (await chrome.storage.session.get(k))[k] || { streams: {} };
  atual.streams[stream.itag] = { ...stream, vistoEm: Date.now() };
  await chrome.storage.session.set({ [k]: atual });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#1a73e8" });
  chrome.action.setBadgeText({ tabId, text: "♪" });
}

async function limpar(tabId) {
  await chrome.storage.session.remove(chave(tabId));
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
}

chrome.webRequest.onBeforeRequest.addListener(
  (det) => {
    if (det.tabId < 0) return;
    const stream = lerStream(det.url);
    if (stream) guardar(det.tabId, stream);
  },
  { urls: ["*://*.google.com/*", "*://*.googlevideo.com/*", "*://*.googleusercontent.com/*"] }
);

// Trocou de vídeo ou fechou a aba: esquece o que foi capturado.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url) limpar(tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => limpar(tabId));

// Guarda falhas de download para o popup mostrar na próxima vez que abrir.
chrome.downloads.onChanged.addListener(async (delta) => {
  if (!delta.error) return;
  const { downloadsNossos = {} } = await chrome.storage.session.get("downloadsNossos");
  const tabId = downloadsNossos[delta.id];
  if (tabId === undefined) return;
  const k = chave(tabId);
  const atual = (await chrome.storage.session.get(k))[k];
  if (!atual) return;
  atual.erro = delta.error.current;
  await chrome.storage.session.set({ [k]: atual });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#d93025" });
  chrome.action.setBadgeText({ tabId, text: "!" });
});
