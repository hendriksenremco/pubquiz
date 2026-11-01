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
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: t('file'),
      submenu: [
        { label: t('newQuiz'), accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: t('openQuiz'), accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { type: 'separator' },
        { label: t('importZip'), click: () => send('importZip') },
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
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: t('view'),
      submenu: [
        { role: 'reload' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools' } as const]),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
