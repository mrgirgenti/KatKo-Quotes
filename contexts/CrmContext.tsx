import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import {
  Organization,
  Contact,
  ActivityEntry,
  CampaignAssignment,
  CampaignTemplate,
  CampaignStep,
  CrmStatus,
  Department,
  OrgMembership,
  MembershipRole,
} from '@/types/crm';
import { generateId } from '@/utils/quoteCalculations';

const ORGS_KEY = 'crm_organizations';
const TEMPLATES_KEY = 'crm_campaign_templates';

const DEFAULT_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'tpl-standard-4wk',
    name: 'Standard 4-Week Outreach',
    description: '2 calls + 3 emails over 4 weeks',
    steps: [
      { stepNumber: 1, type: 'call',  label: 'Initial Cold Call',     dayOffset: 0  },
      { stepNumber: 2, type: 'email', label: 'Follow-Up Email #1',    dayOffset: 3  },
      { stepNumber: 3, type: 'call',  label: 'Second Call Attempt',   dayOffset: 10 },
      { stepNumber: 4, type: 'email', label: 'Follow-Up Email #2',    dayOffset: 14 },
      { stepNumber: 5, type: 'email', label: 'Final Follow-Up Email', dayOffset: 28 },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tpl-church',
    name: 'Church / Ministry Outreach',
    description: 'Relationship-focused, 6-week gentle approach',
    steps: [
      { stepNumber: 1, type: 'call',  label: 'Introduction Call',        dayOffset: 0  },
      { stepNumber: 2, type: 'email', label: 'Welcome + Portfolio Email', dayOffset: 5  },
      { stepNumber: 3, type: 'call',  label: 'Check-In Call',            dayOffset: 14 },
      { stepNumber: 4, type: 'email', label: 'Ministry Discount Offer',  dayOffset: 21 },
      { stepNumber: 5, type: 'call',  label: 'Final Touch Base Call',    dayOffset: 35 },
      { stepNumber: 6, type: 'email', label: 'Closing Email',            dayOffset: 42 },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tpl-school',
    name: 'School / Youth Program',
    description: 'Season-aware approach for schools',
    steps: [
      { stepNumber: 1, type: 'call',  label: 'Initial Contact (Admin)',  dayOffset: 0  },
      { stepNumber: 2, type: 'email', label: 'Program Overview Email',   dayOffset: 3  },
      { stepNumber: 3, type: 'email', label: 'Pricing + Samples Email',  dayOffset: 10 },
      { stepNumber: 4, type: 'call',  label: 'Decision Maker Follow-Up', dayOffset: 18 },
      { stepNumber: 5, type: 'email', label: 'Final Proposal Email',     dayOffset: 28 },
    ],
    createdAt: new Date().toISOString(),
  },
];

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

