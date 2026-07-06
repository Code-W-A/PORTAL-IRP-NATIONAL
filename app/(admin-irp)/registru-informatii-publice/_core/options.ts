import { arrayUnion, doc, getDoc, setDoc, type Firestore } from "firebase/firestore";

import { getTenantDocRef } from "./firestore";
import type { PublicInfoRequestDraft, PublicInfoRequestOptions } from "./types";
import {
  DEFAULT_COMMUNICATION_METHODS,
  DEFAULT_RECEIVE_METHODS,
  DEFAULT_RESPONSE_NATURES,
} from "./types";

const OPTIONS_DOC_ID = "publicInformationRequestOptions";

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return [...fallback];
  const normalized = value.map((item) => String(item).trim()).filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : [...fallback];
}

export function getOptionsDocRef(db: Firestore) {
  return doc(getTenantDocRef(db), "Settings", OPTIONS_DOC_ID);
}

export async function loadPublicInfoRequestOptions(db: Firestore): Promise<PublicInfoRequestOptions> {
  const snap = await getDoc(getOptionsDocRef(db));
  if (!snap.exists()) {
    return {
      receiveMethods: [...DEFAULT_RECEIVE_METHODS],
      interestDomains: [],
      responseNatures: [...DEFAULT_RESPONSE_NATURES],
      communicationMethods: [...DEFAULT_COMMUNICATION_METHODS],
      requestedInformationSnippets: [],
      frequentRequesters: [],
    };
  }

  const data = snap.data();
  return {
    receiveMethods: asStringArray(data.receiveMethods, DEFAULT_RECEIVE_METHODS),
    interestDomains: asStringArray(data.interestDomains, []),
    responseNatures: asStringArray(data.responseNatures, DEFAULT_RESPONSE_NATURES),
    communicationMethods: asStringArray(data.communicationMethods, DEFAULT_COMMUNICATION_METHODS),
    requestedInformationSnippets: asStringArray(data.requestedInformationSnippets, []),
    frequentRequesters: asStringArray(data.frequentRequesters, []),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
}

type SaveOptionInput = {
  receiveMethod?: boolean;
  interestDomain?: boolean;
  responseNature?: boolean;
  communicationMethod?: boolean;
  requestedInformation?: boolean;
  requesterName?: boolean;
};

export async function savePublicInfoRequestOptionsFromDraft(
  db: Firestore,
  draft: PublicInfoRequestDraft,
  selected: SaveOptionInput
) {
  const patch: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (selected.receiveMethod && draft.receiveMethod?.trim()) {
    patch.receiveMethods = arrayUnion(draft.receiveMethod.trim());
  }
  if (selected.interestDomain && draft.interestDomain?.trim()) {
    patch.interestDomains = arrayUnion(draft.interestDomain.trim());
  }
  if (selected.responseNature && draft.responseNature?.trim()) {
    patch.responseNatures = arrayUnion(draft.responseNature.trim());
  }
  if (selected.communicationMethod && draft.communicationMethod?.trim()) {
    patch.communicationMethods = arrayUnion(draft.communicationMethod.trim());
  }
  if (selected.requestedInformation && draft.requestedInformation?.trim()) {
    patch.requestedInformationSnippets = arrayUnion(draft.requestedInformation.trim());
  }
  if (selected.requesterName && draft.requesterName?.trim()) {
    patch.frequentRequesters = arrayUnion(draft.requesterName.trim());
  }

  const hasUnion = Object.keys(patch).some((key) => key !== "updatedAt");
  if (!hasUnion) return;

  await setDoc(getOptionsDocRef(db), patch, { merge: true });
}
