import { expect } from 'chai';
import { openapiSpec } from '../src/docs/openapi.js';
import { request, clearDatabase, NON_EXISTENT_ID } from './helpers.js';

describe('Swagger - /api/docs', () => {
  it('sirve la página de Swagger UI', async () => {
    const res = await request.get('/api/docs/');

    expect(res.status).to.equal(200);
    expect(res.headers['content-type']).to.include('text/html');
    expect(res.text).to.include('swagger-ui');
  });

  it('redirige /api/docs a /api/docs/', async () => {
    const res = await request.get('/api/docs');

    expect(res.status).to.equal(301);
    expect(res.headers.location).to.equal('/api/docs/');
  });

  it('incluye la documentación de ShipNow', async () => {
    const res = await request.get('/api/docs/swagger-ui-init.js');

    expect(res.status).to.equal(200);
    expect(res.text).to.include('ShipNow API');
  });
});

// Recorre todos los endpoints documentados en Swagger y comprueba que existen
// y que responden con alguno de los status que dice la documentación
describe('Coherencia entre Swagger y la API', () => {
  before(clearDatabase);
  after(clearDatabase);

  const operations = Object.entries(openapiSpec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({ path, method, operation })),
  );

  operations.forEach(({ path, method, operation }) => {
    it(`${method.toUpperCase()} ${path} responde un status documentado`, async () => {
      const url = path.replace('{id}', NON_EXISTENT_ID);

      const res = await request[method](url).send({});

      const documented = Object.keys(operation.responses).map(Number);
      expect(res.body.code, 'la ruta tiene que existir').to.not.equal('ROUTE_NOT_FOUND');
      expect(documented, `status ${res.status} no documentado`).to.include(res.status);
    });
  });
});
