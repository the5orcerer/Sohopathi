import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../../core/logger';
import { pool } from '../../core/db';

export const leadsRouter = Router();

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  institutionName: z.string().min(1, 'Institution name is required'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().min(6, 'Valid phone number is required'),
  role: z.string().optional().default('Principal / Administrator'),
  studentCount: z.string().optional().default('< 500'),
  plan: z.string().optional(),
  message: z.string().optional(),
  source: z.string().optional().default('website_landing'),
});

leadsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parseResult = leadSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const lead = parseResult.data;
    logger.info(
      { leadEmail: lead.email, leadInstitution: lead.institutionName },
      'Received new sales lead / demo inquiry from website'
    );

    // Persist to database if accessible, or log safely
    try {
      const client = await pool.connect();
      try {
        await client.query(`
          create table if not exists public.sales_leads (
            id uuid primary key default gen_random_uuid(),
            name text not null,
            institution_name text not null,
            email text not null,
            phone text not null,
            role text,
            student_count text,
            selected_plan text,
            message text,
            source text default 'website_landing',
            created_at timestamptz default now()
          );
        `);

        await client.query(
          `insert into public.sales_leads 
           (name, institution_name, email, phone, role, student_count, selected_plan, message, source)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            lead.name,
            lead.institutionName,
            lead.email,
            lead.phone,
            lead.role,
            lead.studentCount,
            lead.plan || null,
            lead.message || null,
            lead.source,
          ]
        );
      } finally {
        client.release();
      }
    } catch (dbErr: any) {
      // If DB is offline or table insertion fails, log error but do not fail the visitor's submission
      logger.warn({ error: dbErr.message }, 'Failed to persist lead in DB, logged to logger');
    }

    return res.status(201).json({
      success: true,
      message: 'Sales inquiry received successfully. Our team will contact you within 24 hours.',
      lead: {
        name: lead.name,
        institutionName: lead.institutionName,
        email: lead.email,
      },
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Error processing sales lead');
    return res.status(500).json({ error: 'Internal server error while processing inquiry' });
  }
});
