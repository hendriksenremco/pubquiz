import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import { IPC, type MenuAction } from '@shared/ipc'
import type { AppController } from './controller'
import { appLocale } from './locale'
import { MENU_MESSAGES } from './messages'

export function buildMenu(controller: AppController): void {
  const send = (action: MenuAction) => controller.operator?.webContents.send(IPC.menu, action)
  const t = MENU_MESSAGES.in(appLocale())

  const template: MenuItemConstructorOptions[] = [
    {
      role: 'appMenu',
      submenu: [
        { role: 'about', label: t('about', { app: app.name }) },
        { type: 'separator' },
        { label: t('settings'), accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
        { type: 'separator' },
        { role: 'services', label: t('services') },
        { type: 'separator' },
        { role: 'hide', label: t('hide', { app: app.name }) },
        { role: 'hideOthers', label: t('hideOthers') },
        { role: 'unhide', label: t('showAll') },
        { type: 'separator' },
        { role: 'quit', label: t('quit', { app: app.name }) }
      ]
    },
    {
      label: t('file'),
      submenu: [
        { label: t('newQuiz'), accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: t('openQuiz'), accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { type: 'separator' },
        { label: t('importZip'), click: () => send('importZip') },
        { label: t('importRound'), click: () => send('importRound') },
        { label: t('exportZip'), click: () => send('exportZip') },
        { type: 'separator' },
        { label: t('reveal'), click: () => send('reveal') }
      ]
    },
    {
      label: t('edit'),
      submenu: [
        // Ongedaan maken van quiz-wijzigingen loopt via de renderer; in tekstvelden doet die het native.
        { label: t('undo'), accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: t('redo'), accelerator: 'Shift+CmdOrCtrl+Z', click: () => send('redo') },
        { type: 'separator' },
        { role: 'cut', label: t('cut') },
        { role: 'copy', label: t('copy') },
        { role: 'paste', label: t('paste') },
        { role: 'selectAll', label: t('selectAll') }
      ]
    },
    {
      label: t('view'),
      submenu: [
        { role: 'reload', label: t('reload') },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: t('devTools') } as const]),
        { type: 'separator' },
        { role: 'resetZoom', label: t('actualSize') },
        { role: 'zoomIn', label: t('zoomIn') },
        { role: 'zoomOut', label: t('zoomOut') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('fullScreen') }
      ]
    },
    {
      role: 'windowMenu',
      label: t('window'),
      submenu: [
        { role: 'minimize', label: t('minimize') },
        { role: 'zoom', label: t('zoom') },
        { type: 'separator' },
        { role: 'front', label: t('front') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
