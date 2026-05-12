import dotenv from "dotenv";
import bcrypt from "bcrypt";
import dns from "dns";
import mongoose, { Types } from "mongoose";

dotenv.config();

dns.setServers(["8.8.8.8", "1.1.1.1"]);

import Tenant from "../modules/tenant/tenant.model";
import User from "../modules/auth/auth.model";
import Project from "../modules/project/project.model";
import Sprint from "../modules/sprint/sprint.model";
import Component from "../modules/component/component.model";
import WorkItem from "../modules/workItem/workItem.model";
import {
  ProjectMemberRole,
  Role,
  WorkItemPriority,
  WorkItemState,
  WorkItemType,
} from "../types";

const SALT_ROUNDS = 10;
const DEMO_PASSWORD = "password123";

const STATES: WorkItemState[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "BLOCKED",
  "CANCELLED",
];
const PRIORITIES: WorkItemPriority[] = ["low", "medium", "high", "urgent"];

interface UserSpec {
  name: string;
  email: string;
  role: Role;
}

interface ProjectSpec {
  name: string;
  key: string;
  description: string;
  template: "board" | "list";
  memberEmails: { email: string; role: ProjectMemberRole }[];
  componentNames: string[];
  sprints: {
    name: string;
    goal: string;
    state: "planned" | "active" | "closed";
    daysOffset: number;
  }[];
  workItems: {
    type: WorkItemType;
    title: string;
    state?: WorkItemState;
    priority?: WorkItemPriority;
    assigneeEmail?: string;
    labels?: string[];
    storyPoints?: number;
    componentName?: string;
    sprintName?: string;
    children?: {
      title: string;
      state?: WorkItemState;
      priority?: WorkItemPriority;
      assigneeEmail?: string;
    }[];
  }[];
}

const TENANT_NAME = "Acme Corp";
const TENANT_SLUG = "acme-corp";

