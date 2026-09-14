import { pool, ensureTenantRLS } from '../src/core/db';
import { onboardInstitution } from '../src/modules/onboarding/routes';
import { Request, Response } from 'express';

async function main() {
  const args = process.argv.slice(2);
  const name = args[0] || 'Sunflower International School';
  const subdomain = (args[1] || 'sunflower').toLowerCase().trim();
  const adminEmail = (args[2] || `admin@${subdomain}.edu.bd`).toLowerCase().trim();
  const adminName = args[3] || 'Principal Admin';
  const adminUsername = args[4] || 'admin';

  console.log('======================================================');
  console.log('🏛️ SOHOPATHI INSTITUTION PROVISIONING TOOL');
  console.log('======================================================');
  console.log(`- School Name   : ${name}`);
  console.log(`- Subdomain     : ${subdomain}`);
  console.log(`- Admin Email   : ${adminEmail}`);
  console.log(`- Admin Name    : ${adminName}`);
  console.log(`- Admin Username: ${adminUsername}`);
  console.log('------------------------------------------------------');

  const client = await pool.connect();
  try {
    await ensureTenantRLS(client);

    // Mock Express request and response objects
    const req = {
      body: {
        name,
        subdomain,
        adminEmail,
        adminName,
        adminUsername,
        ownerEmail: adminEmail,
        ownerName: adminName,
        username: adminUsername,
      },
    } as unknown as Request;

    let responseData: any = null;
    let statusCode = 200;

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    } as unknown as Response;

    await onboardInstitution(req, res, client);

    if (statusCode >= 200 && statusCode < 300) {
      console.log('🎉 Institution successfully provisioned on Aiven PostgreSQL!');
      console.log(`- Institution ID  : ${responseData.institutionId}`);
      console.log(`- Subdomain       : ${responseData.subdomain}`);
      console.log(`- Admin Username  : ${responseData.username}`);
      console.log(`- Admin Login URL : http://${responseData.subdomain}.localhost:3000/login`);
      console.log(`- Default Password: changeme or password123`);
    } else {
      console.error(`❌ Failed with status ${statusCode}:`, responseData);
    }
  } catch (err: any) {
    console.error('❌ Provisioning error:', err.message || err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

