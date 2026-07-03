import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscodeMock from '../mocks/vscode';
import { D365StatusBar, friendlyName, showD365Menu } from '../../src/statusBar';
import type { ConnectionManager, D365Connection, StoredConnection } from '../../src/connectionManager';

describe('statusBar.friendlyName (vscode-mock smoke test)', () => {
    afterEach(() => {
        sinon.restore();
        vscodeMock.resetVscodeMock();
    });

    it('extracts the org name from a Dataverse hostname', () => {
        assert.strictEqual(friendlyName('https://contoso.crm11.dynamics.com'), 'contoso');
    });

    it('falls back to the raw input for an unparsable URL', () => {
        assert.strictEqual(friendlyName('not-a-url'), 'not-a-url');
    });

    it('can stub vscode.window methods via the mock module', async () => {
        const stub = sinon.stub(vscodeMock.window, 'showInformationMessage').resolves('ok' as any);
        const result = await vscodeMock.window.showInformationMessage('hello');
        assert.strictEqual(result, 'ok');
        assert.ok(stub.calledOnceWith('hello'));
    });
});

// ── Fake ConnectionManager ────────────────────────────────────────────────────

function makeFakeConnectionManager(overrides: Partial<{
    connection: D365Connection | undefined;
    isRestoring: boolean;
    recents: StoredConnection[];
}> = {}) {
    const emitter = new vscodeMock.EventEmitter<D365Connection | undefined>();
    const state = {
        connection: overrides.connection,
        isRestoring: overrides.isRestoring ?? false,
        recents: overrides.recents ?? [],
    };

    const fake = {
        onDidChangeConnection: emitter.event,
        get connection() { return state.connection; },
        get isRestoring() { return state.isRestoring; },
        get isConnected() { return state.connection !== undefined; },
        getRecentEnvironments: sinon.stub().callsFake(() => state.recents),
        disconnect: sinon.stub(),
        switchAccount: sinon.stub().resolves(undefined),
        connect: sinon.stub().resolves(undefined),
        connectToStored: sinon.stub().resolves(undefined),
    };

    return {
        fake: fake as unknown as ConnectionManager,
        emitter,
        state,
    };
}

describe('D365StatusBar', () => {
    afterEach(() => {
        sinon.restore();
        vscodeMock.resetVscodeMock();
    });

    it('creates a status bar item, shows it, and reflects the initial disconnected state', () => {
        const { fake } = makeFakeConnectionManager();
        const item = { name: '', text: '', tooltip: undefined as unknown, command: undefined as unknown, show: sinon.stub(), hide: sinon.stub(), dispose: sinon.stub() };
        sinon.stub(vscodeMock.window, 'createStatusBarItem').returns(item as any);

        const statusBar = new D365StatusBar(fake);

        assert.strictEqual(item.name, 'D365');
        assert.strictEqual(item.command, 'd365.statusBarMenu');
        assert.ok(item.show.calledOnce);
        assert.strictEqual(item.text, '$(debug-disconnect) D365: Not Connected');
        assert.match(item.tooltip as string, /Click to connect/);

        statusBar.dispose();
        assert.ok(item.dispose.calledOnce);
    });

    it('shows a reconnecting spinner while isRestoring is true, regardless of connection state', () => {
        const { fake } = makeFakeConnectionManager({ isRestoring: true });
        const item = { name: '', text: '', tooltip: undefined as unknown, command: undefined as unknown, show: sinon.stub(), hide: sinon.stub(), dispose: sinon.stub() };
        sinon.stub(vscodeMock.window, 'createStatusBarItem').returns(item as any);

        new D365StatusBar(fake);

        assert.strictEqual(item.text, '$(sync~spin) D365: Reconnecting…');
        assert.match(item.tooltip as string, /Restoring previous connection/);
    });

    it('shows the environment name and a Markdown tooltip with WhoAmI info when connected', () => {
        const conn: D365Connection = {
            environmentUrl: 'https://contoso.crm.dynamics.com',
            tenantId: 't1',
            authMode: 'user',
            whoAmI: { UserId: 'user-1', BusinessUnitId: 'b1', OrganizationId: 'o1' } as any,
        };
        const { fake } = makeFakeConnectionManager({ connection: conn });
        const item = { name: '', text: '', tooltip: undefined as unknown, command: undefined as unknown, show: sinon.stub(), hide: sinon.stub(), dispose: sinon.stub() };
        sinon.stub(vscodeMock.window, 'createStatusBarItem').returns(item as any);

        new D365StatusBar(fake);

        assert.strictEqual(item.text, '$(plug) D365: contoso');
        assert.ok(item.tooltip instanceof vscodeMock.MarkdownString);
        const tooltip = (item.tooltip as vscodeMock.MarkdownString).value;
        assert.match(tooltip, /Connected to D365/);
        assert.match(tooltip, /Signed in with Microsoft account/);
        assert.match(tooltip, /User ID: user-1/);
    });

    it('describes client-credentials connections by client ID instead of "Signed in"', () => {
        const conn: D365Connection = {
            environmentUrl: 'https://contoso.crm.dynamics.com',
            tenantId: 't1',
            authMode: 'clientCredentials',
            clientId: 'client-123',
        };
        const { fake } = makeFakeConnectionManager({ connection: conn });
        const item = { name: '', text: '', tooltip: undefined as unknown, command: undefined as unknown, show: sinon.stub(), hide: sinon.stub(), dispose: sinon.stub() };
        sinon.stub(vscodeMock.window, 'createStatusBarItem').returns(item as any);

        new D365StatusBar(fake);

        const tooltip = (item.tooltip as vscodeMock.MarkdownString).value;
        assert.match(tooltip, /Client credentials \(client-123\)/);
    });

    it('re-renders when the connection manager fires a change event', () => {
        const { fake, emitter, state } = makeFakeConnectionManager();
        const item = { name: '', text: '', tooltip: undefined as unknown, command: undefined as unknown, show: sinon.stub(), hide: sinon.stub(), dispose: sinon.stub() };
        sinon.stub(vscodeMock.window, 'createStatusBarItem').returns(item as any);

        new D365StatusBar(fake);
        assert.strictEqual(item.text, '$(debug-disconnect) D365: Not Connected');

        const newConn: D365Connection = { environmentUrl: 'https://contoso.crm.dynamics.com', tenantId: 't1', authMode: 'user' };
        state.connection = newConn;
        emitter.fire(newConn);

        assert.strictEqual(item.text, '$(plug) D365: contoso');
    });
});