const USERS: UserSpec[] = [
  { name: "Alice Anderson", email: "alice@acme.test", role: "admin" },
  { name: "Bob Bennett", email: "bob@acme.test", role: "manager" },
  { name: "Carol Chen", email: "carol@acme.test", role: "manager" },
  { name: "Diego Diaz", email: "diego@acme.test", role: "user" },
  { name: "Eva Eriksson", email: "eva@acme.test", role: "user" },
  { name: "Farah Farouk", email: "farah@acme.test", role: "user" },
  { name: "George Green", email: "george@acme.test", role: "user" },
  { name: "Hana Hayashi", email: "hana@acme.test", role: "user" },
  { name: "Ivan Ivanov", email: "ivan@acme.test", role: "user" },
  { name: "Julia Jones", email: "julia@acme.test", role: "user" },
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function buildWorkItemSpecs(
  template: "board" | "list",
  emails: string[],
  componentNames: string[],
  sprintNames: string[],
): ProjectSpec["workItems"] {
  const items: ProjectSpec["workItems"] = [];

  const segmentTitles = [
    "Onboarding flow revamp",
    "Search experience overhaul",
    "Billing and subscriptions",
    "Notifications platform",
  ];
  segmentTitles.forEach((title, idx) => {
    items.push({
      type: "segment",
      title,
      state: pick(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"], idx) as WorkItemState,
      priority: pick(PRIORITIES, idx),
      assigneeEmail: emails[idx % emails.length],
      labels: ["epic"],
      componentName: componentNames[idx % componentNames.length],
      sprintName: sprintNames[idx % sprintNames.length],
    });
  });

  const taskTitles = [
    "Wire up auth interceptor for refresh flow",
    "Implement dark mode toggle in app shell",
    "Create reusable Dialog primitive",
    "Add empty state illustrations to dashboard",
    "Migrate legacy fetch calls to axios client",
    "Set up CI pipeline with lint + typecheck",
    "Add pagination to project list endpoint",
    "Document API contract in OpenAPI spec",
    "Add Sentry error reporting",
    "Hook up Stripe checkout for paid plan",
    "Add feature flag service",
    "Implement rate limiting middleware",
    "Cache dashboard queries with Redis",
    "Build digest email scheduler",
    "Add 2FA enrollment flow",
    "Audit log viewer page",
    "Slack integration for task updates",
    "Bulk import CSV for tasks",
    "Mobile responsive layout pass",
    "Accessibility audit (WCAG AA)",
    "Add unit tests for tenant service",
    "Migrate from Mongoose 7 to 8",
    "Switch to httpOnly cookies for refresh token",
    "Add health-check ping for cron jobs",
    "Refactor project routes to use Zod",
    "Add SLO dashboard in Grafana",
    "Add full-text search for tasks",
    "Generate invoice PDFs",
    "Custom domain support for tenants",
    "SAML SSO via Okta",
    "Add webhook delivery retries",
    "Compress avatar uploads",
    "Tasks Gantt view",
    "Sprint burndown chart",
    "Saved filters in task list",
    "Activity feed on project page",
  ];

  taskTitles.forEach((title, idx) => {
    items.push({
      type: "task",
      title,
      state: pick(STATES, idx),
      priority: pick(PRIORITIES, idx + 1),
      assigneeEmail: emails[(idx + 1) % emails.length],
      labels:
        idx % 5 === 0
          ? ["frontend"]
          : idx % 5 === 1
            ? ["backend"]
            : idx % 5 === 2
              ? ["bug"]
              : idx % 5 === 3
                ? ["chore"]
                : ["enhancement"],
      storyPoints: [1, 2, 3, 5, 8][idx % 5],
      componentName: componentNames[idx % componentNames.length],
      sprintName: idx % 3 === 0 ? sprintNames[0] : sprintNames[idx % sprintNames.length],
      children:
        idx % 4 === 0
          ? [
              {
                title: `${title.split(" ").slice(0, 3).join(" ")} — spike`,
                state: "DONE",
                priority: "low",
                assigneeEmail: emails[(idx + 2) % emails.length],
              },
              {
                title: `${title.split(" ").slice(0, 3).join(" ")} — implementation`,
                state: pick(["TODO", "IN_PROGRESS"], idx) as WorkItemState,
                priority: "medium",
                assigneeEmail: emails[(idx + 3) % emails.length],
              },
            ]
          : undefined,
    });
  });

  if (template === "list") {
    return items.filter((i) => i.type !== "segment");
  }

  return items;
}

const PROJECTS: ProjectSpec[] = [
  {
    name: "Web Platform",
    key: "WEB",
    description:
      "Public-facing marketing site and authenticated app shell. Vue 3 + Vite.",
    template: "board",
    memberEmails: [
      { email: "alice@acme.test", role: "administrator" },
      { email: "bob@acme.test", role: "administrator" },
      { email: "diego@acme.test", role: "member" },
      { email: "eva@acme.test", role: "member" },
      { email: "farah@acme.test", role: "member" },
      { email: "george@acme.test", role: "viewer" },
    ],
    componentNames: ["Frontend", "Design System", "QA"],
    sprints: [
      { name: "WEB Sprint 1", goal: "Ship auth + dashboard skeleton", state: "closed", daysOffset: -28 },
      { name: "WEB Sprint 2", goal: "Project + task flows", state: "active", daysOffset: -7 },
      { name: "WEB Sprint 3", goal: "Polish and dark mode", state: "planned", daysOffset: 14 },
    ],
    workItems: [],
  },
  {
    name: "Mobile Apps",
    key: "MOB",
    description: "React Native iOS + Android app for ProjectFlow.",
    template: "board",
    memberEmails: [
      { email: "alice@acme.test", role: "administrator" },
      { email: "carol@acme.test", role: "administrator" },
      { email: "hana@acme.test", role: "member" },
      { email: "ivan@acme.test", role: "member" },
      { email: "julia@acme.test", role: "member" },
    ],
    componentNames: ["iOS", "Android", "Shared"],
    sprints: [
      { name: "MOB Sprint 1", goal: "Auth + project list parity", state: "closed", daysOffset: -21 },
      { name: "MOB Sprint 2", goal: "Push notifications", state: "active", daysOffset: -5 },
      { name: "MOB Sprint 3", goal: "Offline mode", state: "planned", daysOffset: 10 },
    ],
    workItems: [],
  },
  {
    name: "Core API",
    key: "API",
    description: "Multi-tenant REST API: Express + Mongoose + Zod.",
    template: "board",
    memberEmails: [
      { email: "alice@acme.test", role: "administrator" },
      { email: "bob@acme.test", role: "administrator" },
      { email: "carol@acme.test", role: "member" },
      { email: "diego@acme.test", role: "member" },
      { email: "george@acme.test", role: "member" },
    ],
    componentNames: ["Backend", "Database", "Auth"],
    sprints: [
      { name: "API Sprint 1", goal: "Tenant + project endpoints", state: "closed", daysOffset: -35 },
      { name: "API Sprint 2", goal: "Work item lifecycle", state: "active", daysOffset: -7 },
      { name: "API Sprint 3", goal: "Rate limiting + audit logs", state: "planned", daysOffset: 14 },
    ],
    workItems: [],
  },
  {
    name: "Internal Ops",
    key: "OPS",
    description: "Backlog of internal-facing tasks: tooling, docs, hiring.",
    template: "list",
    memberEmails: [
      { email: "alice@acme.test", role: "administrator" },
      { email: "eva@acme.test", role: "member" },
      { email: "farah@acme.test", role: "member" },
      { email: "ivan@acme.test", role: "viewer" },
    ],
    componentNames: ["DevOps", "Docs"],
    sprints: [
      { name: "OPS Sprint 1", goal: "CI baseline", state: "closed", daysOffset: -42 },
      { name: "OPS Sprint 2", goal: "Onboarding docs", state: "active", daysOffset: -10 },
    ],
    workItems: [],
  },
];

async function run(): Promise<void> {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not set in .env");
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  console.log("Wiping demo collections...");
  await Promise.all([
    Tenant.deleteMany({}),
    User.deleteMany({}),
    Project.deleteMany({}),
    Sprint.deleteMany({}),
    Component.deleteMany({}),
    WorkItem.deleteMany({}),
  ]);
  console.log("Wiped.");

  console.log("Creating tenant...");
  const tenant = await Tenant.create({
    name: TENANT_NAME,
    slug: TENANT_SLUG,
    plan: "free",
    status: "active",
  });

  console.log("Creating users...");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
  const userDocs = await User.insertMany(
    USERS.map((u) => ({
      tenantId: tenant._id,
      email: u.email,
      passwordHash,
      name: u.name,
      role: u.role,
    })),
  );
  const userByEmail = new Map<string, Types.ObjectId>();
  for (const u of userDocs) {
    userByEmail.set(u.email, u._id);
  }

  let totalWorkItems = 0;
  let totalChildren = 0;

  for (const spec of PROJECTS) {
    console.log(`Creating project ${spec.key} (${spec.name})...`);

    spec.workItems = buildWorkItemSpecs(
      spec.template,
      spec.memberEmails.map((m) => m.email),
      spec.componentNames,
      spec.sprints.map((s) => s.name),
    );

    const creatorEmail = spec.memberEmails[0].email;
    const creatorId = userByEmail.get(creatorEmail);
    if (!creatorId) {
      throw new Error(`Missing creator user for project ${spec.key}: ${creatorEmail}`);
    }

    const members = spec.memberEmails.map((m) => {
      const userId = userByEmail.get(m.email);
      if (!userId) {
        throw new Error(`Missing user ${m.email} for project ${spec.key}`);
      }
      return { userId, role: m.role };
    });

    const project = await Project.create({
      tenantId: tenant._id,
      name: spec.name,
      slug: spec.name.toLowerCase().replace(/\s+/g, "-"),
      description: spec.description,
      status: "active",
      template: spec.template,
      key: spec.key,
      management: "team-managed",
      access: "open",
      members,
      nextWorkItemNumber: 1,
      createdBy: creatorId,
    });

    const componentByName = new Map<string, Types.ObjectId>();
    for (const cname of spec.componentNames) {
      const c = await Component.create({
        tenantId: tenant._id,
        projectId: project._id,
        name: cname,
        description: `${cname} work for ${project.name}`,
        leadId: members[1]?.userId ?? creatorId,
        defaultAssigneeId: members[2]?.userId ?? creatorId,
        createdBy: creatorId,
      });
      componentByName.set(cname, c._id);
    }

    const now = Date.now();
    const sprintByName = new Map<string, Types.ObjectId>();
    for (const s of spec.sprints) {
      const start = new Date(now + s.daysOffset * 24 * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
      const sprintDoc = await Sprint.create({
        tenantId: tenant._id,
        projectId: project._id,
        name: s.name,
        goal: s.goal,
        state: s.state,
        startDate: start,
        endDate: end,
        startedAt: s.state === "active" || s.state === "closed" ? start : null,
        closedAt: s.state === "closed" ? end : null,
        createdBy: creatorId,
      });
      sprintByName.set(s.name, sprintDoc._id);
    }

    let number = 1;
    for (const item of spec.workItems) {
      const assigneeId = item.assigneeEmail
        ? (userByEmail.get(item.assigneeEmail) ?? null)
        : null;
      const componentIds = item.componentName
        ? [componentByName.get(item.componentName)].filter(Boolean) as Types.ObjectId[]
        : [];
      const sprintId = item.sprintName ? (sprintByName.get(item.sprintName) ?? null) : null;

      const parent = await WorkItem.create({
        tenantId: tenant._id,
        projectId: project._id,
        type: item.type,
        parentId: null,
        number,
        key: `${project.key}-${number}`,
        title: item.title,
        description: `Auto-generated demo work item for ${project.name}.`,
        state: item.state ?? "TODO",
        priority: item.priority ?? "medium",
        assigneeId,
        reporterId: creatorId,
        labels: item.labels ?? [],
        componentIds,
        sprintId,
        storyPoints: item.storyPoints ?? null,
        dueDate: null,
        attachments: [],
        createdBy: creatorId,
      });
      number += 1;
      totalWorkItems += 1;

      if (item.children && item.children.length > 0) {
        for (const child of item.children) {
          const childAssigneeId = child.assigneeEmail
            ? (userByEmail.get(child.assigneeEmail) ?? null)
            : null;
          await WorkItem.create({
            tenantId: tenant._id,
            projectId: project._id,
            type: "subtask",
            parentId: parent._id,
            number,
            key: `${project.key}-${number}`,
            title: child.title,
            description: `Subtask of ${parent.key}.`,
            state: child.state ?? "TODO",
            priority: child.priority ?? "medium",
            assigneeId: childAssigneeId,
            reporterId: creatorId,
            labels: [],
            componentIds,
            sprintId,
            storyPoints: null,
            dueDate: null,
            attachments: [],
            createdBy: creatorId,
          });
          number += 1;
          totalChildren += 1;
          totalWorkItems += 1;
        }
      }
    }

    project.nextWorkItemNumber = number;
    await project.save();
    console.log(`  ${spec.key}: ${number - 1} work items.`);
  }

  console.log("");
  console.log("Done.");
  console.log(`Tenant:       ${tenant.name} (${tenant.slug})`);
  console.log(`Users:        ${userDocs.length}`);
  console.log(`Projects:     ${PROJECTS.length}`);
  console.log(`Work items:   ${totalWorkItems} (incl. ${totalChildren} subtasks)`);
  console.log("");
  console.log(`Login with any of:`);
  for (const u of USERS) {
    console.log(`  ${u.email}  /  ${DEMO_PASSWORD}   (${u.role})`);
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
