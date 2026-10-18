import rolesJson from '../data/roles.json' with { type: 'json' };

export interface Role {
  id: string;
  title: string;
  hot: boolean;
  description: string;
  keywords: string[];
}

export const ROLES: Role[] = rolesJson;

export function customRole(title: string): Role {
  return { id: 'custom', title, hot: false, description: `Internship role: ${title}`, keywords: [] };
}

export function roleSlug(role: Role): string {
  return (role.id === 'custom' ? role.title : role.id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
