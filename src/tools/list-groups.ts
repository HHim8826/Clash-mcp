export type GroupRaw = {
  type?: string;
  now?: string;
  all?: string[];
};

export type GroupSummary = {
  name: string;
  type: string;
  now: string;
  allCount: number;
};

export type ListGroupsClient = {
  listGroupsRaw(): Promise<Record<string, GroupRaw>>;
};

export function createListGroupsTool(client: ListGroupsClient) {
  return {
    async execute(): Promise<GroupSummary[]> {
      const groups = await client.listGroupsRaw();

      return Object.entries(groups).map(([name, group]) => ({
        name,
        type: group.type ?? "UNKNOWN",
        now: group.now ?? "",
        allCount: group.all?.length ?? 0,
      }));
    },
  };
}