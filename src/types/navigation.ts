export type TabParamList = {
  Home: undefined;
  History: undefined;
  Stats: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  History: undefined;
  Profile: undefined;
  MainTabs: undefined;
  CreateSplit: undefined;
  SplitDetail: { splitId: string; splitName?: string };
  GroupDetail: { groupId: string; groupName: string };
  Settings: undefined;
  Contacts: undefined;
  EditSplit: { splitId: string; splitName: string };
  Settlements: { splitId: string; splitName: string };
};
