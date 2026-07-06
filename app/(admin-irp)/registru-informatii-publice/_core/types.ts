export type PublicInfoRequestType = "written" | "verbal";

export type PublicInfoRequesterType = "person_fizica" | "persoana_juridica";

export type PublicInfoChangeHistoryEntry = {
  changedAt: string;
  changedBy: string;
  changedFields: string[];
};

export type PublicInfoRequest = {
  id: string;
  requestNumber: string;
  requestDate: string;
  requestType: PublicInfoRequestType;
  receiveMethod: string;
  requesterName: string;
  requesterType: PublicInfoRequesterType;
  requestedInformation: string;
  interestDomain: string;
  responseNature: string;
  communicationMethod: string;
  termDays?: number;
  responseNumber?: string;
  responseDate?: string;
  internalNotes?: string;
  searchKeywords: string[];
  changeHistory: PublicInfoChangeHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type PublicInfoRequestDraft = Omit<
  PublicInfoRequest,
  "id" | "searchKeywords" | "changeHistory" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

export type PublicInfoRequestOptions = {
  receiveMethods: string[];
  interestDomains: string[];
  responseNatures: string[];
  communicationMethods: string[];
  requestedInformationSnippets: string[];
  frequentRequesters: string[];
  updatedAt?: string;
};

export type PublicInfoRequestTab = "all" | "written" | "verbal";

export type PublicInfoRequestFilters = {
  search: string;
  year: string;
  month: string;
  requestType: PublicInfoRequestTab;
  responseNature: string;
  receiveMethod: string;
  interestDomain: string;
};

export const DEFAULT_RECEIVE_METHODS = [
  "verbal",
  "e-mail",
  "poștă",
  "registratură",
  "fax",
  "telefon",
  "platformă online",
];

export const DEFAULT_RESPONSE_NATURES = [
  "soluționat favorabil",
  "soluționat parțial",
  "redirecționat",
  "respins",
  "în lucru",
];

export const DEFAULT_COMMUNICATION_METHODS = [
  "verbal",
  "e-mail",
  "poștă",
  "telefon",
  "ridicare de la sediu",
];

export const REQUEST_TYPE_LABELS: Record<PublicInfoRequestType, string> = {
  written: "Scrisă",
  verbal: "Verbală",
};

export const REQUESTER_TYPE_LABELS: Record<PublicInfoRequesterType, string> = {
  person_fizica: "Persoană fizică",
  persoana_juridica: "Persoană juridică",
};
