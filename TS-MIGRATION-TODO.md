# TS Migration TODO

Goal: finish the JS -> TS migration without rework, in compiler order.
Status: prefix migrated and validated items with `[done]` so they stay out of the active queue unless they break again.
Skills to use on this migration: `typescript-strict-migrator`, `typescript-pro`, `typescript-refactor`, `typescript-advanced-types`, `migrate-js-to-modern-typescript`, `codex-fable5`, `codex-review`, `code-simplifier`.

## P0 - Current compiler blockers
- [done] `src/plugins/bookPlayer/plugin.ts`
- [done] `src/plugins/bookPlayer/tableOfContents.ts`
- [done] `src/plugins/chromecastPlayer/plugin.ts`
- [done] `src/plugins/comicsPlayer/plugin.ts`
- [done] `src/plugins/htmlAudioPlayer/plugin.ts`
- [done] `src/plugins/logoScreensaver/plugin.ts`
- [done] `src/plugins/pdfPlayer/plugin.ts`
- [done] `src/plugins/photoPlayer/plugin.ts`
- [done] `src/plugins/sessionPlayer/plugin.ts`
- [done] `src/plugins/youtubePlayer/plugin.ts`
- [done] `src/scripts/libraryMenu.ts`

## P1 - Controllers already in the migration queue
- [done] `src/controllers/list.ts`
- [done] `src/controllers/livetv/livetvchannels.ts`
- [done] `src/controllers/livetv/livetvguide.ts`
- [done] `src/controllers/livetv/livetvrecordings.ts`
- [done] `src/controllers/livetv/livetvschedule.ts`
- [done] `src/controllers/livetv/livetvseriestimers.ts`
- [done] `src/controllers/livetv/livetvsuggested.ts`

## P2 - Shared media pages and query helpers
- [done] `src/controllers/lyrics.ts`
- [done] `src/controllers/music/musicalbums.ts`
- [done] `src/controllers/music/musicartists.ts`
- [done] `src/controllers/music/musicgenres.ts`
- [done] `src/controllers/music/musicplaylists.ts`
- [done] `src/controllers/music/musicrecommended.ts`
- [done] `src/controllers/music/songs.ts`
- [done] `src/apps/dashboard/features/libraries/components/LibraryCard.tsx`

## P3 - Player and dialog wrappers
- [done] `src/components/recordingcreator/recordingcreator.ts`
- [done] `src/components/recordingcreator/recordingeditor.ts`
- [done] `src/components/recordingcreator/seriesrecordingeditor.ts`
- [done] `src/components/upnextdialog/upnextdialog.ts`
- [done] `src/components/slideshow/slideshow.ts`
- [done] `src/components/alphaPicker/AlphaPickerComponent.tsx`
- [done] `src/controllers/edititemmetadata.ts`

## P4 - Remaining JS source files

### Apps and dashboard
- [done] `src/apps/dashboard/controllers/livetvguideprovider.js` (migrated to `livetvguideprovider.ts`)
- [done] `src/apps/dashboard/controllers/livetvtuner.js` (migrated to `livetvtuner.ts`)
- [done] `src/apps/wizard/controllers/finish/index.js` (migrated to `index.ts`)
- [done] `src/apps/wizard/controllers/library.js` (migrated to `library.ts`)
- [done] `src/apps/wizard/controllers/remote/index.js` (migrated to `index.ts`)
- [done] `src/apps/wizard/controllers/settings/index.js` (migrated to `index.ts`)
- [done] `src/apps/wizard/controllers/start/index.js` (migrated to `index.ts`)
- [done] `src/apps/wizard/controllers/user/index.js` (migrated to `index.ts`)

### Controllers
- [done] `src/controllers/playback/video/index.js` (migrated to `index.ts`)
- [done] `src/controllers/user/controls/index.js` (migrated to `index.ts`)
- [done] `src/controllers/user/display/index.js` (migrated to `index.ts`)
- [done] `src/controllers/user/home/index.js` (migrated to `index.ts`)
- [done] `src/controllers/user/playback/index.js` (migrated to `index.ts`)
- [done] `src/controllers/user/subtitles/index.js` (migrated to `index.ts`)

