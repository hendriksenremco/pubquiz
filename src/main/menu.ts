import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import { IPC, type MenuAction } from '@shared/ipc'
import type { AppController } from './controller'

export function buildMenu(controller: AppController): void {
  const send = (action: MenuAction) => controller.operator?.webContents.send(IPC.menu, action)

  const template: MenuItemConstructorOptions[] = [
    {
      role: 'appMenu',
      submenu: [
        { role: 'about', label: `Over ${app.name}` },
        { type: 'separator' },
        { label: 'Instellingen…', accelerator: 'CmdOrCtrl+,', click: () => send('settings') },
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
      label: 'Archief',
      submenu: [
        { label: 'Nieuwe quiz…', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
        { label: 'Open quiz…', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
        { type: 'separator' },
        { label: 'Importeer uit zip…', click: () => send('importZip') },
        { label: 'Exporteer als zip…', click: () => send('exportZip') },
        { type: 'separator' },
        { label: 'Toon in Finder', click: () => send('reveal') }
      ]
    },
    {
      label: 'Wijzig',
      submenu: [
        // Ongedaan maken van quiz-wijzigingen loopt via de renderer; in tekstvelden doet die het native.
        { label: 'Herstel', accelerator: 'CmdOrCtrl+Z', click: () => send('undo') },
        { label: 'Opnieuw', accelerator: 'Shift+CmdOrCtrl+Z', click: () => send('redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'Weergave',
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
