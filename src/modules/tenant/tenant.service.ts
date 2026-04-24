import Tenant, { ITenantDocument } from "./tenant.model";

const MAX_SLUG_ATTEMPTS = 50;

function baseSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "workspace";
}

async function generateUniqueSlug(name: string): Promise<string> {
  const root = baseSlug(name);
  let candidate = root;
  let attempt = 0;

  while (attempt < MAX_SLUG_ATTEMPTS) {
    const exists = await Tenant.exists({ slug: candidate });
    if (!exists) {
      return candidate;
    }
    attempt += 1;
    const suffix = Math.random().toString(36).slice(2, 7);
    candidate = `${root}-${suffix}`;
  }

  throw Object.assign(new Error("Could not generate unique tenant slug"), {
    status: 500,
  });
}

export async function createTenant({
  name,
}: {
  name: string;
}): Promise<ITenantDocument> {
  try {
    const slug = await generateUniqueSlug(name);
    const tenant = await Tenant.create({
      name: name.trim(),
      slug,
      plan: "free",
      status: "active",
    });
    return tenant;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw Object.assign(new Error("Failed to create tenant"), { status: 500 });
  }
}

export async function getTenantById(
  id: string,
): Promise<ITenantDocument | null> {
  try {
    return await Tenant.findById(id);
  } catch (error) {
    throw Object.assign(new Error("Failed to load tenant"), { status: 500 });
  }
}

export async function deleteTenant(id: string): Promise<void> {
  try {
    await Tenant.findByIdAndDelete(id);
  } catch (error) {
    throw Object.assign(new Error("Failed to delete tenant"), { status: 500 });
  }
}
