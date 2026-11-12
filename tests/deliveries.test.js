import { expect } from 'chai';
import { DeliveryModel } from '../src/models/delivery.model.js';
import {
  request,
  clearDatabase,
  createClient,
  createDriver,
  createOrder,
  expectError,
  NON_EXISTENT_ID,
} from './helpers.js';

describe('Deliveries - /api/deliveries', () => {
  let client;
  let driver;
  let delivery;

  // Cada test arranca con un cliente, un repartidor y un pedido con su entrega
  beforeEach(async () => {
    await clearDatabase();
    client = await createClient();
    driver = await createDriver();
    const order = await createOrder(client._id);
    delivery = await DeliveryModel.findOne({ order: order._id }).lean();
  });

  const changeStatus = (body) => request.patch(`/api/deliveries/${delivery._id}/status`).send(body);

  describe('GET /api/deliveries', () => {
    it('devuelve las entregas con su pedido', async () => {
      const res = await request.get('/api/deliveries');

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.have.lengthOf(1);
      expect(res.body.payload[0]).to.include({ status: 'PENDING_ASSIGNMENT', driver: null });
      expect(res.body.payload[0].order).to.include({ status: 'PENDING', total: 3300 });
    });
  });

  describe('GET /api/deliveries/:id', () => {
    it('devuelve la entrega pedida', async () => {
      const res = await request.get(`/api/deliveries/${delivery._id}`);

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.include({ _id: String(delivery._id), status: 'PENDING_ASSIGNMENT' });
    });

    it('responde 404 DELIVERY_NOT_FOUND si la entrega no existe', async () => {
      const res = await request.get(`/api/deliveries/${NON_EXISTENT_ID}`);

      expectError(res, 404, 'DELIVERY_NOT_FOUND');
    });

    it('responde 400 INVALID_ID si el id no tiene formato válido', async () => {
      const res = await request.get('/api/deliveries/123');

      expectError(res, 400, 'INVALID_ID');
    });
  });

  describe('PATCH /api/deliveries/:id/status', () => {
    it('asigna un repartidor al pasar a ASSIGNED', async () => {
      const res = await changeStatus({ status: 'ASSIGNED', driver: String(driver._id) });

      expect(res.status).to.equal(200);
      expect(res.body.payload.status).to.equal('ASSIGNED');
      expect(res.body.payload.driver).to.include({ _id: String(driver._id), name: driver.name });
    });

    it('guarda la fecha de entrega al llegar a DELIVERED', async () => {
      await changeStatus({ status: 'ASSIGNED', driver: String(driver._id) });
      await changeStatus({ status: 'IN_TRANSIT' });

      const res = await changeStatus({ status: 'DELIVERED' });

      expect(res.status).to.equal(200);
      expect(res.body.payload.status).to.equal('DELIVERED');
      expect(res.body.payload.deliveredAt).to.be.a('string');
    });

    it('responde 400 INVALID_DELIVERY_DRIVER si se asigna sin repartidor', async () => {
      const res = await changeStatus({ status: 'ASSIGNED' });

      expectError(res, 400, 'INVALID_DELIVERY_DRIVER');
    });

    it('responde 400 INVALID_DELIVERY_DRIVER si el usuario no es repartidor', async () => {
      const res = await changeStatus({ status: 'ASSIGNED', driver: String(client._id) });

      expectError(res, 400, 'INVALID_DELIVERY_DRIVER');
      expect(res.body.details).to.include({ role: 'USER' });
    });

    it('responde 400 INVALID_DELIVERY_STATUS si el cambio no está permitido', async () => {
      const res = await changeStatus({ status: 'DELIVERED' });

      expectError(res, 400, 'INVALID_DELIVERY_STATUS');
      expect(res.body.details).to.deep.equal({
        current: 'PENDING_ASSIGNMENT',
        received: 'DELIVERED',
        allowed: ['ASSIGNED', 'CANCELLED'],
      });
    });

    it('responde 404 DELIVERY_NOT_FOUND si la entrega no existe', async () => {
      const res = await request.patch(`/api/deliveries/${NON_EXISTENT_ID}/status`).send({ status: 'CANCELLED' });

      expectError(res, 404, 'DELIVERY_NOT_FOUND');
    });
  });
});
