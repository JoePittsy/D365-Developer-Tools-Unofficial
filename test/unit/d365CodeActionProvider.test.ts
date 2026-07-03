import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscodeMock from '../mocks/vscode';
import {
    D365CompletionProvider,
    D365CodeActionProvider,
    registerInsertInterfaceCommand,
} from '../../src/d365CodeActionProvider';
import type { ConnectionManager } from '../../src/connectionManager';
import type { DataverseClient, EntityDefinition, AttributeDefinition, OptionValue } from '../../src/dataverseClient';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function fakeConnectionManager(isConnected: boolean): ConnectionManager {
    return { isConnected } as unknown as ConnectionManager;
}

function fakeClient(overrides: Partial<{
    getEntities: sinon.SinonStub;
    getAttributes: sinon.SinonStub;
    getAttributeOptions: sinon.SinonStub;
}> = {}): DataverseClient {
    return {
        getEntities: overrides.getEntities ?? sinon.stub().resolves([]),
        getAttributes: overrides.getAttributes ?? sinon.stub().resolves([]),
        getAttributeOptions: overrides.getAttributeOptions ?? sinon.stub().resolves([]),
    } as unknown as DataverseClient;
}

function entity(overrides: Partial<EntityDefinition>): EntityDefinition {
    return {
        metadataId: '1',
        logicalName: 'account',
        schemaName: 'Account',
        displayName: 'Account',
        isCustom: false,
        ...overrides,
    };
}

function attr(overrides: Partial<AttributeDefinition>): AttributeDefinition {
    return {
        logicalName: 'field',
        schemaName: 'Field',
        displayName: 'Field',
        attributeType: 'String',
        isPrimaryId: false,
        isPrimaryName: false,
        ...overrides,
    };
}

type InsertInterfaceHandler = (
    uri: vscodeMock.Uri,
    lineNumber: number,
    character: number,
    entityLogicalName: string | null,
    selectFields: boolean,
    indent: string,
) => Promise<void>;

// Stubs vscode.commands.registerCommand, invokes registerInsertInterfaceCommand,
// and returns the captured handler function for direct invocation in tests.
function captureHandler(connectionManager: ConnectionManager, client: DataverseClient): InsertInterfaceHandler {
    let handler: InsertInterfaceHandler | undefined;
    sinon.stub(vscodeMock.commands, 'registerCommand').callsFake((..._args: unknown[]) => {
        handler = _args[1] as InsertInterfaceHandler;
        return new vscodeMock.Disposable();
    });
    const context = { subscriptions: [] as unknown[] };
    registerInsertInterfaceCommand(context as any, connectionManager, client);
    assert.ok(handler, 'expected registerCommand to have been called with a handler');
    return handler!;
}

