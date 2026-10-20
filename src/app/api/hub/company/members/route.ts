import { addMember, hubError, requireHubCompany } from "@/lib/hubCompany";

/** POST /api/hub/company/members - gone (410): the team is built by invite (company/invites). */
export async function POST(request: Request) {
  try {
    await requireHubCompany(request);
    addMember();
  } catch (e) {
    return hubError(e);
  }
}
