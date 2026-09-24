# Baixar áudio do Drive

Extensão para Chrome/Edge/Brave que baixa **só o áudio** de vídeos do Google Drive
que você já consegue assistir logado. O resultado é um `.m4a` com o nome do vídeo.

## Como funciona

O player do Drive carrega o áudio e o vídeo em requisições separadas (`videoplayback`
com `mime=audio/mp4`). A extensão observa essas requisições, guarda a de áudio,
remove os parâmetros que pedem só um pedaço (`range`, `rn`, `rbuf`, `ump`, `srfvp`)
e baixa o arquivo completo com `chrome.downloads`, usando a sessão logada do navegador.
Não há servidor nem conversão: o áudio já vem pronto do Google.

Por que extensão e não página web: uma página num site próprio não enxerga a sessão
do Google do usuário (CORS) e teria que baixar e converter o vídeo inteiro.

## Instalar (modo desenvolvedor)

1. Baixe a última versão: [baixar-audio-drive.zip](https://github.com/burguela/baixar-audio-drive/releases/latest/download/baixar-audio-drive.zip)
   e descompacte numa pasta.
2. Abra `chrome://extensions` e ligue **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha essa pasta (a que tem o `manifest.json`).

Para distribuir sem modo desenvolvedor, publique o zip de `npm run empacotar`
na Chrome Web Store como "Não listada".

## Usar

1. Logado, abra o vídeo no Google Drive e dê play por alguns segundos.
2. O ícone da extensão mostra ♪. Clique nele e em **Baixar áudio**.

Em "Mais opções" há **Copiar link** e outras qualidades, quando o player carrega mais de uma.

## Estrutura

```
extensao/            código da extensão (Manifest V3)
  manifest.json
  background.js      captura as requisições de áudio por aba
  streams.js         funções puras: filtra a URL, limpa parâmetros, nome do arquivo
  popup.html/.js     janela do ícone com o botão de download
  icons/
tests/
  streams.test.mjs   testes unitários (node:test)
  e2e.test.mjs       Chromium real com a extensão + Drive simulado
scripts/empacotar.sh gera dist/baixar-audio-drive-<versão>.zip
```

## Desenvolvimento

```sh
npm install
npx playwright install chromium   # só para o teste e2e
npm test                          # unitários
npm run test:e2e                  # ponta a ponta
npm run empacotar                 # zip para a Chrome Web Store
```

A CI (`.github/workflows/ci.yml`) roda os dois testes a cada push.

### Publicar uma versão

1. Atualize `version` em `extensao/manifest.json` e faça commit.
2. Crie e envie a tag com o mesmo número: `git tag v1.0.1 && git push origin v1.0.1`.

O workflow `release.yml` roda os testes, gera o zip e cria a release no GitHub.
O link "última versão" do README passa a apontar para ela automaticamente.

## Limitações

- Só navegadores Chromium no computador; não funciona no celular.
- É preciso dar play antes, porque o link do áudio só aparece quando o player começa a carregar.
- O link capturado expira depois de algumas horas; se falhar, recarregue a página e dê play de novo.
- Se o Google mudar o player (por exemplo, passar a usar só POST/UMP), a captura precisa de ajuste.
