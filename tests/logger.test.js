import { expect } from 'chai';
import { request } from './helpers.js';

describe('Logger - /api/loggerTest', () => {
  it('genera un log en cada nivel y responde cuáles se ven', async () => {
    const res = await request.get('/api/loggerTest');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.all.keys('message', 'levels', 'minLevel', 'visibleLevels', 'files');
    expect(res.body.levels).to.deep.equal(['fatal', 'error', 'warning', 'info', 'http', 'debug']);
    expect(res.body.minLevel).to.equal('debug');
    expect(res.body.visibleLevels).to.deep.equal(res.body.levels);
    expect(res.body.files).to.have.all.keys('error', 'combined');
  });

  it('solo acepta GET: otro método responde 404 ROUTE_NOT_FOUND', async () => {
    const res = await request.post('/api/loggerTest');

    expect(res.status).to.equal(404);
    expect(res.body.code).to.equal('ROUTE_NOT_FOUND');
  });
});
