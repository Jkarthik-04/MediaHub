import { getAdminOverviewData } from '../repositories/admin.repository.js';

export const getAdminOverview = async () => ({ data: await getAdminOverviewData() });