### Components
- [done] `src/components/branding/adsense.js` (migrated to `adsense.ts`)
- [done] `src/components/cardbuilder/cardBuilder.js` (migrated to `cardBuilder.ts`)
- [done] `src/components/cardbuilder/chaptercardbuilder.js` (migrated to `chaptercardbuilder.ts`)
- [done] `src/components/cardbuilder/peoplecardbuilder.js` (migrated to `peoplecardbuilder.ts`)
- [done] `src/components/dialog/dialog.js` (migrated to `dialog.ts`)
- [done] `src/components/dialogHelper/dialogHelper.js` (migrated to `dialogHelper.ts`)
- [done] `src/components/directorybrowser/directorybrowser.js` (migrated to `directorybrowser.ts`)
- [done] `src/components/filterdialog/filterdialog.js` (migrated to `filterdialog.ts`)
- [done] `src/components/filtermenu/filtermenu.js` (migrated to `filtermenu.ts`)
- [done] `src/components/focusManager.js` (migrated to `focusManager.ts`)
- [done] `src/components/guide/guide.js` (migrated to `guide.ts`)
- [done] `src/components/guide/guide-settings.js` (migrated to `guide-settings.ts`)
- [done] `src/components/homesections/homesections.js` (migrated to `homesections.ts`)
- [done] `src/components/images/imageLoader.js` (migrated to `imageLoader.ts`)
- [done] `src/components/indicators/indicators.js` (migrated to `indicators.ts`)
- [done] `src/components/itemContextMenu.js` (migrated to `itemContextMenu.ts`)
- [done] `src/components/itemHelper.js` (migrated to `itemHelper.ts`)
- [done] `src/components/layoutManager.js` (migrated to `layoutManager.ts`)
- [done] `src/components/lazyLoader/lazyLoaderIntersectionObserver.js` (migrated to `lazyLoaderIntersectionObserver.ts`)
- [done] `src/components/libraryoptionseditor/libraryoptionseditor.js` (migrated to `libraryoptionseditor.ts`)
- [done] `src/components/listview/listview.js` (migrated to `listview.ts`)
- [done] `src/components/maintabsmanager.js` (migrated to `maintabsmanager.ts`)
- [done] `src/components/mediainfo/mediainfo.js` (migrated to `mediainfo.ts`)
- [done] `src/components/multiSelect/multiSelect.js` (migrated to `multiSelect.ts`)
- [done] `src/components/notifications/notifications.js` (migrated to `notifications.ts`)
- [done] `src/components/nowPlayingBar/nowPlayingBar.js` (migrated to `nowPlayingBar.ts`)
- [done] `src/components/playback/brightnessosd.js` (migrated to `brightnessosd.ts`)
- [done] `src/components/playback/playbackmanager.js` (migrated to `playbackmanager.ts`)
- [done] `src/components/playback/playbackorientation.js` (migrated to `playbackorientation.ts`)
- [done] `src/components/playback/playerSelectionMenu.js` (migrated to `playerSelectionMenu.ts`)
- [done] `src/components/playback/playersettingsmenu.js` (migrated to `playersettingsmenu.ts`)
- [done] `src/components/playback/playmethodhelper.js` (migrated to `playmethodhelper.ts`)
- [done] `src/components/playback/playqueuemanager.js` (migrated to `playqueuemanager.ts`)
- [done] `src/components/playback/remotecontrolautoplay.js` (migrated to `remotecontrolautoplay.ts`)
- [done] `src/components/playback/volumeosd.js` (migrated to `volumeosd.ts`)
- [done] `src/components/playbackSettings/playbackSettings.js` (migrated to `playbackSettings.ts`)
- [done] `src/components/playerstats/playerstats.js` (migrated to `playerstats.ts`)
- [done] `src/components/pluginManager.js` (migrated to `pluginManager.ts`)
- [done] `src/components/prompt/prompt.js` (migrated to `prompt.ts`)
- [done] `src/components/remotecontrol/remotecontrol.js` (migrated to `remotecontrol.ts`)
- [done] `src/components/router/appRouter.ts` (migrated from `appRouter.js`)
- [done] `src/components/sanitizeFilename.js` (removed; unused)
- [done] `src/components/scrollManager.js` (migrated to `scrollManager.ts`)
- [done] `src/components/shortcuts.js` (migrated to `shortcuts.ts`)
- [done] `src/components/sortmenu/sortmenu.js` (migrated to `sortmenu.ts`)
- [done] `src/components/viewContainer.js` (migrated to `viewContainer.ts`)

### Elements
- [done] `src/elements/emby-programcell/emby-programcell.js` (migrated to `emby-programcell.ts`)

### Plugins
- [done] `src/plugins/backdropScreensaver/plugin.js` (migrated to `plugin.ts`)

## P5 - Non-source migration completed

### Root config and scripts
- [done] `babel.config.js` (migrated to `babel.config.cjs`)
- [done] `copy-assets.js` (migrated to `copy-assets.cjs`)
- [done] `cssnano.config.js` (migrated to `cssnano.config.cjs`)
- [done] `postcss.config.js` (migrated to `postcss.config.cjs`)

