import { expect } from 'chai';
import { request, clearDatabase, createClient, expectError, NON_EXISTENT_ID } from './helpers.js';

describe('Users - /api/users', () => {
  beforeEach(clearDatabase);

  describe('GET /api/users', () => {
    it('devuelve una lista vacía si no hay usuarios', async () => {
      const res = await request.get('/api/users');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('payload').that.is.an('array').that.is.empty;
    });

    it('devuelve los usuarios ordenados por nombre y sin contraseña', async () => {
      await createClient({ name: 'Zoe' });
      await createClient({ name: 'Ana' });

      const res = await request.get('/api/users');

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.have.lengthOf(2);
      expect(res.body.payload.map((user) => user.name)).to.deep.equal(['Ana', 'Zoe']);
      res.body.payload.forEach((user) => {
        expect(user).to.include.all.keys('_id', 'name', 'email', 'role');
        expect(user).to.not.have.property('password');
      });
    });
  });

  describe('POST /api/users', () => {
    it('crea un usuario con rol USER y no devuelve la contraseña', async () => {
      const res = await request
        .post('/api/users')
        .send({ name: 'Ana Test', email: 'ana@test.com', password: '12345678', role: 'ADMIN' });

      expect(res.status).to.equal(201);
      expect(res.body.payload).to.include({ name: 'Ana Test', email: 'ana@test.com', role: 'USER' });
      expect(res.body.payload).to.have.property('_id');
      expect(res.body.payload).to.not.have.property('password');
    });

    it('responde 400 INVALID_PASSWORD si falta la contraseña', async () => {
      const res = await request.post('/api/users').send({ name: 'Ana', email: 'ana@test.com' });

      expectError(res, 400, 'INVALID_PASSWORD');
      expect(res.body.details).to.deep.equal({ minLength: 8 });
    });

    it('responde 400 VALIDATION_ERROR si faltan datos obligatorios', async () => {
      const res = await request.post('/api/users').send({ password: '12345678' });

      expectError(res, 400, 'VALIDATION_ERROR');
      const fields = res.body.details.fields.map((field) => field.field);
      expect(fields).to.include.members(['name', 'email']);
    });

    it('responde 409 DUPLICATE_KEY si el email ya existe', async () => {
      await createClient({ email: 'repetido@test.com' });

      const res = await request
        .post('/api/users')
        .send({ name: 'Otro', email: 'repetido@test.com', password: '12345678' });

      expectError(res, 409, 'DUPLICATE_KEY');
      expect(res.body.details.fields).to.include('email');
    });
  });

  describe('GET /api/users/:id', () => {
    it('devuelve el usuario pedido', async () => {
      const user = await createClient();

      const res = await request.get(`/api/users/${user._id}`);

      expect(res.status).to.equal(200);
      expect(res.body.payload).to.include({ _id: String(user._id), email: user.email, role: 'USER' });
    });

    it('responde 404 USER_NOT_FOUND si el usuario no existe', async () => {
      const res = await request.get(`/api/users/${NON_EXISTENT_ID}`);

      expectError(res, 404, 'USER_NOT_FOUND');
      expect(res.body.details).to.deep.equal({ id: NON_EXISTENT_ID });
    });

    it('responde 400 INVALID_ID si el id no tiene formato válido', async () => {
      const res = await request.get('/api/users/123');

      expectError(res, 400, 'INVALID_ID');
    });
  });
});
