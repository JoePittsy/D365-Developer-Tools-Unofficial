import * as assert from 'assert';
import { generateEnum, generateInterface, toPascalCase, OPTION_SET_TYPES } from '../../src/interfaceGenerator';
import type { AttributeDefinition, OptionValue } from '../../src/dataverseClient';

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

describe('interfaceGenerator', () => {
    describe('toPascalCase', () => {
        it('capitalizes each word and strips separators', () => {
            assert.strictEqual(toPascalCase('account name'), 'AccountName');
            assert.strictEqual(toPascalCase('new_customfield'), 'NewCustomfield');
            assert.strictEqual(toPascalCase('already-Pascal Case'), 'AlreadyPascalCase');
        });

        it('prefixes with an underscore when the result starts with a digit', () => {
            assert.strictEqual(toPascalCase('365 field'), '_365Field');
        });

        it('collapses to empty string for input with no alphanumerics', () => {
            assert.strictEqual(toPascalCase('---'), '');
        });
    });

    describe('generateEnum', () => {
        it('emits a const enum with sanitized, Pascal-cased member names', () => {
            const options: OptionValue[] = [
                { value: 1, label: 'Open' },
                { value: 2, label: 'In Progress' },
                { value: 3, label: '5th Stage' },
            ];
            const result = generateEnum('statuscode', 'Status Reason', options);
            assert.strictEqual(
                result,
                'export const enum StatusReason {\n' +
                '    Open = 1,\n' +
                '    InProgress = 2,\n' +
                '    _5thStage = 3,\n' +
                '}',
            );
        });

        it('falls back to the logical name when no display name is given', () => {
            const result = generateEnum('statuscode', '', [{ value: 1, label: 'Open' }]);
            assert.match(result, /^export const enum Statuscode /);
        });

        it('falls back to "Unknown" for a label with no alphanumeric characters', () => {
            const result = generateEnum('x', 'X', [{ value: 1, label: '###' }]);
            assert.match(result, /Unknown = 1,/);
        });
    });

    describe('generateInterface', () => {
        it('maps primitive attribute types to TypeScript types', () => {
            const attrs = [
                attr({ logicalName: 'name', attributeType: 'String' }),
                attr({ logicalName: 'revenue', attributeType: 'Money' }),
                attr({ logicalName: 'donotemail', attributeType: 'Boolean' }),
                attr({ logicalName: 'unknowntype', attributeType: 'SomeExoticType' }),
            ];
            const result = generateInterface('account', 'Account', attrs);
            assert.match(result, /name: string;/);
            assert.match(result, /revenue: number;/);
            assert.match(result, /donotemail: boolean;/);
            assert.match(result, /unknowntype: unknown;/);
        });

        it('renames lookup fields to the _value convention and adds a formatted-value companion field', () => {
            const attrs = [attr({ logicalName: 'ownerid', attributeType: 'Owner' })];
            const result = generateInterface('account', 'Account', attrs);
            assert.match(result, /_ownerid_value: string \| null;/);
            assert.match(result, /'_ownerid_value@OData\.Community\.Display\.V1\.FormattedValue'\?: string;/);
        });

        it('uses the supplied enum name for option-set attributes instead of number', () => {
            const attrs = [attr({ logicalName: 'statuscode', attributeType: 'Status' })];
            const enumNames = new Map([['statuscode', 'StatusReason']]);
            const result = generateInterface('account', 'Account', attrs, enumNames);
            assert.match(result, /statuscode: StatusReason;/);
        });

        it('falls back to number for an option-set attribute with no enum name provided', () => {
            const attrs = [attr({ logicalName: 'statuscode', attributeType: 'Picklist' })];
            const result = generateInterface('account', 'Account', attrs);
            assert.match(result, /statuscode: number;/);
        });

        it('annotates primary id, primary name, and DateTime fields with a doc comment', () => {
            const attrs = [
                attr({ logicalName: 'accountid', isPrimaryId: true }),
                attr({ logicalName: 'name', isPrimaryName: true }),
                attr({ logicalName: 'createdon', attributeType: 'DateTime' }),
            ];
            const result = generateInterface('account', 'Account', attrs);
            assert.match(result, /\/\*\* Primary ID \*\//);
            assert.match(result, /\/\*\* Primary Name \*\//);
            assert.match(result, /\/\*\* ISO 8601 string \*\//);
        });

        it('includes the entity name header and interface declaration', () => {
            const result = generateInterface('account', 'Account', []);
            assert.match(result, /^\/\/ Account \(account\)/);
            assert.match(result, /export interface Account \{/);
        });
    });

    describe('OPTION_SET_TYPES', () => {
        it('includes Picklist, State and Status', () => {
            assert.ok(OPTION_SET_TYPES.has('Picklist'));
            assert.ok(OPTION_SET_TYPES.has('State'));
            assert.ok(OPTION_SET_TYPES.has('Status'));
            assert.ok(!OPTION_SET_TYPES.has('String'));
        });
    });
});
