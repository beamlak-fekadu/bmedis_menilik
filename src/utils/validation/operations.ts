import { z } from 'zod';

export const maintenanceRequestSchema = z.object({
  asset_id: z.string().min(1, 'Asset is required'),
  urgency: z.enum(['low', 'medium', 'high', 'critical']),
  fault_description: z.string().trim().min(10, 'Fault description should be at least 10 characters'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const pmPlanSchema = z.object({
  asset_id: z.string().min(1, 'Asset is required'),
  template_id: z.string().optional().or(z.literal('')),
  name: z.string().trim().min(3, 'Plan name is required'),
  frequency_days: z.coerce.number().int().min(1, 'Frequency must be at least 1 day'),
  next_due_date: z.string().optional().or(z.literal('')),
});

export const procurementRequestSchema = z.object({
  title: z.string().trim().min(5, 'Title is required'),
  justification: z.string().trim().min(15, 'Justification must provide operational context'),
  status: z.enum(['requested', 'approved', 'ordered', 'in_transit', 'delivered', 'canceled']).default('requested'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  expected_delivery_date: z.string().optional().or(z.literal('')),
});