describe('showD365Menu', () => {
    afterEach(() => {
        sinon.restore();
        vscodeMock.resetVscodeMock();
    });

    it('shows an info message and returns without a quick pick while restoring', async () => {
        const { fake } = makeFakeConnectionManager({ isRestoring: true });
        const infoStub = sinon.stub(vscodeMock.window, 'showInformationMessage').resolves(undefined);
        const quickPickStub = sinon.stub(vscodeMock.window, 'showQuickPick');

        await showD365Menu(fake);

        assert.ok(infoStub.calledWithMatch(/Still restoring/));
        assert.ok(!quickPickStub.called);
    });

    it('offers Disconnect and Switch Account (for user auth) when connected, and runs the chosen action', async () => {
        const conn: D365Connection = { environmentUrl: 'https://contoso.crm.dynamics.com', tenantId: 't1', authMode: 'user' };
        const { fake } = makeFakeConnectionManager({ connection: conn });

        const quickPickStub = sinon.stub(vscodeMock.window, 'showQuickPick').callsFake(async (items: any[]) => {
            assert.ok(items.some(i => i.label.includes('Disconnect')));
            assert.ok(items.some(i => i.label.includes('Switch Account')));
            return items.find(i => i.label.includes('Switch Account'));
        });

        await showD365Menu(fake);

        assert.ok(quickPickStub.calledOnce);
        assert.ok((fake.switchAccount as sinon.SinonStub).calledOnce);
    });

    it('does not offer Switch Account for a clientCredentials connection', async () => {
        const conn: D365Connection = { environmentUrl: 'https://contoso.crm.dynamics.com', tenantId: 't1', authMode: 'clientCredentials', clientId: 'c1' };
        const { fake } = makeFakeConnectionManager({ connection: conn });

        sinon.stub(vscodeMock.window, 'showQuickPick').callsFake(async (items: any[]) => {
            assert.ok(!items.some(i => i.label.includes('Switch Account')));
            return undefined;
        });

        await showD365Menu(fake);
    });

    it('offers "Connect to Environment" when disconnected, and invokes connect()', async () => {
        const { fake } = makeFakeConnectionManager();

        sinon.stub(vscodeMock.window, 'showQuickPick').callsFake(async (items: any[]) => {
            assert.ok(items.some(i => i.label.includes('Connect to Environment')));
            return items.find(i => i.label.includes('Connect to Environment'));
        });

        await showD365Menu(fake);

        assert.ok((fake.connect as sinon.SinonStub).calledOnce);
    });

    it('lists recent environments (excluding the current one) and reconnects to the chosen one', async () => {
        const conn: D365Connection = { environmentUrl: 'https://current.crm.dynamics.com', tenantId: 't1', authMode: 'user' };
        const recents: StoredConnection[] = [
            { environmentUrl: 'https://current.crm.dynamics.com', tenantId: 't1', authMode: 'user' },
            { environmentUrl: 'https://other.crm.dynamics.com', tenantId: 't2', authMode: 'user' },
        ];
        const { fake } = makeFakeConnectionManager({ connection: conn, recents });

        sinon.stub(vscodeMock.window, 'showQuickPick').callsFake(async (items: any[]) => {
            const historyItems = items.filter(i => i.label.includes('$(history)'));
            assert.strictEqual(historyItems.length, 1);
            assert.strictEqual(historyItems[0].description, 'https://other.crm.dynamics.com');
            return historyItems[0];
        });

        await showD365Menu(fake);

        assert.ok((fake.connectToStored as sinon.SinonStub).calledOnceWith(recents[1]));
    });

    it('does nothing further when the quick pick is cancelled', async () => {
        const { fake } = makeFakeConnectionManager();
        sinon.stub(vscodeMock.window, 'showQuickPick').resolves(undefined);

        await showD365Menu(fake);

        assert.ok(!(fake.connect as sinon.SinonStub).called);
    });
});
