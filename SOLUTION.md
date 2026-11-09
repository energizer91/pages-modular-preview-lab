# Модульные PR-превью на GitHub Pages

Документ для агента, которому нужно изучить, воспроизвести или развить эксперимент. Описывает реализованную систему и отдельно — предлагаемые доработки. Проверено по исходникам и опубликованному отчету 9 ноября 2026 года.

## 1. Проблема и цель

У React-приложения есть PR-превью: GitHub Action собирает ветку, а пользователь открывает результат по прямой ссылке. Если в `gh-pages/pr/N/` хранить полный `dist` каждого PR, одинаковые зависимости, UI-компоненты, стили и картинки повторяются. Небольшое изменение списка не означает небольшую сборку.

GitHub Pages ограничивает размер опубликованного сайта 1 GB. Все PR-подкаталоги одного сайта входят в этот размер. Custom Actions workflow снимает мягкое ограничение 10 сборок в час, но не ограничение объема. Источник: [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

Цель эксперимента — уменьшить прирост опубликованного дерева на PR, сохранив:

- один репозиторий и один GitHub Pages сайт;
- независимый URL и содержимое каждого PR;
- полностью статическую работу без бэкенда, внешнего object storage и CDN для модулей;
- минимальные изменения исходников в демонстрационных PR;
- автоматические Deployments и комментарии со ссылкой, которую публикует Action.

Это оптимизация хранения, а не снятие лимита Pages. Обычный code splitting или lazy loading уменьшают загрузку браузера, но не устраняют повторяющиеся файлы на хостинге.

## 2. Реализованный результат

- Репозиторий: [energizer91/pages-modular-preview-lab](https://github.com/energizer91/pages-modular-preview-lab).
- Main: [работающее приложение](https://energizer91.github.io/pages-modular-preview-lab/).
- Измерения: [report.json](https://energizer91.github.io/pages-modular-preview-lab/report.json).
- Локальный checkout автора: `D:\Projects\pages-modular-preview-lab`.
- Базовый коммит реализации перед добавлением этого документа: `ca6a3703aa6ac21dbb0210c7da6893168e54aada`.

Репозиторий изначально создали приватным. GitHub API отказал во включении Pages из-за тарифа аккаунта. По явному разрешению владельца учебный репозиторий перевели в публичный. Для повторения с приватными исходниками предварительно проверьте поддержку Pages тарифом и политику организации. Приватный репозиторий сам по себе не делает опубликованный Pages закрытым.

| Вариант | Что отличается от main | Проверенное содержимое |
| --- | --- | --- |
| Main | Базовое приложение | Один список, три пункта |
| [PR #1](https://github.com/energizer91/pages-modular-preview-lab/pull/1) | Добавлен пункт | Один список, четыре пункта |
| [PR #2](https://github.com/energizer91/pages-modular-preview-lab/pull/2) | Переименован первый пункт | Три пункта, новое название |
| [PR #3](https://github.com/energizer91/pages-modular-preview-lab/pull/3) | Добавлен второй список | Два списка, пять пунктов |

Каждый PR меняет только `src/content.ts`. Прямые preview-ссылки не добавляются вручную в описание PR. Их публикует workflow через Deployment и обновляемый комментарий `github-actions[bot]`.

## 3. Подход: общий host и отдельный remote

Использованы Vite, TypeScript, React, `@module-federation/vite`, Park UI и Panda CSS. Точные версии закреплены в `package.json` и `package-lock.json`; для повторения используйте `npm ci`, а не установку произвольных latest-версий.

Сборка разделена на две части:

1. **Core**: внешняя оболочка, host внутри iframe, React, UI-компоненты, стили и тяжелая PNG.
2. **Remote**: приложение конкретного PR, которое экспортирует `./App` и получает общие зависимости от host.

```text
Страница /pr/123/
  → manifest.json: commit, coreId, remote entry
  → оболочка из cores/<coreId>/assets/
  → iframe cores/<coreId>/frame.html?remote=<URL PR remoteEntry.js>
      → host предоставляет React и @lab/ui
      → Federation загружает preview/App из pr/123/remote/
```

Host Federation находится **внутри iframe**. Нельзя рассчитывать, что shared scope внешнего окна автоматически разделяется с другим документом iframe. Снаружи — обычная TypeScript-оболочка с переключателем размеров.

### Почему iframe

Переключатель задает реальные размеры iframe:

| Режим | Viewport |
| --- | --- |
| Desktop | 1280 × 900 |
| Tablet | 768 × 1024 |
| Mobile | 390 × 844 |

CSS media queries внутри приложения срабатывают по ширине iframe. Одного ограничения ширины внешнего `div` для такого поведения недостаточно. Рамка контейнера не вычитается из целевой ширины: используется `box-sizing: content-box`.

### Как исключены повторные зависимости

В `vite.config.ts` для host и remote объявлены shared-ключи:

```ts
['react', 'react/jsx-runtime', 'react-dom/client', '@lab/ui']
```

У remote для них заданы `singleton: true`, `requiredVersion: false`, `import: false`. Последнее принципиально: `shared` без `import: false` может оставить локальную fallback-копию зависимости в remote. Это улучшит runtime-переиспользование, но не обязательно уменьшит опубликованные файлы.

Host предоставляет `@lab/ui` из `src/core/ui.tsx`. Его default-export содержит `Button`, `Badge`, `Table` и URL общей PNG. Remote использует этот default-export. Такой контракт обошел проблему определения named exports для локального consume-only shared-модуля в выбранной версии плагина.

Не добавляйте обычный Vite alias `@lab/ui → локальный исходник` поверх этой схемы: плагин предупреждает, что такой alias может обходить Federation. TypeScript paths для проверки типов и Vite runtime resolution — разные механизмы.

`requiredVersion: false` здесь допустим как упрощение эксперимента: core и remote собираются совместно и закрепляются манифестом. Для независимых релизов библиотек нужны явный контракт и проверки совместимости.

### Версии ядра

`scripts/build.mjs` собирает core и remote, сортирует перечень файлов core и вычисляет SHA-256 по их путям и байтам. Первые 16 hex-символов становятся `coreId`.

- Одинаковое содержимое core получает одну директорию.
- Новое содержимое получает новую директорию.
- Старые превью остаются привязаны к старому `coreId`.
- Существующую директорию core нельзя изменять на месте.

Ядро не обязано быть вечным единственным файлом. Его версии неизменяемы. Если поменять CSS, зависимости или общий API, несколько версий могут сосуществовать, и PNG также может повториться между версиями core. Дедупликация отдельных ресурсов между разными core в этом эксперименте не реализована.

Локальный Windows core ID отличался от Linux CI core ID. Побайтная воспроизводимость проверялась внутри одного окружения. Для сравнения PR с main держите одинаковыми runner, Node, lockfile и настройки сборки.

## 4. Карта исходников

| Путь от корня репозитория | Назначение |
| --- | --- |
| `vite.config.ts` | Два target: core и remote, shared-контракт Federation |
| `src/shell.ts` | Загрузка манифеста, размеры iframe, показ размеров сборки |
| `src/core/frame.tsx` | Host, регистрация remote, загрузка `preview/App`, обработка ошибок |
| `src/core/ui.tsx` | Общие Park UI компоненты и URL PNG |
| `src/core/shared-landscape.png` | Общий тяжелый ресурс |
| `src/remote/App.tsx` | Таблица, списки, кнопки, локальные состояния |
| `src/content.ts` | Данные, которые меняют демонстрационные PR |
| `src/components/ui/`, `src/theme/` | Исходники компонентов и темы Park UI |
| `panda.config.ts` | Тема, recipes, presets и генерация стилей |
| `scripts/make-png.mjs` | Детерминированное создание PNG |
| `scripts/build.mjs` | Production builds, core ID, package и размеры |
| `scripts/publish.mjs` | Объединение снимка с сайтом, удаление закрытых PR, GC и report |
| `scripts/verify-run.mjs` | Проверка происхождения сборки и актуальности PR SHA |
| `scripts/deployment.mjs` | Deployment statuses, автоматические PR-комментарии |
| `scripts/verify-served.mjs` | Проверка манифестов с настоящего публичного URL |
| `scripts/reconcile.mjs` | Обслуживание опубликованного дерева без новой сборки |
| `scripts/serve.mjs` | Локальный статический сервер |
| `scripts/browser-test.mjs` | Проверки iframe, media queries и действий пользователя |
| `tests/publication.test.mjs` | Переиспользование core и изолированное удаление превью |
| `.github/workflows/build.yml` | Непривилегированная сборка PR/main |
| `.github/workflows/pages.yml` | Привилегированная публикация из main |

Park UI установлен официальным CLI, его исходники закоммичены. Сам CLI после генерации удален из зависимостей. `styled-system/` генерируется и не коммитится. Учтены особенности Panda CSS 2: явные `preset-base`/`preset-panda`, `createSlotRecipeContext` для таблицы, slot recipe в `slotRecipes`. Windows-пути импорта нормализованы для Linux CI.

PNG — собственный процедурный тестовый ресурс 1280 × 960, 3 687 983 байта. Сжатие намеренно отключено для наглядного эксперимента; это не рекомендация так готовить production-картинки.

## 5. Опубликованное дерево

```text
gh-pages/
  cores/<coreId>/
    index.html
    frame.html
    remoteEntry.js
    assets/                  # React, UI, стили, общая PNG и прочие чанки
  index.html                 # Оболочка main с путями в конкретный core
  manifest.json
  remote/                    # Remote main
  pr/123/
    index.html
    manifest.json
    remote/                  # Remote PR 123
  core-gc.json                # Время первого отсутствия ссылок на старые core
  report.json
  .nojekyll
```

Каждая сборка создает `dist/package/{core,remote,build.json}`. Издатель проверяет core ID и байты существующего core, копирует только нужный снимок remote и формирует маленькую HTML-оболочку. Пути корректируются и для корня сайта, и для вложенного `/pr/N/`.

Это не incremental upload Pages. При каждой публикации официальный Pages artifact содержит **весь текущий сайт**. Экономия достигается отсутствием повторных файлов в этом дереве. Исходный код core также пока пересобирается на каждом PR: эксперимент уменьшает хранение, а не устраняет стоимость сборки.

## 6. CI/CD и права

### Build preview package

Срабатывает на push в main, PR `opened/synchronize/reopened/closed` и ручной запуск. PR из форков пропускаются.

1. Получает `contents: read`, checkout без сохранения credentials.
2. Собирает точный PR head SHA либо main SHA.
3. Выполняет `npm ci`, build и тест публикации.
4. Загружает `preview-context` с номером PR, SHA и репозиторием.
5. Загружает `preview-package`; retention обоих artifacts — три дня.

При `closed` сборка не нужна: создается только контекст для удаления. Concurrency отменяет устаревшую сборку того же PR.

### Publish Pages previews

Запускается через `workflow_run` после успешного build. Workflow должен существовать на default branch. Издатель использует инструменты из main и не исполняет код из PR-артефакта. Модель привилегий описана в [документации GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run).

Последовательность:

1. Checkout main в `tooling/`, gh-pages в `site/`.
2. Загрузка контекста именно исходного workflow run.
3. Проверка репозитория, workflow path, типа события, SHA и PR-ветки. Устаревший SHA открытого PR пропускается.
4. Загрузка package и создание `preview-pr-N` Deployment в `in_progress`.
5. Объединение сайта, проверка размера, commit/push в gh-pages.
6. `configure-pages` → `upload-pages-artifact` → `deploy-pages`.
7. Чтение публичных manifest URL и сверка `commit/coreId`, с ожиданием обновления edge-кэша до примерно двух минут.
8. Только после этого — Deployment `success` с `environment_url` и обновление PR-комментария.

Издателю нужны `contents: write`, `actions: read`, `pull-requests: write`, `deployments: write`, `pages: write`, `id-token: write`. Секрет с PAT для штатной публикации не нужен: используется `github.token`.

Environment `github-pages` сохраняет ограничение публикации с main. Для PR создаются отдельные логические environments `preview-pr-N`; они не означают отдельные физические Pages-сайты. Поскольку публикуется общий снимок, успешный деплой также восстанавливает статусы других вошедших в него PR, если их SHA еще актуальны.

Комментарий находится по маркеру `<!-- modular-pages-preview -->` и обновляется, а не добавляется на каждый коммит. Ошибка публикации дает `failure` и ссылку на логи, а не ложное сообщение о готовности.

## 7. Повторение локально

Нужны Git, Node.js 24 и npm. Для внешних операций — GitHub CLI `gh`.

```powershell
gh repo clone energizer91/pages-modular-preview-lab D:\Projects\pages-modular-preview-lab-copy
Set-Location D:\Projects\pages-modular-preview-lab-copy
npm ci
npm run dev
```

Открыть `http://127.0.0.1:4173`. Команда собирает настоящий production-снимок и запускает статический сервер; это не обычный Vite HMR. После изменения исходников остановите сервер и запустите команду снова.

В другом терминале из того же каталога:

```powershell
npm run test:browser
```

На Windows тест использует установленный Edge. На других системах установите браузер `npx playwright install chromium`. При необходимости задайте `BROWSER_CHANNEL`. Для проверки существующего публичного превью:

```powershell
$env:TEST_URL = 'https://energizer91.github.io/pages-modular-preview-lab/pr/1/'
npm run test:browser
Remove-Item Env:TEST_URL
```

Build и тест публикации без браузера:

```powershell
npm run build
npm test
```

Тест публикации требует созданного `dist/package`. Build проверяет отсутствие PNG в remote и бюджет remote 250 KiB. На Windows в этой сессии сетевые `gh`/npm-команды внутри песочницы могли выдавать ошибки доступа; повторная проверка с разрешенным сетевым доступом отличала это от настоящей проблемы авторизации.

## 8. Повторение в новом GitHub-репозитории

Используйте отдельный локальный clone, а не меняйте remote рабочего оригинала. Создание репозитория и публикация должны быть разрешены владельцем аккаунта.

1. Скопируйте реализацию и lockfile в отдельный checkout.
2. Замените ссылки на `energizer91/pages-modular-preview-lab` в `src/shell.ts`, README и этом документе. `scripts/deployment.mjs` выводит Pages URL из `GITHUB_REPOSITORY`; custom domain в нем не поддержан.
3. Сохраните имя default branch `main` либо последовательно измените его в workflows и проверках `verify-run.mjs`.
4. Проверьте `gh auth status`. Для отправки workflow-файлов OAuth-токен CLI должен иметь scope `workflow`. Если его нет: `gh auth refresh -h github.com -s workflow` и подтверждение владельцем. Не помещайте токены в исходники или документ.
5. Создайте репозиторий, выбрав публичность с владельцем:

```powershell
$target = 'OWNER/NEW-REPOSITORY'
gh repo create $target --public
git remote set-url origin "https://github.com/$target.git"
```

6. Подготовьте отдельную **пустую** ветку gh-pages. Не начинайте ее копией исходного дерева. Например, следующий код создает ref только при его отсутствии и не переключает рабочий каталог:

```powershell
@'
import { spawnSync } from 'node:child_process';
const git = (args, input) => {
  const r = spawnSync('git', args, { input, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
const tree = git(['mktree'], '');
const commit = git(['commit-tree', tree, '-m', 'Initialize Pages publication branch']);
git(['update-ref', 'refs/heads/gh-pages', commit, '0'.repeat(40)]);
'@ | node --input-type=module
```

Если локальная gh-pages уже существует, этот пример намеренно откажется ее перезаписывать: сначала проверьте ее происхождение и содержимое.

7. Закоммитьте адаптированные исходники, включите Pages и отправьте обе ветки:

```powershell
gh api "repos/$target/pages" --method POST -f build_type=workflow
git push -u origin main gh-pages
gh repo edit $target --default-branch main
```

Для уже настроенного Pages используйте его существующую конфигурацию, а не повторный POST создания. В Settings → Pages должен быть источник **GitHub Actions**, хотя собранные снимки дополнительно сохраняются в gh-pages. Проверьте, что environment github-pages допускает main. Не снимайте защиту веток ради PR: publisher для этого и вынесен на main.

8. Дождитесь цепочки обоих workflows и сверки выдаваемого сайта. Изначальное отсутствие gh-pages, невозможность записывать в нее из-за branch rules или запрет Pages организацией — отдельные проблемы настройки.

## 9. Повторение демонстрационных PR

Для каждого примера создавайте отдельную ветку **от main**, а не от предыдущего примера:

```powershell
git switch main
git switch -c demo/my-change
# Изменить только src/content.ts и сохранить завершающий перевод строки.
npm run build
git add src/content.ts
git commit -m 'Add one item to the preview list'
git push -u origin demo/my-change
gh pr create --base main --head demo/my-change --title 'Add one list item' --body 'Changes list data only; preview link is published by Actions.'
```

Варианты: добавить объект в `items`; заменить только `title` первого объекта; добавить второй объект `{ title, items }` в `lists`. Номера PR в новой репозитории могут быть другими. Пользуйтесь номерами, возвращенными GitHub.

Сравните `coreId` main и PR в одном окружении. При изменениях только данных ожидается тот же core ID, отсутствие PNG в remote и прирост размера только remote/оболочки/метаданных. Ищите персональную ссылку в Deployment и комментарии Action, не вписывайте ее вручную в описание PR.

## 10. Измеренные результаты и критерии приемки

Ниже снимок опубликованного отчета, повторно прочитанный 9 ноября 2026 года. Будущие изменения могут дать другие размеры.

| Показатель | Значение |
| --- | ---: |
| Версий core для main + трех PR | 1 |
| Общий Linux CI core ID | `979fc99810320404` |
| PNG в опубликованном дереве | 1 файл, 3 687 983 байта |
| Remote main | 109 975 байт |
| Remote PR #1 | 110 081 байт, +106 к main |
| Remote PR #2 | 109 978 байт, +3 к main |
| Remote PR #3 | 110 227 байт, +252 к main |
| Размер опубликованного дерева | 4 601 546 байт, около 4,39 MiB |
| Оценка четырех полных копий | 17 045 533 байта, около 16,26 MiB |
| Экономия по этой оценке | Около 73% |

Оценка полных копий — сумма `coreBytes + remoteBytes` для каждого превью. Это расчетная база сравнения, а не замер отдельного деплоя старой монолитной реализации.

Приемка повторения:

- main и каждый PR показывают собственные данные, без наложения изменений других веток;
- iframe имеет ровно 1280/768/390 CSS px, внутри меняются соответствующие media queries;
- добавление задачи, checkbox, фильтр и уведомление работают; состояние локально вкладке;
- общая картинка загружается по одному URL из core, в PR remote ее нет;
- Deployments имеют `success` и правильный URL, комментарий опубликован ботом;
- публичные manifest соответствуют ожидаемым SHA/core ID;
- PR закрывается — его файлы удаляются, другие превью остаются работоспособны;
- неиспользуемый core не удаляется, пока на него ссылается другое превью.

Последние два пункта должны также проверяться интеграционно на тестовом PR; существующий автоматический тест покрывает удаление на уровне файловой публикации, а не весь lifecycle GitHub API.

## 11. Очистка, которая уже существует

- На закрытии PR удаляется `pr/N/`, затем публикуется обновленный сайт.
- После успешной публикации закрытого PR его Deployments переводятся в `inactive`; комментарий обновляется.
- Перед публикацией и по cron `17 3 * * *` (UTC) открытые PR сверяются с папками сайта; папки закрытых PR удаляются.
- Core без ссылок сохраняется минимум 24 часа с первого обнаружения такого состояния. Время хранится в `core-gc.json`: filesystem mtime непригоден, потому что новый checkout сбрасывает его.
- Перед публикацией действует бюджет 800 MiB.

Git-история gh-pages при этом не очищается. Размер сайта и размер Git-репозитория/истории — разные величины. Retention Actions artifacts тоже не управляет сроком жизни опубликованных превью.

## 12. Gaps и примерный план реализации

Все ниже — **предлагаемые доработки**, не возможности текущего кода.

### 12.1. Полная очистка environments закрытых PR

Сейчас `inactive` не удаляет GitHub environment `preview-pr-N`. Кроме того, ежедневная файловая сверка не гарантирует очистку Deployment-метаданных, если событие закрытия было пропущено. Текущие запросы списка Deployments/комментариев также ограничены первой сотней записей.

Предлагаемый lifecycle:

1. На `closed` или периодической сверке повторно получить состояние PR через API.
2. Под тем же lock, что использует publisher, отметить PR как `closing`, удалить его файлы, опубликовать сайт и проверить выдачу.
3. Постранично получить все Deployments **точно** environment `preview-pr-N`; перевести их в `inactive`.
4. После согласованного срока хранения диагностической истории удалить environment через `DELETE /repos/{owner}/{repo}/environments/{environment_name}`. При необходимости отдельно удалить неактивные Deployment records через соответствующий REST endpoint. Не считать удаление environment автоматическим удалением всех записей Deployments.
5. Обновить бот-комментарий: превью удалено; при reopening создать окружение заново и пересобрать актуальный SHA.

Удаление environment требует административных прав к репозиторию, которых не следует предполагать у обычного `GITHUB_TOKEN`. Вынести это в отдельный уборщик с минимально настроенной GitHub App и проверить требуемые permissions по [Environments API](https://docs.github.com/en/rest/deployments/environments#delete-an-environment). Для удаления Deployment учитывать ограничения на его состояние по [Deployments API](https://docs.github.com/en/rest/deployments/deployments#delete-a-deployment).

Уборщик должен быть идемпотентным, считать повторный 404 отсутствием уже удаленного объекта, обрабатывать pagination и не трогать `github-pages`, `preview-main` и произвольные чужие environments. Между проверкой closed и удалением PR может быть reopened: нужны повторная проверка и защита от гонки с новой публикацией. Нельзя удалять production-окружение по одному только широкому префиксу.

### 12.2. Чистка превью открытых PR по таймеру

Сейчас открытый PR может хранить превью неограниченно долго. Cron очищает закрытые PR и orphan core, но **не реализует TTL для открытых PR**.

Предлагаемая политика: превью живет семь суток с успешной публикации. Это пример, срок должен выбрать владелец. Хранить отдельный реестр жизненного цикла, например:

```json
{
  "123": {
    "headSha": "<40 hex characters>",
    "state": "active",
    "publishedAt": "2026-11-09T12:00:00Z",
    "expiresAt": "2026-11-16T12:00:00Z",
    "generation": 4,
    "extendedBy": null
  }
}
```

Реестр можно хранить как `preview-lifecycle.json` в gh-pages; все его изменения должны проходить через того же сериализованного издателя. Время успеха не должно случайно обновляться при повторном выставлении Deployment status или публикации другого PR. Явно определить: новая успешная сборка сбрасывает TTL, а обычный rerun статусов — нет.

Периодический cleanup, например раз в час:

1. Получить реестр, открытые PR и актуальные SHA.
2. По желанию заранее предупредить о скором истечении через тот же бот-комментарий.
3. Перед удалением под lock перечитать `expiresAt`, `generation` и состояние PR: продление могло поступить параллельно.
4. Удалить remote просроченного превью; вместо него оставить маленькую страницу «срок истек» с объяснением восстановления. Она не должна ссылаться на удаляемый core. Изменить collector манифестов/`verify-served.mjs`, чтобы expired-записи не требовали старого runtime.
5. Опубликовать сайт, выставить Deployment `inactive`, запустить GC core с учетом оставшихся ссылок и grace period.
6. Обновить комментарий, реестр и отчет. При ошибке повторить согласование на следующем запуске.

Срок cron не точный таймер: GitHub может задержать scheduled workflow. Контракт должен звучать «очистка на ближайшем успешном запуске после expiresAt». Failed run не продлевает срок автоматически.

**GitHub PR как объект и его превью — разные сущности.** По умолчанию TTL удаляет только превью, сам PR остается открыт. Если требуется именно автоматическое закрытие неактивных PR, это отдельная opt-in политика: метка stale, предупреждение, отсрочка, исключения и явное согласование с владельцем. Не закрывать рабочий PR только из-за истекшего preview TTL.

### 12.3. Продление таймера и восстановление

Возможные интерфейсы: `workflow_dispatch` с полями `pr`/`days` либо строго распознаваемый PR-комментарий `/preview extend 7d`. Метка вроде `preview:keep` может временно исключать превью из TTL, но ее тоже нужно ограничить по правам и отражать в реестре.

Для comment-команды нужен отдельный trusted workflow из main на `issue_comment: created`:

- убедиться, что это комментарий к PR нужного репозитория;
- проверить право автора командовать продлением; пример политики — только `write/maintain/admin`, доступ автору PR включать отдельно;
- разобрать фиксированную грамматику и ограниченный набор сроков, например 1/3/7 суток, максимум 30 суток вперед;
- не интерполировать текст комментария в shell, не выполнять PR-код с привилегированным токеном;
- передать проверенную операцию издателю; под общим lock изменить `expiresAt = min(max(now, expiresAt) + extension, now + cap)` и увеличить generation;
- сохранить автора/время/причину продления и обновить комментарий с новой датой;
- сделать обработку повторной доставки одного comment ID идемпотентной.

Если удаление уже произошло, одного изменения даты недостаточно. Нужна новая сборка актуального PR SHA в read-only build workflow и обычная проверяемая публикация. Artifacts могут истечь через три дня, поэтому нельзя полагаться на их наличие для восстановления семидневного превью. Если PR закрыт, продление не должно его открывать автоматически.

Уточнить правила для новых коммитов, reopen, `preview:keep`, удаления метки, смены автора и продления во время cleanup. Минимальные тесты: продление до TTL, продление во время удаления, повторная команда, отказ неавторизованному пользователю, восстановление expired-превью без старого artifact, закрытие продленного PR и сохранение core, нужного другому PR.

### 12.4. Другие границы масштабирования

- Global concurrency защищает от одновременной записи, но GitHub может заменить ожидающий запуск более новым. Нужна очередь или reconciliation, находящий открытые PR без превью/с устаревшим SHA и восстанавливающий пропущенные сборки.
- Сериализовать не только publish, но и TTL/extend/cleanup. Для нескольких writers применять optimistic concurrency к gh-pages и retry после lease conflict.
- Текущий `singleton`/контракт — лабораторный пример, не sandbox для недоверенного кода. Iframe нужен для viewport, а сочетание `allow-scripts` и `allow-same-origin` не дает надежной изоляции произвольного PR-JavaScript.
- Для форков требуется отдельная модель допуска, проверки artifact и credentials. Не убирать guard «только этот репозиторий» без ее проектирования.
- Сумма уникальных remote и сохраняемых core все равно ограничена 1 GB. TTL, admission control и измерения обязательны при большом количестве PR.

## 13. Диагностика и эксплуатационные замечания

Сначала различайте build, сохранение gh-pages, Pages delivery и Deployment metadata. Зелёная сборка или созданная запись Deployment сами по себе не доказывают, что браузер получает новый снимок.

```powershell
gh run list --repo OWNER/REPO --limit 10
gh run view RUN_ID --repo OWNER/REPO --log-failed
gh api 'repos/OWNER/REPO/pages'
gh api 'repos/OWNER/REPO/deployments?environment=preview-pr-123'
```

Во время создания примера были задержки Pages `deployment_queued` → `updating_pages` и таймаут официального action. Следующий запрос с тем же Pages build version получил состояние отмененного запроса. Позже новый запуск с новым коммитом main успешно опубликовался, затем прошли следующие публикации. Это наблюдение конкретного эксперимента, а не доказательство ошибки приложения или универсальный способ исправления Pages.

Не снимайте environment protection и не переписывайте архитектуру только из-за очереди сервиса. Проверяйте точный лог, актуальный SHA, артефакт и публичный manifest. Не создавайте бесконечные reruns: у artifacts ограничен retention, а повторные запуски с тем же Pages version могут иметь особое поведение. Ручной запуск `pages.yml` здесь выполняет обслуживание существующего сайта; для отсутствующего PR package нужна новая PR-сборка, а не только этот maintenance-запуск.

## 14. Что агент должен сохранить при развитии

Не менять неизменяемый core на месте; не возвращать fallback React/UI/PNG в remote; не обещать автоматический модульный git-diff; не считать удаление файлов очисткой environments; не объявлять TTL/продление уже реализованными. Новые lifecycle-возможности оформлять отдельными изменениями и проверять на тестовых PR до использования для реальных рабочих веток.

Дополнительные первичные источники: [Vite Federation](https://module-federation.io/integrations/build-tool/vite), [host-only shared dependencies](https://github.com/module-federation/vite#host-only-shared-dependencies), [Park UI installation](https://park-ui.com/docs/installation), [Panda CSS v2 migration](https://panda-css.com/docs/get-started/upgrading-to-v2), [GitHub Pages REST API](https://docs.github.com/en/rest/pages/pages).