describe('d365CodeActionProvider', () => {
    afterEach(() => {
        sinon.restore();
        vscodeMock.resetVscodeMock();
    });

    // ── D365CompletionProvider ──────────────────────────────────────────────

    describe('D365CompletionProvider.provideCompletionItems', () => {
        function fakeDocument(opts: { wordRange?: vscodeMock.Range; lineText: string; uri?: vscodeMock.Uri }) {
            return {
                uri: opts.uri ?? vscodeMock.Uri.file('/tmp/test.ts'),
                getWordRangeAtPosition: (_pos: unknown, _re: RegExp) => opts.wordRange,
                lineAt: (_n: number) => ({ text: opts.lineText }),
                getText: (_range: unknown) => 'd365',
            };
        }

        it('returns [] when the cursor is not on a d365 word', () => {
            const doc = fakeDocument({ wordRange: undefined, lineText: 'const x = 1;' });
            const provider = new D365CompletionProvider(fakeConnectionManager(true));
            const items = provider.provideCompletionItems(doc as any, { line: 0, character: 5 } as any);
            assert.deepStrictEqual(items, []);
        });

        it('returns [] on a `// @d365 <entity>` trigger line (defers to the lightbulb)', () => {
            const wordRange = new vscodeMock.Range(new vscodeMock.Position(2, 3), new vscodeMock.Position(2, 8));
            const doc = fakeDocument({ wordRange, lineText: '// @d365 account' });
            const provider = new D365CompletionProvider(fakeConnectionManager(true));
            const items = provider.provideCompletionItems(doc as any, { line: 2, character: 8 } as any);
            assert.deepStrictEqual(items, []);
        });

        it('returns two connected-labelled items with correct command arguments when connected', () => {
            const wordRange = new vscodeMock.Range(new vscodeMock.Position(3, 10), new vscodeMock.Position(3, 14));
            const doc = fakeDocument({ wordRange, lineText: 'const foo = d365' });
            const provider = new D365CompletionProvider(fakeConnectionManager(true));
            const items = provider.provideCompletionItems(doc as any, { line: 3, character: 14 } as any);

            assert.strictEqual(items.length, 2);
            for (const item of items) {
                assert.strictEqual(item.detail, 'D365 Dataverse');
            }
            assert.strictEqual(items[0].label, 'D365: Generate interface…');
            assert.strictEqual(items[1].label, 'D365: Generate interface (select fields…)');

            assert.deepStrictEqual((items[0] as any).command, {
                command: 'd365.codeAction.insertInterface',
                title: 'D365: Generate interface…',
                arguments: [doc.uri, wordRange.start.line, wordRange.start.character, null, false, ''],
            });
            assert.deepStrictEqual((items[1] as any).command, {
                command: 'd365.codeAction.insertInterface',
                title: 'D365: Generate interface (select fields…)',
                arguments: [doc.uri, wordRange.start.line, wordRange.start.character, null, true, ''],
            });
        });

        it('appends " — connect first" to both labels when disconnected', () => {
            const wordRange = new vscodeMock.Range(new vscodeMock.Position(0, 0), new vscodeMock.Position(0, 4));
            const doc = fakeDocument({ wordRange, lineText: 'd365' });
            const provider = new D365CompletionProvider(fakeConnectionManager(false));
            const items = provider.provideCompletionItems(doc as any, { line: 0, character: 4 } as any);

            assert.strictEqual(items.length, 2);
            assert.strictEqual(items[0].label, 'D365: Generate interface… — connect first');
            assert.strictEqual(items[1].label, 'D365: Generate interface (select fields…) — connect first');
        });
    });

    // ── D365CodeActionProvider ───────────────────────────────────────────────

    describe('D365CodeActionProvider.provideCodeActions', () => {
        function fakeDocument(lineText: string, uri = vscodeMock.Uri.file('/tmp/test.ts')) {
            return {
                uri,
                lineAt: (n: number) => ({ lineNumber: n, text: lineText }),
            };
        }

        it('returns [] when the line does not match the trigger pattern', () => {
            const doc = fakeDocument('const x = 1;');
            const range = new vscodeMock.Range(new vscodeMock.Position(0, 0), new vscodeMock.Position(0, 0));
            const provider = new D365CodeActionProvider(fakeConnectionManager(true));
            assert.deepStrictEqual(provider.provideCodeActions(doc as any, range as any), []);
        });

        it('returns two actions with correct titles/isPreferred/command args when connected', () => {
            const doc = fakeDocument('// @d365 account');
            const range = new vscodeMock.Range(new vscodeMock.Position(0, 0), new vscodeMock.Position(0, 0));
            const provider = new D365CodeActionProvider(fakeConnectionManager(true));
            const actions = provider.provideCodeActions(doc as any, range as any);

            assert.strictEqual(actions.length, 2);
            assert.ok(actions[0].title.includes("Generate interface for 'account'"));
            assert.ok(!actions[0].title.includes('select fields'));
            assert.ok(actions[1].title.includes("Generate interface for 'account'"));
            assert.ok(actions[1].title.includes('select fields'));

            assert.strictEqual(actions[0].isPreferred, true);
            assert.strictEqual(actions[1].isPreferred, false);

            assert.deepStrictEqual((actions[0] as any).command.arguments, [doc.uri, 0, -1, 'account', false, '']);
            assert.deepStrictEqual((actions[1] as any).command.arguments, [doc.uri, 0, -1, 'account', true, '']);
        });

        it('appends " (connect first)" and forces isPreferred=false on both actions when disconnected', () => {
            const doc = fakeDocument('// @d365 account');
            const range = new vscodeMock.Range(new vscodeMock.Position(0, 0), new vscodeMock.Position(0, 0));
            const provider = new D365CodeActionProvider(fakeConnectionManager(false));
            const actions = provider.provideCodeActions(doc as any, range as any);

            assert.ok(actions[0].title.endsWith(' (connect first)'));
            assert.ok(actions[1].title.endsWith(' (connect first)'));
            assert.strictEqual(actions[0].isPreferred, false);
            assert.strictEqual(actions[1].isPreferred, false);
        });

        it('captures leading whitespace as indent and passes it through as the last command argument', () => {
            const doc = fakeDocument('    // @d365 lead');
            const range = new vscodeMock.Range(new vscodeMock.Position(7, 0), new vscodeMock.Position(7, 0));
            const provider = new D365CodeActionProvider(fakeConnectionManager(true));
            const actions = provider.provideCodeActions(doc as any, range as any);

            assert.deepStrictEqual((actions[0] as any).command.arguments, [doc.uri, 7, -1, 'lead', false, '    ']);
            assert.deepStrictEqual((actions[1] as any).command.arguments, [doc.uri, 7, -1, 'lead', true, '    ']);
        });
    });

    // ── registerInsertInterfaceCommand ───────────────────────────────────────

    describe('registerInsertInterfaceCommand handler', () => {
        it('shows an error and does nothing else when not connected', async () => {
            const client = fakeClient();
            const handler = captureHandler(fakeConnectionManager(false), client);
            const errStub = sinon.stub(vscodeMock.window, 'showErrorMessage').resolves(undefined);

            await handler(vscodeMock.Uri.file('/tmp/x.ts'), 0, -1, 'account', false, '');

            assert.ok(errStub.calledWith('D365: Connect to an environment before generating interfaces.'));
            assert.ok((client.getEntities as sinon.SinonStub).notCalled);
            assert.ok((client.getAttributes as sinon.SinonStub).notCalled);
        });

        describe('entity selection (completion path, entityLogicalName === null)', () => {
            it('loads entities, lets the user pick one, then loads its attributes', async () => {
                const entities = [entity({ logicalName: 'account', displayName: 'Account' }), entity({ logicalName: 'contact', displayName: 'Contact', isCustom: true })];
                const getEntitiesStub = sinon.stub().resolves(entities);
                const getAttributesStub = sinon.stub().resolves([]);
                const client = fakeClient({ getEntities: getEntitiesStub, getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                sinon.stub(vscodeMock.window, 'showQuickPick').onCall(0).resolves({
                    label: 'Account', description: 'account', detail: undefined, entity: entities[0],
                });
                sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 5, -1, null, false, '');

                assert.ok(getEntitiesStub.calledOnce);
                assert.ok(getAttributesStub.calledOnceWith('account'));
            });

            it('returns early without loading attributes when the entity pick is cancelled', async () => {
                const entities = [entity({ logicalName: 'account' })];
                const getEntitiesStub = sinon.stub().resolves(entities);
                const getAttributesStub = sinon.stub().resolves([]);
                const client = fakeClient({ getEntities: getEntitiesStub, getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                sinon.stub(vscodeMock.window, 'showQuickPick').resolves(undefined);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 5, -1, null, false, '');

                assert.ok(getAttributesStub.notCalled);
            });

            it('shows an error and returns when getEntities() throws', async () => {
                const getEntitiesStub = sinon.stub().rejects(new Error('boom'));
                const getAttributesStub = sinon.stub().resolves([]);
                const client = fakeClient({ getEntities: getEntitiesStub, getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                const errStub = sinon.stub(vscodeMock.window, 'showErrorMessage').resolves(undefined);
                const quickPickStub = sinon.stub(vscodeMock.window, 'showQuickPick').resolves(undefined);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 5, -1, null, false, '');

                assert.ok(errStub.calledWith('D365: Failed to load entities.'));
                assert.ok(quickPickStub.notCalled);
                assert.ok(getAttributesStub.notCalled);
            });
        });

        describe('attribute loading', () => {
            it('shows an error mentioning the entity name and returns when getAttributes() throws', async () => {
                const getAttributesStub = sinon.stub().rejects(new Error('boom'));
                const client = fakeClient({ getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                const errStub = sinon.stub(vscodeMock.window, 'showErrorMessage').resolves(undefined);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 0, -1, 'account', false, '');

                assert.ok(errStub.calledOnce);
                assert.ok(String(errStub.firstCall.args[0]).includes('account'));
            });
        });

        describe('selectFields = true', () => {
            it('only includes picked attributes in the generated output', async () => {
                const allAttributes = [
                    attr({ logicalName: 'name', displayName: 'Name', isPrimaryName: true }),
                    attr({ logicalName: 'accountnumber', displayName: 'Account Number' }),
                    attr({ logicalName: 'revenue', displayName: 'Revenue', attributeType: 'Money' }),
                ];
                const getAttributesStub = sinon.stub().resolves(allAttributes);
                const client = fakeClient({ getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                sinon.stub(vscodeMock.window, 'showQuickPick').resolves([
                    { label: 'Name', description: 'name', detail: undefined, picked: true, attribute: allAttributes[0] },
                ]);
                const applyEditStub = sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 0, -1, 'account', true, '');

                assert.ok(applyEditStub.calledOnce);
                const edit: vscodeMock.WorkspaceEdit = applyEditStub.firstCall.args[0];
                const text = edit.edits[0].text;
                assert.ok(text.includes('name:'));
                assert.ok(!text.includes('accountnumber'));
                assert.ok(!text.includes('revenue'));
            });

            it('returns early without applying an edit when the field pick resolves empty/undefined', async () => {
                const allAttributes = [attr({ logicalName: 'name' })];
                const getAttributesStub = sinon.stub().resolves(allAttributes);
                const client = fakeClient({ getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                sinon.stub(vscodeMock.window, 'showQuickPick').resolves(undefined);
                const applyEditStub = sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 0, -1, 'account', true, '');

                assert.ok(applyEditStub.notCalled);
            });
        });

        describe('option-set attributes', () => {
            it('includes an export const enum block when getAttributeOptions succeeds', async () => {
                const allAttributes = [attr({ logicalName: 'statuscode', displayName: 'Status Reason', attributeType: 'Picklist' })];
                const getAttributesStub = sinon.stub().resolves(allAttributes);
                const getAttributeOptionsStub = sinon.stub().resolves([{ value: 1, label: 'Open' } as OptionValue]);
                const client = fakeClient({ getAttributes: getAttributesStub, getAttributeOptions: getAttributeOptionsStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                const applyEditStub = sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 0, -1, 'account', false, '');

                assert.ok(getAttributeOptionsStub.calledOnceWith('account', 'statuscode', 'Picklist'));
                const edit: vscodeMock.WorkspaceEdit = applyEditStub.firstCall.args[0];
                const text = edit.edits[0].text;
                assert.ok(text.includes('export const enum'));
                assert.ok(text.includes('statuscode: StatusReason;'));
            });

            it('falls back to a plain number-typed field when getAttributeOptions rejects', async () => {
                const allAttributes = [attr({ logicalName: 'statuscode', displayName: 'Status Reason', attributeType: 'Picklist' })];
                const getAttributesStub = sinon.stub().resolves(allAttributes);
                const getAttributeOptionsStub = sinon.stub().rejects(new Error('boom'));
                const client = fakeClient({ getAttributes: getAttributesStub, getAttributeOptions: getAttributeOptionsStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                const applyEditStub = sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 0, -1, 'account', false, '');

                const edit: vscodeMock.WorkspaceEdit = applyEditStub.firstCall.args[0];
                const text = edit.edits[0].text;
                assert.ok(!text.includes('export const enum'));
                assert.ok(text.includes('statuscode: number;'));
            });
        });

        describe('insertion', () => {
            it('replaces the whole trigger line when character === -1 (code action path)', async () => {
                const allAttributes = [attr({ logicalName: 'name' })];
                const getAttributesStub = sinon.stub().resolves(allAttributes);
                const client = fakeClient({ getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                const applyEditStub = sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);
                const uri = vscodeMock.Uri.file('/tmp/x.ts');

                await handler(uri, 4, -1, 'account', false, '');

                assert.ok(applyEditStub.calledOnce);
                const edit: vscodeMock.WorkspaceEdit = applyEditStub.firstCall.args[0];
                assert.strictEqual(edit.edits.length, 1);
                assert.strictEqual(edit.edits[0].type, 'replace');
                assert.strictEqual(edit.edits[0].uri, uri);
                assert.strictEqual(edit.edits[0].range?.start.line, 4);
                assert.ok(edit.edits[0].text.includes('name: string;'));
            });

            it('inserts at the given position when character >= 0 (completion path)', async () => {
                const allAttributes = [attr({ logicalName: 'name' })];
                const getAttributesStub = sinon.stub().resolves(allAttributes);
                const client = fakeClient({ getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                const applyEditStub = sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);
                const uri = vscodeMock.Uri.file('/tmp/x.ts');

                await handler(uri, 7, 12, 'account', false, '');

                assert.ok(applyEditStub.calledOnce);
                const edit: vscodeMock.WorkspaceEdit = applyEditStub.firstCall.args[0];
                assert.strictEqual(edit.edits.length, 1);
                assert.strictEqual(edit.edits[0].type, 'insert');
                assert.strictEqual(edit.edits[0].uri, uri);
                assert.deepStrictEqual(edit.edits[0].position, new vscodeMock.Position(7, 12));
                assert.ok(edit.edits[0].text.includes('name: string;'));
            });

            it('prefixes every non-empty line of the generated text with the supplied indent', async () => {
                const allAttributes = [attr({ logicalName: 'name' })];
                const getAttributesStub = sinon.stub().resolves(allAttributes);
                const client = fakeClient({ getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                const applyEditStub = sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 0, -1, 'account', false, '    ');

                const edit: vscodeMock.WorkspaceEdit = applyEditStub.firstCall.args[0];
                const lines = edit.edits[0].text.split('\n');
                for (const line of lines) {
                    if (line.length === 0) { continue; }
                    assert.ok(line.startsWith('    '), `expected indented line, got: ${JSON.stringify(line)}`);
                }
            });

            it('calls vscode.workspace.applyEdit with the constructed edit', async () => {
                const allAttributes = [attr({ logicalName: 'name' })];
                const getAttributesStub = sinon.stub().resolves(allAttributes);
                const client = fakeClient({ getAttributes: getAttributesStub });
                const handler = captureHandler(fakeConnectionManager(true), client);

                const applyEditStub = sinon.stub(vscodeMock.workspace, 'applyEdit').resolves(true);

                await handler(vscodeMock.Uri.file('/tmp/x.ts'), 0, -1, 'account', false, '');

                assert.ok(applyEditStub.calledOnce);
                assert.ok(applyEditStub.firstCall.args[0] instanceof vscodeMock.WorkspaceEdit);
            });
        });
    });
});
