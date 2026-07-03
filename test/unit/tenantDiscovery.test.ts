import * as assert from 'assert';
import * as sinon from 'sinon';
import { discoverTenantId } from '../../src/auth/tenantDiscovery';

function fakeResponse(status: number, headers: Record<string, string> = {}): any {
    return {
        status,
        headers: {
            get: (name: string): string | null => {
                const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
                return key ? headers[key] : null;
            },
        },
    };
}

describe('tenantDiscovery.discoverTenantId', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('resolves to the tenant GUID parsed from the WWW-Authenticate header', async () => {
        const fetchStub = sinon.stub(global, 'fetch' as any).resolves(
            fakeResponse(401, {
                'WWW-Authenticate':
                    'Bearer authorization_uri="https://login.microsoftonline.com/11111111-1111-1111-1111-111111111111/oauth2/authorize", resource="https://contoso.crm.dynamics.com"',
            }),
        );

        const tenantId = await discoverTenantId('https://contoso.crm.dynamics.com');

        assert.strictEqual(tenantId, '11111111-1111-1111-1111-111111111111');
        sinon.assert.calledOnce(fetchStub);
    });

    it('throws when the response status is not 401 (e.g. 200)', async () => {
        sinon.stub(global, 'fetch' as any).resolves(fakeResponse(200));

        await assert.rejects(
            () => discoverTenantId('https://contoso.crm.dynamics.com'),
            (err: Error) => {
                assert.match(err.message, /https:\/\/contoso\.crm\.dynamics\.com/);
                assert.match(err.message, /200/);
                return true;
            },
        );
    });

    it('throws when the response status is not 401 (e.g. 404)', async () => {
        sinon.stub(global, 'fetch' as any).resolves(fakeResponse(404));

        await assert.rejects(
            () => discoverTenantId('https://contoso.crm.dynamics.com'),
            (err: Error) => {
                assert.match(err.message, /https:\/\/contoso\.crm\.dynamics\.com/);
                assert.match(err.message, /404/);
                return true;
            },
        );
    });

    it('throws when there is no WWW-Authenticate header at all', async () => {
        sinon.stub(global, 'fetch' as any).resolves(fakeResponse(401));

        await assert.rejects(
            () => discoverTenantId('https://contoso.crm.dynamics.com'),
            /No WWW-Authenticate header/,
        );
    });

    it('throws when the WWW-Authenticate header does not match the expected pattern', async () => {
        sinon.stub(global, 'fetch' as any).resolves(
            fakeResponse(401, { 'WWW-Authenticate': 'Bearer realm="something-unexpected"' }),
        );

        await assert.rejects(
            () => discoverTenantId('https://contoso.crm.dynamics.com'),
            /Could not parse tenant ID from WWW-Authenticate header/,
        );
    });

    it('requests the correct URL with an Accept: application/json header', async () => {
        const fetchStub = sinon.stub(global, 'fetch' as any).resolves(
            fakeResponse(401, {
                'WWW-Authenticate':
                    'Bearer authorization_uri="https://login.microsoftonline.com/22222222-2222-2222-2222-222222222222/oauth2/authorize"',
            }),
        );

        await discoverTenantId('https://fabrikam.crm4.dynamics.com');

        sinon.assert.calledOnce(fetchStub);
        const [url, options] = fetchStub.getCall(0).args as [string, RequestInit];
        assert.strictEqual(url, 'https://fabrikam.crm4.dynamics.com/api/data/v9.2/');
        assert.strictEqual((options.headers as Record<string, string>).Accept, 'application/json');
    });
});
