import { authenticateRequest, unauthorized } from '@/lib/auth';

// Returns the verified DB user for the current Clerk session, provisioning the
// row on first sign-in. The client uses this to reconcile its identity/role.
export async function GET(request: Request) {
  const authedUser = await authenticateRequest(request);
  if (!authedUser) return unauthorized();
  return Response.json(authedUser);
}
