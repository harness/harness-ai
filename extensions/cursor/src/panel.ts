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
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview', 'panel.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview', 'panel.css'),
    );
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `font-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src ${webview.cspSource}`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
  }
}
