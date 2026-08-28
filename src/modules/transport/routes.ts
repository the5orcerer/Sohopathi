import { Request, Response } from 'express';
import { PoolClient } from 'pg';
import { transportRepository } from './repository';

export async function listRoutes(req: Request, res: Response, client: PoolClient) {
  const routes = await transportRepository.listRoutes(client, req.ctx!.institutionId);
  res.json(routes);
}

export async function createRoute(req: Request, res: Response, client: PoolClient) {
  const route = await transportRepository.createRoute(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(route);
}

export async function listVehicles(req: Request, res: Response, client: PoolClient) {
  const vehicles = await transportRepository.listVehicles(client, req.ctx!.institutionId);
  res.json(vehicles);
}

export async function createVehicle(req: Request, res: Response, client: PoolClient) {
  const vehicle = await transportRepository.createVehicle(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(vehicle);
}

export async function createDriver(req: Request, res: Response, client: PoolClient) {
  const driver = await transportRepository.createDriver(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(driver);
}

export async function assignDriverToRoute(req: Request, res: Response, client: PoolClient) {
  const routeId = req.params.id;
  const { driverId } = req.body;
  await transportRepository.assignDriverToRoute(
    client,
    req.ctx!.institutionId,
    routeId,
    driverId,
    req.ctx?.membershipId
  );
  res.status(200).json({ success: true });
}

export async function getMyRoute(req: Request, res: Response, client: PoolClient) {
  const routeInfo = await transportRepository.getMyRoute(client, req.ctx!.institutionId, req.ctx!.userId);
  res.json(routeInfo ?? {});
}

export async function updateVehicleLocation(req: Request, res: Response, client: PoolClient) {
  const vehicleId = req.params.id;
  const { latitude, longitude } = req.body;
  res.status(200).json({ vehicleId, latitude, longitude, updatedAt: new Date().toISOString() });
}

export async function assignStudentTransport(req: Request, res: Response, client: PoolClient) {
  const assignment = await transportRepository.assignStudentToRoute(
    client,
    req.ctx!.institutionId,
    req.body,
    req.ctx?.membershipId
  );
  res.status(201).json(assignment);
}
