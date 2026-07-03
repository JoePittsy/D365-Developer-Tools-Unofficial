// Intercepts require('vscode') so source files under test resolve to our hand-written
// mock instead of failing (the real 'vscode' module only exists inside a running
// VS Code Extension Host). Must be loaded via mocha's `require` list AFTER ts-node/register
// so the .ts mock file itself can be require()'d.
const Module = require('module');
const path = require('path');

const mockPath = path.join(__dirname, 'vscode.ts');
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
    if (request === 'vscode') {
        return originalLoad.call(this, mockPath, parent, isMain);
    }
    return originalLoad.apply(this, arguments);
};