async function loadTemplates(): Promise<CampaignTemplate[]> {
  try {
    const stored = await AsyncStorage.getItem(TEMPLATES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_TEMPLATES;
  } catch { return DEFAULT_TEMPLATES; }
}

async function saveTemplates(templates: CampaignTemplate[]): Promise<CampaignTemplate[]> {
  await AsyncStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  return templates;
}

export const [CrmProvider, useCrm] = createContextHook(() => {
  const queryClient = useQueryClient();

  const orgsQuery = useQuery<Organization[]>({
    queryKey: ['crm_orgs'],
    queryFn: async () => {
      try {
        const serverOrgs: Organization[] = await apiFetch('/api/orgs');
        if (serverOrgs.length === 0) {
          const localData = await AsyncStorage.getItem(ORGS_KEY).catch(() => null);
          if (localData) {
            const localOrgs: Organization[] = JSON.parse(localData);
            if (localOrgs.length > 0) {
              await apiFetch('/api/migrate', {
                method: 'POST',
                body: JSON.stringify({ orgs: localOrgs }),
              }).catch(() => null);
              return apiFetch('/api/orgs');
            }
          }
        }
        return serverOrgs;
      } catch (err) {
        console.error('[CrmContext] loadOrgs failed', err);
        return [];
      }
    },
    staleTime: 1000 * 30,
  });

  const templatesQuery = useQuery({
    queryKey: ['crm_templates'],
    queryFn: loadTemplates,
  });

  const orgs = orgsQuery.data || [];
  const templates = templatesQuery.data || DEFAULT_TEMPLATES;

  const invalidateOrgs = () => {
    queryClient.invalidateQueries({ queryKey: ['crm_orgs'] });
    queryClient.invalidateQueries({ queryKey: ['org_detail'] });
  };

  const addOrgMutation = useMutation({
    mutationFn: async (data: Omit<Organization, 'id' | 'createdAt' | 'contacts' | 'activityLog' | 'campaigns' | 'departments'>) => {
      return apiFetch('/api/orgs', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: invalidateOrgs,
  });

  const addOrgWithContactMutation = useMutation({
    mutationFn: async ({
      orgData,
      contactData,
    }: {
      orgData: Omit<Organization, 'id' | 'createdAt' | 'contacts' | 'activityLog' | 'campaigns' | 'departments'>;
      contactData?: Omit<Contact, 'id' | 'createdAt' | 'organizationId'>;
    }) => {
      return apiFetch('/api/orgs', {
        method: 'POST',
        body: JSON.stringify({ ...orgData, contact: contactData }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (org: Organization) => {
      return apiFetch(`/api/orgs/${org.id}`, { method: 'PUT', body: JSON.stringify(org) });
    },
    onSuccess: invalidateOrgs,
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      return apiFetch(`/api/orgs/${orgId}`, { method: 'DELETE' });
    },
    onSuccess: invalidateOrgs,
  });

  const addContactMutation = useMutation({
    mutationFn: async ({
      orgId,
      contact,
    }: { orgId: string; contact: Omit<Contact, 'id' | 'createdAt' | 'organizationId'> }) => {
      return apiFetch(`/api/orgs/${orgId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(contact),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ orgId, contact }: { orgId: string; contact: Contact }) => {
      return apiFetch(`/api/orgs/${orgId}/contacts/${contact.id}`, {
        method: 'PUT',
        body: JSON.stringify(contact),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const deleteContactMutation = useMutation({
    mutationFn: async ({ orgId, contactId }: { orgId: string; contactId: string }) => {
      return apiFetch(`/api/orgs/${orgId}/contacts/${contactId}`, { method: 'DELETE' });
    },
    onSuccess: invalidateOrgs,
  });

  const addActivityMutation = useMutation({
    mutationFn: async ({
      orgId,
      entry,
    }: { orgId: string; entry: Omit<ActivityEntry, 'id' | 'createdAt'> }) => {
      return apiFetch(`/api/orgs/${orgId}/activity`, {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ orgId, entry }: { orgId: string; entry: ActivityEntry }) => {
      return apiFetch(`/api/orgs/${orgId}/activity`, {
        method: 'PUT',
        body: JSON.stringify(entry),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async ({ orgId, entryId }: { orgId: string; entryId: string }) => {
      return apiFetch(`/api/orgs/${orgId}/activity`, {
        method: 'DELETE',
        body: JSON.stringify({ entryId }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const assignCampaignMutation = useMutation({
    mutationFn: async ({ orgId, templateId }: { orgId: string; templateId?: string }) => {
      const tpl = templateId ? templates.find((t) => t.id === templateId) : null;
      const now = new Date();
      const steps = tpl
        ? tpl.steps.map((s) => {
            const d = new Date(now);
            d.setDate(d.getDate() + (s.dayOffset || 0));
            return {
              id: generateId(),
              stepNumber: s.stepNumber,
              type: s.type,
              label: s.label,
              scheduledDate: d.toISOString(),
              status: 'pending' as const,
            };
          })
        : [];
      const assignment: CampaignAssignment = {
        id: generateId(),
        templateId,
        templateName: tpl?.name || 'Custom Campaign',
        startedDate: now.toISOString(),
        steps,
      };
      const org = orgs.find((o) => o.id === orgId);
      if (!org) throw new Error('Org not found');
      const updatedCampaigns = [...(org.campaigns || []), assignment];
      return apiFetch(`/api/orgs/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ campaigns: updatedCampaigns }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const updateCampaignStepMutation = useMutation({
    mutationFn: async ({ orgId, campaignId, step }: { orgId: string; campaignId: string; step: CampaignStep }) => {
      const org = orgs.find((o) => o.id === orgId);
      if (!org) throw new Error('Org not found');
      const updatedCampaigns = (org.campaigns || []).map((c) => {
        if (c.id !== campaignId) return c;
        return { ...c, steps: c.steps.map((s) => (s.id === step.id ? step : s)) };
      });
      return apiFetch(`/api/orgs/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ campaigns: updatedCampaigns }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async ({ orgId, campaignId }: { orgId: string; campaignId: string }) => {
      const org = orgs.find((o) => o.id === orgId);
      if (!org) throw new Error('Org not found');
      const updatedCampaigns = (org.campaigns || []).filter((c) => c.id !== campaignId);
      return apiFetch(`/api/orgs/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ campaigns: updatedCampaigns }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const addTemplateMutation = useMutation({
    mutationFn: async (tpl: Omit<CampaignTemplate, 'id' | 'createdAt'>) => {
      const newTpl: CampaignTemplate = { ...tpl, id: generateId(), createdAt: new Date().toISOString() };
      return saveTemplates([...(templatesQuery.data || DEFAULT_TEMPLATES), newTpl]);
    },
    onSuccess: (data) => queryClient.setQueryData(['crm_templates'], data),
  });

  const updateOrgStatusMutation = useMutation({
    mutationFn: async ({ orgId, status }: { orgId: string; status: CrmStatus }) => {
      return apiFetch(`/api/orgs/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const addDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, name, description }: { orgId: string; name: string; description?: string }) => {
      const org = orgs.find((o) => o.id === orgId);
      if (!org) throw new Error('Org not found');
      const dept: Department = { id: generateId(), name, description };
      const updatedDepts = [...(org.departments || []), dept];
      return apiFetch(`/api/orgs/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ departments: updatedDepts }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, dept }: { orgId: string; dept: Department }) => {
      const org = orgs.find((o) => o.id === orgId);
      if (!org) throw new Error('Org not found');
      const updatedDepts = (org.departments || []).map((d) => (d.id === dept.id ? dept : d));
      return apiFetch(`/api/orgs/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ departments: updatedDepts }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, deptId }: { orgId: string; deptId: string }) => {
      const org = orgs.find((o) => o.id === orgId);
      if (!org) throw new Error('Org not found');
      const updatedDepts = (org.departments || []).filter((d) => d.id !== deptId);
      const updatedContacts = org.contacts.map((c) =>
        c.departmentId === deptId ? { ...c, departmentId: undefined } : c,
      );
      return Promise.all([
        apiFetch(`/api/orgs/${orgId}`, {
          method: 'PUT',
          body: JSON.stringify({ departments: updatedDepts }),
        }),
        ...updatedContacts
          .filter((c) => !c.departmentId)
          .map((c) =>
            apiFetch(`/api/orgs/${orgId}/contacts/${c.id}`, {
              method: 'PUT',
              body: JSON.stringify(c),
            }),
          ),
      ]);
    },
    onSuccess: invalidateOrgs,
  });

  const bulkImportOrgsMutation = useMutation({
    mutationFn: async (importedOrgs: Organization[]) => {
      await apiFetch('/api/migrate', {
        method: 'POST',
        body: JSON.stringify({ orgs: importedOrgs }),
      });
    },
    onSuccess: invalidateOrgs,
  });

  const updateOrgHubEnabledMutation = useMutation({
    mutationFn: async ({ orgId, enabled }: { orgId: string; enabled: boolean }) => {
      return apiFetch(`/api/orgs/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify({ hubEnabled: enabled }),
      });
    },
    onSuccess: (_data, vars) => {
      invalidateOrgs();
      queryClient.invalidateQueries({ queryKey: ['org_detail', vars.orgId] });
    },
  });

  const createMembershipMutation = useMutation({
    mutationFn: async (data: {
      organizationId: string;
      userId: string;
      role: MembershipRole;
      canManageUsers?: boolean;
      canViewInvoices?: boolean;
      canPayInvoices?: boolean;
      canApproveQuotes?: boolean;
    }): Promise<OrgMembership> => {
      return apiFetch('/api/memberships', { method: 'POST', body: JSON.stringify(data) });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['memberships', vars.organizationId] });
    },
  });

  const deleteMembershipMutation = useMutation({
    mutationFn: async ({ membershipId, orgId }: { membershipId: string; orgId: string }) => {
      return apiFetch(`/api/memberships/${membershipId}`, { method: 'DELETE' });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['memberships', vars.orgId] });
    },
  });

  return {
    orgs,
    templates,
    isLoading: orgsQuery.isLoading,
    addOrg: addOrgMutation.mutate,
    addOrgWithContact: addOrgWithContactMutation.mutate,
    bulkImportOrgs: bulkImportOrgsMutation.mutate,
    updateOrg: updateOrgMutation.mutate,
    deleteOrg: deleteOrgMutation.mutate,
    addContact: addContactMutation.mutate,
    updateContact: updateContactMutation.mutate,
    deleteContact: deleteContactMutation.mutate,
    addActivity: addActivityMutation.mutate,
    updateActivity: updateActivityMutation.mutate,
    deleteActivity: deleteActivityMutation.mutate,
    assignCampaign: assignCampaignMutation.mutate,
    updateCampaignStep: updateCampaignStepMutation.mutate,
    deleteCampaign: deleteCampaignMutation.mutate,
    addTemplate: addTemplateMutation.mutate,
    updateOrgStatus: updateOrgStatusMutation.mutate,
    addDepartment: addDepartmentMutation.mutate,
    updateDepartment: updateDepartmentMutation.mutate,
    deleteDepartment: deleteDepartmentMutation.mutate,
    updateOrgHubEnabled: updateOrgHubEnabledMutation.mutate,
    createMembership: createMembershipMutation.mutate,
    createMembershipAsync: createMembershipMutation.mutateAsync,
    deleteMembership: deleteMembershipMutation.mutate,
  };
});
