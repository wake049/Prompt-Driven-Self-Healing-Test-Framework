// src/api/elementService.ts
// 
// DISABLED: This service was creating duplicate API calls
// Element recording is now handled directly in content.ts to avoid duplicates
//
// This file is kept for reference but all functions are commented out

/*
import type { ElementPayload, RecordResult } from "../types/element";
import apiClient from "./api-client"; // centralized route handling
import { attributesToObject, extractIdentity, makeLogicalKey, simpleCssSelector } from "../utils/fingerprint";

const RECORDER_SESSION_KEY = "pdta_session_id";

export async function ensureSessionId(): Promise<string> {
  const stored = await chrome.storage.local.get(RECORDER_SESSION_KEY);
  if (stored && stored[RECORDER_SESSION_KEY]) return stored[RECORDER_SESSION_KEY];
  const sid = crypto.randomUUID();
  await chrome.storage.local.set({ [RECORDER_SESSION_KEY]: sid });
  return sid;
}

export async function recordHTMLElement(target: HTMLElement): Promise<RecordResult> {
  const session_id = await ensureSessionId();
  const page = location.hostname + location.pathname;

  const payload: ElementPayload = {
    session_id,
    page,
    tag: target.tagName.toLowerCase(),
    text_content: target.innerText || "",
    attributes: attributesToObject(target),
    css_selector: simpleCssSelector(target),
    xpath: "", // fill if you have an xpath util
    position_x: Math.round(target.getBoundingClientRect().x),
    position_y: Math.round(target.getBoundingClientRect().y),
    selectors: {
      css: simpleCssSelector(target)
    },
    recorder: "extension"
  };

  // identity + logical key
  const ident = extractIdentity(target);
  payload.logical_key = await makeLogicalKey(page, ident);
  // (optional) include identity for backend review context
  (payload as any).identity = ident;

  // Send via centralized API client (posts to /chrome/record-element)
  const apiRes = await apiClient.recordElement(payload, session_id);

  // normalize return
  const data = (apiRes?.data as RecordResult) || (apiRes as unknown as RecordResult);
  return data;
}
*/
