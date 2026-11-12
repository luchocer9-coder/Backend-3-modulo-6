import { expect } from 'chai';
import { request, expectError } from './helpers.js';

describe('General', () => {
  it('GET /api/health responde que el servidor está activo', async () => {
    const res = await request.get('/api/health');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ status: 'ok' });
  });

  it('una ruta inexistente responde 404 ROUTE_NOT_FOUND', async () => {
    const res = await request.get('/api/no-existe');

    expectError(res, 404, 'ROUTE_NOT_FOUND');
    expect(res.body.details).to.deep.equal({ method: 'GET', path: '/api/no-existe' });
    expect(res.body.path).to.equal('/api/no-existe');
  });
});
