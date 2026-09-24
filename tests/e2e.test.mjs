// Teste de ponta a ponta: carrega a extensão num Chromium e simula uma página do
// Drive cujo player pede pedaços de vídeo e de áudio. Confere que a extensão
// captura o áudio e baixa o arquivo inteiro usando os cookies da sessão.
import { test } from "node:test";
import assert from "node:assert/strict";
import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(AQUI, "../extensao");
const TAMANHO = 3_500_000;
const HOST_PLAYER = "r1---sn-test.c.drive.google.com";

function servidorFalso() {
  const pedidos = [];
  const audio = Buffer.alloc(TAMANHO, 7);
  // O Chromium força HTTPS em google.com (HSTS), então o servidor falso usa um
  // certificado autoassinado só de teste.
  const cert = { key: fs.readFileSync(path.join(AQUI, "cert-teste.key")), cert: fs.readFileSync(path.join(AQUI, "cert-teste.pem")) };
  const server = https.createServer(cert, (req, res) => {
    const u = new URL(req.url, "https://" + req.headers.host);
    if (u.pathname.startsWith("/file/")) {
      res.setHeader("content-type", "text/html; charset=utf-8");
      return res.end(`<title>Webinario TUBERCULOSE.mp4 - Google Drive</title><script>
        const base = "https://${HOST_PLAYER}/videoplayback?id=abc&sig=xyz";
        fetch(base + "&itag=137&mime=video%2Fmp4&clen=99999999&range=0-999&rn=1", { mode: "no-cors" });
        fetch(base + "&itag=140&mime=audio%2Fmp4&clen=${TAMANHO}&range=0-999&rn=2&rbuf=0", { mode: "no-cors" });
      </script>`);
    }
    if (u.pathname === "/videoplayback") {
      pedidos.push({ busca: u.search, cookie: req.headers.cookie || "" });
      const r = u.searchParams.get("range");
      let corpo = audio;
      if (r) {
        const [a, b] = r.split("-").map(Number);
        corpo = audio.subarray(a, b + 1);
      }
      res.setHeader("content-type", "audio/mp4");
      return res.end(corpo);
    }
    res.statusCode = 404;
    res.end();
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ server, pedidos, porta: server.address().port })));
}

test("captura o áudio do player e baixa o arquivo completo", async () => {
  const { server, pedidos, porta } = await servidorFalso();
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "perfil-"));
  const ctx = await chromium.launchPersistentContext(perfil, {
    headless: false,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    args: [
      "--headless=new",
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      `--host-resolver-rules=MAP drive.google.com 127.0.0.1:${porta}, MAP ${HOST_PLAYER} 127.0.0.1:${porta}`,
      "--no-proxy-server",
      "--ignore-certificate-errors",
    ],
  });
  try {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent("serviceworker");
    const extId = sw.url().split("/")[2];

    await ctx.addCookies([{ name: "DRIVE_STREAM", value: "sessao123", domain: ".drive.google.com", path: "/" }]);
    const pagina = await ctx.newPage();
    await pagina.goto("https://drive.google.com/file/d/1mkz/view");
    await pagina.waitForTimeout(1500);

    const tabId = await sw.evaluate(async () => (await chrome.tabs.query({ url: "*://drive.google.com/*" }))[0].id);
    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html?tab=${tabId}`);
    await popup.waitForSelector("#baixar");
    assert.match(await popup.innerText("#conteudo"), /Webinario TUBERCULOSE\.m4a/);

    await popup.click("#baixar");
    await popup.waitForTimeout(2000);
    const downloads = await sw.evaluate(() => chrome.downloads.search({}));
    assert.equal(downloads.length, 1);
    assert.equal(downloads[0].state, "complete");
    assert.equal(downloads[0].bytesReceived, TAMANHO);

    const completo = pedidos.find((p) => !p.busca.includes("range="));
    assert.ok(completo, "a extensão deveria pedir o áudio sem range");
    assert.match(completo.cookie, /DRIVE_STREAM=sessao123/);
  } finally {
    await ctx.close();
    server.close();
  }
});
