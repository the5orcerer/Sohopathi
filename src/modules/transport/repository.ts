import { PoolClient } from 'pg';
import { logAudit } from '../../core/audit/audit-logger';

export interface Vehicle {
  id: string;
  institutionId: string;
  registrationNo: string;
  capacity: number | null;
}

export interface TransportDriver {
  id: string;
  institutionId: string;
  userId: string | null;
  name: string;
  licenseNo: string | null;
}

export interface TransportRoute {
  id: string;
  institutionId: string;
  name: string;
  vehicleId: string | null;
  driverId: string | null;
  vehicleRegistration?: string;
  driverName?: string;
}

export interface TransportStop {
  id: string;
  institutionId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface StudentTransportAssignment {
  id: string;
  institutionId: string;
  studentId: string;
  routeId: string;
  stopId: string | null;
  routeName?: string;
  stopName?: string;
}

export const transportRepository = {
  // --- Vehicles ---
  async createVehicle(
    client: PoolClient,
    institutionId: string,
    data: { registrationNo: string; capacity?: number },
    actorMembershipId?: string
  ): Promise<Vehicle> {
    const { rows } = await client.query(
      `insert into vehicle (institution_id, registration_no, capacity)
       values ($1, $2, $3)
       returning id, institution_id as "institutionId", registration_no as "registrationNo", capacity`,
      [institutionId, data.registrationNo, data.capacity ?? null]
    );
    const v = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create',
      entityType: 'vehicle',
      entityId: v.id,
      after: v,
    });
    return v;
  },

  async listVehicles(client: PoolClient, institutionId: string): Promise<Vehicle[]> {
    const { rows } = await client.query(
      `select id, institution_id as "institutionId", registration_no as "registrationNo", capacity
       from vehicle order by registration_no`,
      []
    );
    return rows;
  },

  // --- Drivers ---
  async createDriver(
    client: PoolClient,
    institutionId: string,
    data: { name: string; userId?: string; licenseNo?: string },
    actorMembershipId?: string
  ): Promise<TransportDriver> {
    const { rows } = await client.query(
      `insert into transport_driver (institution_id, user_id, name, license_no)
       values ($1, $2, $3, $4)
       returning id, institution_id as "institutionId", user_id as "userId", name, license_no as "licenseNo"`,
      [institutionId, data.userId ?? null, data.name, data.licenseNo ?? null]
    );
    const d = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create',
      entityType: 'transport_driver',
      entityId: d.id,
      after: d,
    });
    return d;
  },

  // --- Routes ---
  async createRoute(
    client: PoolClient,
    institutionId: string,
    data: { name: string; vehicleId?: string; driverId?: string },
    actorMembershipId?: string
  ): Promise<TransportRoute> {
    const { rows } = await client.query(
      `insert into transport_route (institution_id, name, vehicle_id, driver_id)
       values ($1, $2, $3, $4)
       returning id, institution_id as "institutionId", name, vehicle_id as "vehicleId", driver_id as "driverId"`,
      [institutionId, data.name, data.vehicleId ?? null, data.driverId ?? null]
    );
    const route = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'create',
      entityType: 'transport_route',
      entityId: route.id,
      after: route,
    });
    return route;
  },

  async listRoutes(client: PoolClient, institutionId: string): Promise<TransportRoute[]> {
    const { rows } = await client.query(
      `select r.id, r.institution_id as "institutionId", r.name, r.vehicle_id as "vehicleId", r.driver_id as "driverId",
              v.registration_no as "vehicleRegistration", d.name as "driverName"
       from transport_route r
       left join vehicle v on v.id = r.vehicle_id
       left join transport_driver d on d.id = r.driver_id
       order by r.name`,
      []
    );
    return rows;
  },

  async assignDriverToRoute(
    client: PoolClient,
    institutionId: string,
    routeId: string,
    driverId: string,
    actorMembershipId?: string
  ): Promise<void> {
    await client.query(`update transport_route set driver_id = $1 where id = $2`, [driverId, routeId]);
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'assign_driver',
      entityType: 'transport_route',
      entityId: routeId,
      after: { driverId },
    });
  },

  // --- Student Transport Assignment & My Route ---
  async assignStudentToRoute(
    client: PoolClient,
    institutionId: string,
    data: { studentId: string; routeId: string; stopId?: string },
    actorMembershipId?: string
  ): Promise<StudentTransportAssignment> {
    const { rows } = await client.query(
      `insert into student_transport_assignment (institution_id, student_id, route_id, stop_id)
       values ($1, $2, $3, $4)
       returning id, institution_id as "institutionId", student_id as "studentId", route_id as "routeId", stop_id as "stopId"`,
      [institutionId, data.studentId, data.routeId, data.stopId ?? null]
    );
    const sta = rows[0];
    await logAudit(client, {
      institutionId,
      actorMembershipId,
      action: 'assign_student_transport',
      entityType: 'student_transport_assignment',
      entityId: sta.id,
      after: sta,
    });
    return sta;
  },

  async getMyRoute(client: PoolClient, institutionId: string, userId: string): Promise<any | null> {
    const { rows } = await client.query(
      `select sta.id, sta.student_id as "studentId", tr.name as "routeName", ts.name as "stopName",
              v.registration_no as "vehicleRegistration", td.name as "driverName"
       from student s
       join student_transport_assignment sta on sta.student_id = s.id
       join transport_route tr on tr.id = sta.route_id
       left join transport_stop ts on ts.id = sta.stop_id
       left join vehicle v on v.id = tr.vehicle_id
       left join transport_driver td on td.id = tr.driver_id
       where s.user_id = $1 limit 1`,
      [userId]
    );
    return rows[0] ?? null;
  },
};
