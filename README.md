# Viewport / Modular Pages Preview Lab

Эксперимент: несколько PR-превью React-приложения на одном GitHub Pages без копирования общего ядра.

- Vite 8 + TypeScript + React + Module Federation.
- Настоящие компоненты Park UI (Button, Badge, Table), Panda CSS 2.
- Desktop 1280px, tablet 768px, mobile 390px: меняется ширина iframe, поэтому media queries используют его настоящий viewport.
- Приложение работает без API: таблица, списки, фильтры, добавление задач, checkbox, экспорт JSON. Изменения живут в памяти вкладки.
- Детерминированная PNG 1280×960, 3 687 983 байта. Это намеренно несжатая тестовая картинка, созданная scripts/make-png.mjs для демонстрации хранения тяжелого общего ресурса.

## Ссылки

- [Main preview](https://energizer91.github.io/pages-modular-preview-lab/)
- [Storage report](https://energizer91.github.io/pages-modular-preview-lab/report.json)
- PR: https://energizer91.github.io/pages-modular-preview-lab/pr/NUMBER/

## Что публикуется

```text
gh-pages/
  cores/<content-hash>/  общий runtime, React, Park UI, стили, PNG
  index.html            маленькая HTML-оболочка main
  manifest.json         точная версия core и remote main
  remote/               модуль main
  pr/123/
    index.html          маленькая HTML-оболочка PR
    manifest.json       точная версия core и remote PR
    remote/             только remote PR, без PNG и копий React/UI
  report.json           измеренный размер сайта и оценка полных копий
```

Оболочка открывает frame.html из выбранного ядра. Host внутри iframe предоставляет shared-зависимости и загружает preview/App из PR. Remote использует import:false для React, JSX runtime, react-dom/client и @lab/ui. Shared UI — default-export с Button, Badge, Table и URL общей PNG; реестр экспортов не нужно копировать в remote.

Core получает ID по содержимому всех его файлов. Одинаковые сборки ядра используют одну директорию. При изменении ядра создается новая версия, старые PR остаются закреплены за прежней. Это не автоматический git-diff: каждый PR содержит код всего небольшого приложения, но без общего ядра.

## Локальный запуск

```sh
npm ci
npm run dev
# http://127.0.0.1:4173
```

Это preview настоящей статической production-сборки. После изменения исходников перезапустите npm run dev. Статический сервер поддерживает PORT.

## Проверки

```sh
npm run build
npm test
npm run test:browser
```

Браузерный тест требует запущенного локального preview. На Windows использует установленный Edge; на других системах установите Chromium через npx playwright install chromium. TEST_URL позволяет проверить опубликованный Pages, BROWSER_CHANNEL — выбрать браузер.

Тест проверяет фактическую ширину iframe и media query для трех режимов, добавление задачи, фильтр и уведомление. Тест публикации проверяет переиспользование одного ядра тремя превью и удаление одного PR без повреждения другого. Build проверяет отсутствие PNG в remote и бюджет remote 250 KiB.

## GitHub Actions

Workflow собирает main и PR из этого репозитория. Build получает только contents:read, не сохраняет git credentials. Publisher берет скрипт из main, проверяет актуальный SHA PR, объединяет снимок с gh-pages, публикует полный сайт официальными upload-pages-artifact/deploy-pages.

При закрытии PR его папка удаляется. Перед публикацией и раз в сутки выполняется сверка с открытыми PR. Неиспользуемые ядра удаляются после 24h по сохраняемому времени первого отсутствия ссылок (core-gc.json). Перед загрузкой проверяется бюджет 800 MiB. Краткий отчет выводится в Actions Summary, подробный — report.json.

Пример рассчитан на доверенные PR внутри репозитория; PR из форков пропускаются. Для внешних контрибьюторов требуется отдельный workflow_run publisher с проверкой происхождения артефактов. Глобальная concurrency сериализует демонстрационные публикации; GitHub может заменять ожидающий запуск при всплеске событий, поэтому для большого потока нужна очередь/периодическое восстановление пропущенных сборок.

## Ограничения эксперимента

Лимит одного Pages-сайта остается 1 GB. Уникальные remote продолжают накапливаться. Здесь также повторяется небольшой Federation-runtime в remote; React, Park UI и PNG в них не повторяются. Изменения CSS, shared API или зависимостей могут создать новое ядро. Изменения только данных списка должны сохранить тот же core ID.

Actions artifacts — передача сборки, а не источник runtime-файлов. Все исполняемые файлы обслуживаются самим GitHub Pages. Приватность исходников не меняет поведение сборки, но Pages из приватного репозитория требует подходящего тарифа. Этот учебный репозиторий публичный по согласованию с владельцем.

## Источники

- https://module-federation.io/integrations/build-tool/vite
- https://github.com/module-federation/vite#host-only-shared-dependencies
- https://park-ui.com/docs/installation
- https://panda-css.com/docs/get-started/upgrading-to-v2
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
