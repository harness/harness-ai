import * as vscode from 'vscode';
import type { PanelMessage, PanelState } from './types';

export class VibeViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'harness.vibe';

  private view?: vscode.WebviewView;
  private state: PanelState | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onMessage: (message: PanelMessage) => void,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = this.renderHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message: PanelMessage) => {
      if (message?.type) this.onMessage(message);
    });
    this.pushState();
  }

  setState(state: PanelState): void {
    this.state = state;
    this.pushState();
  }

  private pushState(): void {
    if (!this.view || !this.state) return;
    void this.view.webview.postMessage({ type: 'state', payload: this.state });
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview', 'panel.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview', 'panel.css'),
    );
    const initialState = JSON.stringify(this.state ?? null).replace(/</g, '\\u003c');
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="${styleUri}">
  <style>html,body,#root{margin:0;padding:0;height:100%;background:#161719;}</style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__VIBE_INITIAL_STATE__=${initialState};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
