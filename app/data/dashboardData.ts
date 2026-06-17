import dashboardData from './dashboardData.json';

export type RoleKey = keyof (typeof dashboardData)['dashboards'];
export type DashboardMenuKey = string;

export type DashboardStat = {
  label: string;
  value: string;
  icon: string;
};

export type DashboardCard = {
  title: string;
  subtitle?: string;
  type: string;
};

export type DashboardMenuSection = {
  stats?: DashboardStat[];
  cards?: DashboardCard[];
  rolesGrid?: boolean;
  header?: {
    title: string;
    description?: string;
  };
  note?: string;
  patientsTable?: {
    columns: string[];
    rows: Record<string, any>[];
  };
};

export const getDashboardSection = (role: RoleKey | string, menuKey: DashboardMenuKey): DashboardMenuSection | null => {
  const dashboards: any = (dashboardData as any).dashboards;
  const roleMenu = dashboards?.[role];
  const section = roleMenu?.[menuKey];
  return section ?? null;
};

export const allDashboardCategories = (dashboardData as any).categories as Array<{
  id: string;
  label: string;
  icon?: string;
  menuKey: string;
}>;

