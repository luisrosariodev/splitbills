export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  CreateSplit: undefined;
  History: undefined;
  SplitDetail: { splitId: string; splitName: string };
  GroupDetail: { groupId: string; groupName: string };
  Profile: undefined;
  Settings: undefined;
  EditSplit: { splitId: string; splitName: string };
};
