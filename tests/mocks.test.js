import { expect } from 'chai';
import { UserModel } from '../src/models/user.model.js';
import { OrderModel } from '../src/models/order.model.js';
import { DeliveryModel } from '../src/models/delivery.model.js';
import { request, clearDatabase, expectError } from './helpers.js';

const INVALID_QTYS = ['abc', '0', '101', '2.5'];

describe('Mocks - /api/mocks', () => {
  beforeEach(clearDatabase);

  describe('GET /api/mocks/users', () => {
    it('genera la cantidad pedida de usuarios sin guardarlos', async () => {
      const res = await request.get('/api/mocks/users?qty=3');

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array').with.lengthOf(3);
      res.body.forEach((user) => {
        expect(user).to.have.all.keys('_id', 'name', 'email', 'role');
        expect(['USER', 'DRIVER']).to.include(user.role);
      });
      expect(await UserModel.countDocuments()).to.equal(0);
    });

    it('genera 5 usuarios si no se envía qty', async () => {
      const res = await request.get('/api/mocks/users');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.lengthOf(5);
    });

    it('responde 400 NEGATIVE_MOCK_QTY si qty es negativo', async () => {
      const res = await request.get('/api/mocks/users?qty=-3');

      expectError(res, 400, 'NEGATIVE_MOCK_QTY');
      expect(res.body.details).to.deep.equal({ received: -3 });
    });

    INVALID_QTYS.forEach((qty) => {
      it(`responde 400 INVALID_MOCK_QTY con qty=${qty}`, async () => {
        const res = await request.get(`/api/mocks/users?qty=${qty}`);

        expectError(res, 400, 'INVALID_MOCK_QTY');
      });
    });
  });

  describe('GET /api/mocks/drivers', () => {
    it('genera solo repartidores', async () => {
      const res = await request.get('/api/mocks/drivers?qty=4');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.lengthOf(4);
      res.body.forEach((driver) => expect(driver.role).to.equal('DRIVER'));
    });
  });

  describe('GET /api/mocks/dataset', () => {
    it('genera pedidos y entregas relacionados entre sí', async () => {
      const res = await request.get('/api/mocks/dataset?qty=6');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.all.keys('users', 'orders', 'deliveries');
      expect(res.body.orders).to.have.lengthOf(6);
      expect(res.body.deliveries).to.have.lengthOf(6);

      const roleById = Object.fromEntries(res.body.users.map((user) => [user._id, user.role]));
      const orderIds = res.body.orders.map((order) => order._id);

      res.body.orders.forEach((order) => {
        expect(roleById[order.user]).to.equal('USER');
        expect(order.items).to.be.an('array').that.is.not.empty;
      });
      res.body.deliveries.forEach((delivery) => {
        expect(orderIds).to.include(delivery.order);
        if (delivery.driver) expect(roleById[delivery.driver]).to.equal('DRIVER');
      });
    });

    it('responde 400 INVALID_MOCK_QTY con una cantidad fuera de rango', async () => {
      const res = await request.get('/api/mocks/dataset?qty=500');

      expectError(res, 400, 'INVALID_MOCK_QTY');
      expect(res.body.details).to.deep.equal({ received: 500, min: 1, max: 100 });
    });
  });

  describe('POST /api/mocks/seed', () => {
    it('inserta los usuarios pedidos en la base', async () => {
      const res = await request.post('/api/mocks/seed?qty=5');

      expect(res.status).to.equal(201);
      expect(res.body).to.deep.equal({ insertados: 5, coleccion: 'users' });
      expect(await UserModel.countDocuments()).to.equal(5);
    });

    it('responde 400 NEGATIVE_MOCK_QTY y no guarda nada', async () => {
      const res = await request.post('/api/mocks/seed?qty=-1');

      expectError(res, 400, 'NEGATIVE_MOCK_QTY');
      expect(await UserModel.countDocuments()).to.equal(0);
    });
  });

  describe('POST /api/mocks/seed/dataset', () => {
    it('inserta usuarios, pedidos y entregas relacionados', async () => {
      const res = await request.post('/api/mocks/seed/dataset?qty=4');

      expect(res.status).to.equal(201);
      expect(res.body.insertados).to.deep.equal({ users: 4, orders: 4, deliveries: 4 });
      expect(await UserModel.countDocuments()).to.equal(4);
      expect(await OrderModel.countDocuments()).to.equal(4);
      expect(await DeliveryModel.countDocuments()).to.equal(4);
    });

    it('responde 400 INVALID_MOCK_QTY y no guarda nada', async () => {
      const res = await request.post('/api/mocks/seed/dataset?qty=abc');

      expectError(res, 400, 'INVALID_MOCK_QTY');
      expect(await OrderModel.countDocuments()).to.equal(0);
    });
  });
});
