/**
 * Author Content Terms: what an author accepts before submitting an article.
 * Plain data, shared by the submit screen and the server (which checks the
 * version the author accepted).
 *
 * NOTE: this is plain-language DRAFT wording written to support the legal
 * review flow. It has not been reviewed by a lawyer. Have counsel approve or
 * replace it, and bump AUTHOR_TERMS_VERSION whenever the text changes so
 * acceptances are recorded against the right wording.
 */

export const AUTHOR_TERMS_VERSION = "2026-10-20";

export const AUTHOR_TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Your content and your rights",
    body: "You confirm the article and every image, video and audio clip in it is your own work, or that you have permission to use it. You will not submit anything that copies someone else's work, and you will credit sources where they are needed.",
  },
  {
    title: "2. Accuracy and fairness about people and organisations",
    body: "Statements of fact must be true and, where they could harm someone's reputation, backed by a source you can show. You will not publish false or unsupported allegations about identifiable people or organisations. Clearly separate fact from opinion.",
  },
  {
    title: "3. Privacy and confidential information",
    body: "You will not publish other people's private information (such as contact details, home addresses, health or financial details, or identity numbers) or confidential business information without the permission of the people or organisations concerned.",
  },
  {
    title: "4. Honesty about who you are",
    body: "You are the author you say you are. You will not write as if you are another person or organisation, claim an official role or endorsement you do not have, or attribute invented words to real people.",
  },
  {
    title: "5. Commercial content must be disclosed",
    body: "If you were paid, given something of value, or earn a commission or have another commercial interest in what you write about, you will say so clearly in the article. Sponsored content must be labelled as sponsored.",
  },
  {
    title: "6. Laws that apply",
    body: "You are responsible for following the laws that apply to what you publish, including defamation, privacy, consumer protection, advertising, health and financial-advice rules in Australia and in any other country your article is aimed at.",
  },
  {
    title: "7. Review, edits and removal",
    body: "MYHitch editors review articles before they are published and may ask for changes, decline an article, or remove it later, for example after a complaint. An editor's approval is not legal clearance of your article.",
  },
  {
    title: "8. The automated legal check",
    body: "The automated check shown before you submit is a screening aid that can miss problems or flag things that are fine. It is not legal advice. You remain responsible for what you submit. If you are unsure, get independent advice before publishing.",
  },
  {
    title: "9. Licence to MYHitch Lens",
    body: "You allow MYHitch Lens to store, display, promote and include your article in its magazine and platform, under the content licence you choose when you submit it. You keep ownership of your work.",
  },
];
