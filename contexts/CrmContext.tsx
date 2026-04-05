import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Organization, Contact, ActivityEntry, CampaignAssignment, CampaignTemplate, CrmStatus, Department } from '@/types/crm';
import { generateId } from '@/utils/quoteCalculations';

const ORGS_KEY = 'crm_organizations';
const TEMPLATES_KEY = 'crm_campaign_templates';

async function loadOrgs(): Promise<Organization[]> {
  try {
    const stored = await AsyncStorage.getItem(ORGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

async function saveOrgs(orgs: Organization[]): Promise<Organization[]> {
  await AsyncStorage.setItem(ORGS_KEY, JSON.stringify(orgs));
  return orgs;
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

const DEFAULT_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'tpl-standard-4wk',
    name: 'Standard 4-Week Outreach',
    description: '2 calls + 3 emails over 4 weeks',
    steps: [
      { stepNumber: 1, type: 'call',  label: 'Initial Cold Call',    dayOffset: 0  },
      { stepNumber: 2, type: 'email', label: 'Follow-Up Email #1',   dayOffset: 3  },
      { stepNumber: 3, type: 'call',  label: 'Second Call Attempt',  dayOffset: 10 },
      { stepNumber: 4, type: 'email', label: 'Follow-Up Email #2',   dayOffset: 14 },
      { stepNumber: 5, type: 'email', label: 'Final Follow-Up Email',dayOffset: 28 },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tpl-church',
    name: 'Church / Ministry Outreach',
    description: 'Relationship-focused, 6-week gentle approach',
    steps: [
      { stepNumber: 1, type: 'call',  label: 'Introduction Call',       dayOffset: 0  },
      { stepNumber: 2, type: 'email', label: 'Welcome + Portfolio Email',dayOffset: 5  },
      { stepNumber: 3, type: 'call',  label: 'Check-In Call',           dayOffset: 14 },
      { stepNumber: 4, type: 'email', label: 'Ministry Discount Offer', dayOffset: 21 },
      { stepNumber: 5, type: 'call',  label: 'Final Touch Base Call',   dayOffset: 35 },
      { stepNumber: 6, type: 'email', label: 'Closing Email',           dayOffset: 42 },
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

export const [CrmProvider, useCrm] = createContextHook(() => {
  const queryClient = useQueryClient();

  const orgsQuery = useQuery({ queryKey: ['crm_orgs'], queryFn: loadOrgs });
  const templatesQuery = useQuery({ queryKey: ['crm_templates'], queryFn: loadTemplates });

  const orgs = orgsQuery.data || [];
  const templates = templatesQuery.data || DEFAULT_TEMPLATES;

  const mutate = (fn: (orgs: Organization[]) => Organization[]) =>
    saveOrgs(fn(orgsQuery.data || []));

  const addOrgMutation = useMutation({
    mutationFn: async (data: Omit<Organization, 'id' | 'createdAt' | 'contacts' | 'activityLog' | 'campaigns' | 'departments'>) => {
      const org: Organization = {
        ...data,
        id: generateId(),
        departments: [],
        contacts: [],
        activityLog: [],
        campaigns: [],
        createdAt: new Date().toISOString(),
      };
      return saveOrgs([org, ...(orgsQuery.data || [])]);
    },
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const addOrgWithContactMutation = useMutation({
    mutationFn: async ({
      orgData,
      contactData,
    }: {
      orgData: Omit<Organization, 'id' | 'createdAt' | 'contacts' | 'activityLog' | 'campaigns' | 'departments'>;
      contactData?: Omit<Contact, 'id' | 'createdAt' | 'organizationId'>;
    }) => {
      const orgId = generateId();
      const contacts: Contact[] = contactData
        ? [{
            ...contactData,
            id: generateId(),
            organizationId: orgId,
            createdAt: new Date().toISOString(),
          }]
        : [];
      const org: Organization = {
        ...orgData,
        id: orgId,
        departments: [],
        contacts,
        activityLog: [],
        campaigns: [],
        createdAt: new Date().toISOString(),
      };
      return saveOrgs([org, ...(orgsQuery.data || [])]);
    },
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (org: Organization) =>
      mutate((all) => all.map((o) => (o.id === org.id ? org : o))),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: string) =>
      mutate((all) => all.filter((o) => o.id !== orgId)),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const addContactMutation = useMutation({
    mutationFn: async ({ orgId, contact }: { orgId: string; contact: Omit<Contact, 'id' | 'createdAt' | 'organizationId'> }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        const newContact: Contact = { ...contact, id: generateId(), organizationId: orgId, createdAt: new Date().toISOString() };
        return { ...o, contacts: [...o.contacts, newContact] };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ orgId, contact }: { orgId: string; contact: Contact }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return { ...o, contacts: o.contacts.map((c) => (c.id === contact.id ? contact : c)) };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const deleteContactMutation = useMutation({
    mutationFn: async ({ orgId, contactId }: { orgId: string; contactId: string }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return { ...o, contacts: o.contacts.filter((c) => c.id !== contactId) };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const addActivityMutation = useMutation({
    mutationFn: async ({ orgId, entry }: { orgId: string; entry: Omit<ActivityEntry, 'id' | 'createdAt'> }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        const newEntry: ActivityEntry = { ...entry, id: generateId(), createdAt: new Date().toISOString() };
        return { ...o, activityLog: [newEntry, ...o.activityLog] };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ orgId, entry }: { orgId: string; entry: ActivityEntry }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return { ...o, activityLog: o.activityLog.map((a) => (a.id === entry.id ? entry : a)) };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async ({ orgId, entryId }: { orgId: string; entryId: string }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return { ...o, activityLog: o.activityLog.filter((a) => a.id !== entryId) };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
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
      return mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return { ...o, campaigns: [...o.campaigns, assignment] };
      }));
    },
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const updateCampaignStepMutation = useMutation({
    mutationFn: async ({ orgId, campaignId, step }: { orgId: string; campaignId: string; step: import('@/types/crm').CampaignStep }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return {
          ...o,
          campaigns: o.campaigns.map((c) => {
            if (c.id !== campaignId) return c;
            return { ...c, steps: c.steps.map((s) => (s.id === step.id ? step : s)) };
          }),
        };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async ({ orgId, campaignId }: { orgId: string; campaignId: string }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return { ...o, campaigns: o.campaigns.filter((c) => c.id !== campaignId) };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const addTemplateMutation = useMutation({
    mutationFn: async (tpl: Omit<CampaignTemplate, 'id' | 'createdAt'>) => {
      const newTpl: CampaignTemplate = { ...tpl, id: generateId(), createdAt: new Date().toISOString() };
      return saveTemplates([...(templatesQuery.data || DEFAULT_TEMPLATES), newTpl]);
    },
    onSuccess: (data) => queryClient.setQueryData(['crm_templates'], data),
  });

  const updateOrgStatusMutation = useMutation({
    mutationFn: async ({ orgId, status }: { orgId: string; status: CrmStatus }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        const updates: Partial<Organization> = { status };
        if (status === 'Active Client' && !o.convertedToActiveDate) {
          updates.convertedToActiveDate = new Date().toISOString();
        }
        return { ...o, ...updates };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const addDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, name, description }: { orgId: string; name: string; description?: string }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        const dept: Department = { id: generateId(), name, description };
        return { ...o, departments: [...(o.departments || []), dept] };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, dept }: { orgId: string; dept: Department }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return { ...o, departments: (o.departments || []).map((d) => (d.id === dept.id ? dept : d)) };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async ({ orgId, deptId }: { orgId: string; deptId: string }) =>
      mutate((all) => all.map((o) => {
        if (o.id !== orgId) return o;
        return {
          ...o,
          departments: (o.departments || []).filter((d) => d.id !== deptId),
          contacts: o.contacts.map((c) => c.departmentId === deptId ? { ...c, departmentId: undefined } : c),
        };
      })),
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
  });

  const bulkImportOrgsMutation = useMutation({
    mutationFn: async (importedOrgs: Organization[]) => {
      const existing = orgsQuery.data || [];
      return saveOrgs([...importedOrgs, ...existing]);
    },
    onSuccess: (data) => queryClient.setQueryData(['crm_orgs'], data),
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
  };
});
