import { expect } from 'chai';
import { DeliveryModel } from '../src/models/delivery.model.js';
import {
  request,
  clearDatabase,
  createClient,
  createDriver,
  createOrder,
  validOrderBody,
  expectError,
  NON_EXISTENT_ID,
} from './helpers.js';

describe('Orders - /api/orders', () => {
  let client;

  beforeEach(async () => {
    await clearDatabase();
    client = await createClient();
  });

  describe('GET /api/orders', () => {
    it('devuelve una lista vacía si no hay pedidos', async () => {
      const res = await request.get('/api/orders');

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.be.an('array').that.is.empty;
    });

    it('devuelve los pedidos con los datos del cliente', async () => {
      await createOrder(client._id);

      const res = await request.get('/api/orders');

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.have.lengthOf(1);
      expect(res.body.payload[0]).to.include.all.keys('_id', 'user', 'address', 'items', 'total', 'status', 'priority');
      expect(res.body.payload[0].user).to.include({ _id: String(client._id), name: client.name });
    });
  });

  describe('POST /api/orders', () => {
    it('crea un pedido PENDING y calcula el total a partir de los items', async () => {
      const res = await request.post('/api/orders').send({ ...validOrderBody(client._id), total: 1 });

      expect(res.status).to.equal(201);
      expect(res.body.payload).to.include({ status: 'PENDING', priority: 'HIGH', total: 3300 });
      expect(res.body.payload.items).to.have.lengthOf(2);
      expect(res.body.payload.items[0]).to.include({ description: 'Caja mediana', quantity: 2, unitPrice: 1500 });
    });

    it('crea la entrega del pedido sin repartidor', async () => {
      const order = await createOrder(client._id);

      const delivery = await DeliveryModel.findOne({ order: order._id }).lean();

      expect(delivery).to.not.equal(null);
      expect(delivery.status).to.equal('PENDING_ASSIGNMENT');
      expect(delivery.driver).to.equal(null);
    });

    it('responde 400 INVALID_ORDER_ITEMS si no tiene items', async () => {
      const res = await request.post('/api/orders').send({ ...validOrderBody(client._id), items: [] });

      expectError(res, 400, 'INVALID_ORDER_ITEMS');
    });

    it('responde 400 VALIDATION_ERROR si falta la dirección', async () => {
      const { address, ...body } = validOrderBody(client._id);

      const res = await request.post('/api/orders').send(body);

      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.details.fields.map((field) => field.field)).to.include('address');
    });

    it('responde 400 INVALID_ORDER_USER si el usuario es un repartidor', async () => {
      const driver = await createDriver();

      const res = await request.post('/api/orders').send(validOrderBody(driver._id));

      expectError(res, 400, 'INVALID_ORDER_USER');
      expect(res.body.details).to.include({ role: 'DRIVER' });
    });

    it('responde 404 USER_NOT_FOUND si el usuario no existe', async () => {
      const res = await request.post('/api/orders').send(validOrderBody(NON_EXISTENT_ID));

      expectError(res, 404, 'USER_NOT_FOUND');
    });

    it('responde 400 INVALID_JSON si el body no es JSON válido', async () => {
      const res = await request.post('/api/orders').set('Content-Type', 'application/json').send('{malo');

      expectError(res, 400, 'INVALID_JSON');
    });
  });

  describe('GET /api/orders/:id', () => {
    it('devuelve el pedido pedido', async () => {
      const order = await createOrder(client._id);

      const res = await request.get(`/api/orders/${order._id}`);

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.include({ _id: order._id, total: 3300, status: 'PENDING' });
      expect(res.body.payload.user).to.include({ email: client.email });
    });

    it('responde 404 ORDER_NOT_FOUND si el pedido no existe', async () => {
      const res = await request.get(`/api/orders/${NON_EXISTENT_ID}`);

      expectError(res, 404, 'ORDER_NOT_FOUND');
      expect(res.body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });

    it('responde 400 INVALID_ID si el id no tiene formato válido', async () => {
      const res = await request.get('/api/orders/123');

      expectError(res, 400, 'INVALID_ID');
    });
  });

  describe('PATCH /api/orders/:id/status', () => {
    it('cambia el estado si el cambio está permitido', async () => {
      const order = await createOrder(client._id);

      const res = await request.patch(`/api/orders/${order._id}/status`).send({ status: 'PREPARING' });

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.include({ _id: order._id, status: 'PREPARING' });
    });

    it('responde 400 INVALID_ORDER_STATUS si el cambio no está permitido', async () => {
      const order = await createOrder(client._id);

      const res = await request.patch(`/api/orders/${order._id}/status`).send({ status: 'DELIVERED' });

      expectError(res, 400, 'INVALID_ORDER_STATUS');
      expect(res.body.details).to.deep.equal({
        current: 'PENDING',
        received: 'DELIVERED',
        allowed: ['PREPARING', 'CANCELLED'],
      });
    });

    it('responde 400 INVALID_ORDER_STATUS si el estado no existe', async () => {
      const order = await createOrder(client._id);

      const res = await request.patch(`/api/orders/${order._id}/status`).send({ status: 'VOLANDO' });

      expectError(res, 400, 'INVALID_ORDER_STATUS');
    });

    it('responde 404 ORDER_NOT_FOUND si el pedido no existe', async () => {
      const res = await request.patch(`/api/orders/${NON_EXISTENT_ID}/status`).send({ status: 'PREPARING' });

      expectError(res, 404, 'ORDER_NOT_FOUND');
    });
  });
});
