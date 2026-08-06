import { JSDOM } from "jsdom";

export function installDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: "https://foundryvtt.local/"
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Element = dom.window.Element;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.SubmitEvent = dom.window.SubmitEvent;
  return dom;
}

export function resetDocumentBody() {
  if (globalThis.document?.body) globalThis.document.body.innerHTML = "";
}
