import installExtension, { REACT_DEVELOPER_TOOLS } from "electron-devtools-installer";
import * as E from "electron";
import * as url from "url";

import Tabs from "./Tabs";
import {
    shortcuts,
    isDev,
    winUrlDev,
    winUrlProd,
    NEWTAB,
    TABADDED,
    CLOSETAB,
    FOCUSTAB,
    CLOSEALLTAB,
    MAINTAB
} from "../utils";

interface IWindowManager {
    home: string;
    mainWindow: E.BrowserWindow;

    reloadAllWindows(): void;
}

class WindowManager implements IWindowManager {
    home: string;
    mainWindow: E.BrowserWindow;

    constructor(options: E.BrowserWindowConstructorOptions, home: string) {
        this.home = home;

        E.app.on('browser-window-created', this.onBrowserWindowCreated);
        E.app.on('ready', () => {
            this.mainWindow = new E.BrowserWindow(options);
            this.mainWindow.loadURL(isDev ? winUrlDev : winUrlProd);

            const tab = Tabs.newTab(`${home}/login`, {
                x: 0,
                y: 19,
                width: this.mainWindow.getContentBounds().width,
                height: this.mainWindow.getContentBounds().height-19
            });
            tab.webContents.on('will-navigate', this.onMainWindowWillNavigate);

            this.mainWindow.setBrowserView(tab);

            shortcuts(this.mainWindow);

            if (isDev) this.devtools();
            if (isDev) this.mainWindow.webContents.toggleDevTools();
        });
        E.app.on('window-all-closed', this.onWindowAllClosed);

        this.addIpc();
    }

    reloadAllWindows = () => {}

    private addIpc = () => {
        E.ipcMain.on(NEWTAB, () => {
            let view = Tabs.newTab(`${this.home}/login`, {
                x: 0,
                y: 19,
                width: this.mainWindow.getContentBounds().width,
                height: this.mainWindow.getContentBounds().height-19
            });
            this.mainWindow.setBrowserView(view);
            view.webContents.on('will-navigate', this.onMainWindowWillNavigate);

            this.mainWindow.webContents.send(TABADDED, { id: view.id, url: `${this.home}/login`});
        });
        E.ipcMain.on(CLOSETAB, (event: Event, id: number) => {
            const views = Tabs.getAll();
            const index: number = views.findIndex(t => t.id == id);
            const view = Tabs.focus(views[index > 0 ? index-1 : index].id);
            this.mainWindow.setBrowserView(view);

            Tabs.close(id);
        });
        E.ipcMain.on(FOCUSTAB, (event: Event, id: number) => {
            const view = Tabs.focus(id);
            this.mainWindow.setBrowserView(view);
        });
        E.ipcMain.on(MAINTAB, (event: Event) => {
            const view = Tabs.focus(1);
            this.mainWindow.setBrowserView(view);
        });
        E.ipcMain.on(CLOSEALLTAB, () => {
            console.log('Close all tab');
        });
    }


    private onMainWindowWillNavigate = (event: E.Event, newUrl: string) => {
        const currentUrl = event.sender.getURL();

        if (newUrl === currentUrl) {
            // Tabs.reloadAll();

            event.preventDefault();
            return;
        }

        const from = url.parse(currentUrl);
        const to = url.parse(newUrl);

        if (from.pathname === '/login') {
            Tabs.reloadAll();

            event.preventDefault();
            return;
        }

        if (to.pathname === '/logout') {
            E.net.request(`${this.home}/logout`).on('response', response => {
                response.on('data', data => {});
                response.on('error', (err: Error) => {
                    console.log('Request error: ', err);
                });
                response.on('end', () => {
                    if (response.statusCode >= 200 && response.statusCode <= 299) {

                        E.session.defaultSession!.cookies.flushStore(() => {

                            const view = Tabs.focus(1);
                            this.mainWindow.setBrowserView(view);
                            view.webContents.reload();

                            Tabs.closeAll();

                            this.mainWindow.webContents.send(CLOSEALLTAB);
                        });
                    }

                    if (response.statusCode >= 400) {
                        E.session.defaultSession!.clearStorageData();
                        this.mainWindow.webContents.loadURL(`${this.home}`);
                    }
                });
            }).end();

            event.preventDefault();
            return;
        }
    }
    private onWindowAllClosed = () => {
        if(process.platform !== 'darwin') {
            E.app.quit();
        }
    }
    private onBrowserWindowCreated = (event: E.Event, window: E.BrowserWindow) => {
        window.setMenu(null);
    }
    private devtools = () => {
		installExtension(REACT_DEVELOPER_TOOLS)
			.then((name) => console.log(`Added Extension:  ${name}`))
			.catch((err) => console.log('An error occurred: ', err));
	}
}

export default WindowManager;
export {
    IWindowManager
}
