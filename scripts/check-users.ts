import { pool } from '../src/core/db';

async function checkUsers() {
  const client = await pool.connect();
  try {
    const { rows: members } = await client.query(`
      select 
        i.subdomain,
        m.login_username,
        p.email,
        p.password_hash,
        r.name as role_name
      from membership m
      join institution i on i.id = m.institution_id
      join profile p on p.id = m.user_id
      join role r on r.id = m.role_id
      where i.subdomain = 'exampleschool';
    `);
    console.log('Members in exampleschool:', members);
  } finally {
    client.release();
    await pool.end();
  }
}

checkUsers();

