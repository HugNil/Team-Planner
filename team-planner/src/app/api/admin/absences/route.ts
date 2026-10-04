import { requireClubAccess } from '@/app/lib/admin-auth';
import { createAdminAbsenceHandler } from '@/app/lib/admin-absences';
import { prisma } from '@/app/lib/prisma';

export const PATCH = createAdminAbsenceHandler(prisma, (clubId) => requireClubAccess(clubId, ['ADMIN']));