### Selenium cucumber suite
- [done] `tests/selenium-cucumber/support/app.js` (migrated to `app.ts`)
- [done] `tests/selenium-cucumber/support/config.js` (migrated to `config.ts`)
- [done] `tests/selenium-cucumber/support/hooks.js` (migrated to `hooks.ts`)
- [done] `tests/selenium-cucumber/support/stage.js` (migrated to `stage.ts`)
- [done] `tests/selenium-cucumber/support/world.js` (migrated to `world.ts`)
- [done] `tests/selenium-cucumber/steps/admin.steps.js` (migrated to `admin.steps.ts`)
- [done] `tests/selenium-cucumber/steps/media.steps.js` (migrated to `media.steps.ts`)
- [done] `tests/selenium-cucumber/steps/user.steps.js` (migrated to `user.steps.ts`)
- [done] `tests/selenium-cucumber/steps/wizard.steps.js` (migrated to `wizard.steps.ts`)

### Source migration status
- [done] `src/components/playback/playbackmanager.js` (migrated to `playbackmanager.ts`)
- [done] `src/plugins/htmlVideoPlayer/plugin.js` (migrated to `plugin.ts`)
- [done] `src/plugins/chromecastPlayer/castSenderApi.js` (migrated to `castSenderApi.ts`)
- [done] `src/plugins/chromecastPlayer/plugin.js` (migrated to `plugin.ts`)
- [done] `src/plugins/htmlAudioPlayer/plugin.js` (migrated to `plugin.ts`)
- [done] `src/plugins/logoScreensaver/plugin.js` (migrated to `plugin.ts`)
- [done] `src/plugins/sessionPlayer/plugin.js` (migrated to `plugin.ts`)
- [done] `src/plugins/syncPlay/core/Controller.js` (migrated to `Controller.ts`)
- [done] `src/plugins/syncPlay/core/Helper.js` (migrated to `Helper.ts`)
- [done] `src/plugins/syncPlay/core/index.js` (migrated to `index.ts`)
- [done] `src/plugins/syncPlay/core/Manager.js` (migrated to `Manager.ts`)
- [done] `src/plugins/syncPlay/core/PlaybackCore.js` (migrated to `PlaybackCore.ts`)
- [done] `src/plugins/syncPlay/core/players/GenericPlayer.js` (migrated to `GenericPlayer.ts`)
- [done] `src/plugins/syncPlay/core/players/PlayerFactory.js` (migrated to `PlayerFactory.ts`)
- [done] `src/plugins/syncPlay/core/QueueCore.js` (migrated to `QueueCore.ts`)
- [done] `src/plugins/syncPlay/core/Settings.js` (migrated to `Settings.ts`)
- [done] `src/plugins/syncPlay/core/timeSync/TimeSync.js` (migrated to `TimeSync.ts`)
- [done] `src/plugins/syncPlay/core/timeSync/TimeSyncCore.js` (migrated to `TimeSyncCore.ts`)
- [done] `src/plugins/syncPlay/core/timeSync/TimeSyncServer.js` (migrated to `TimeSyncServer.ts`)
- [done] `src/plugins/syncPlay/ui/groupSelectionMenu.js` (migrated to `groupSelectionMenu.ts`)
- [done] `src/plugins/syncPlay/ui/playbackPermissionManager.js` (migrated to `playbackPermissionManager.ts`)
- [done] `src/plugins/syncPlay/ui/players/HtmlAudioPlayer.js` (migrated to `HtmlAudioPlayer.ts`)
- [done] `src/plugins/syncPlay/ui/players/HtmlVideoPlayer.js` (migrated to `HtmlVideoPlayer.ts`)
- [done] `src/plugins/syncPlay/ui/players/NoActivePlayer.js` (migrated to `NoActivePlayer.ts`)
- [done] `src/plugins/syncPlay/ui/players/QueueManager.js` (migrated to `QueueManager.ts`)
- [done] `src/plugins/syncPlay/ui/settings/SettingsEditor.js` (migrated to `SettingsEditor.ts`)
- [done] `src/plugins/youtubePlayer/plugin.js` (migrated to `plugin.ts`)

### Scripts and utilities
- [done] `src/scripts/alphanumericshortcuts.js` (migrated to `alphanumericshortcuts.ts`)
- [done] `src/serviceworker.js` (migrated to `serviceworker.ts`)
- [done] `debug_translate.js` (migrated to `debug_translate.ts`)

## Done when
- `npm run build:check` passes.
- `npm run build:production` passes.


