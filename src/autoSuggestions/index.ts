export type SuggestFieldKey =
  | 'due'
  | 'scheduled'
  | 'priority'
  | 'project'
  | 'repeat'
  | 'duration';

export type SuggestInformation = {
  kind: 'key' | 'field' | 'value-preview' | 'date-preview' | 'date-option';
  key: SuggestFieldKey;
  displayText: string;
  replaceText: string;
  replaceFrom: number;
  replaceTo: number;
  cursorPosition: number;
  icon?: string;
  hint?: string;
  rightText?: string;
  accentText?: string;
  color?: string;
  sectionLabel?: string;
};

export type SuggestTriggerContext = {
  lineText: string;
  cursorPos: number;
};
