import type { Role } from "./constants";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export function roleHomePath(role: Role): string {
  return role === "ADMIN" ? "/admin" : role === "FACULTY" ? "/faculty" : "/student";
}

export const COMMON_NAV: NavItem[] = [
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/account", label: "My account", icon: "user" },
];

export function navForRole(role: Role): NavSection[] {
  if (role === "ADMIN") {
    return [
      {
        title: "Overview",
        items: [{ href: "/admin", label: "Dashboard", icon: "grid" }],
      },
      {
        title: "Administration",
        items: [
          { href: "/admin/users", label: "Students & Faculty", icon: "users" },
          { href: "/admin/academic", label: "Academic structure", icon: "layers" },
        ],
      },
      {
        title: "Academics",
        items: [
          { href: "/admin/timetable", label: "Timetable", icon: "calendar" },
          { href: "/admin/attendance", label: "Attendance", icon: "clipboard" },
          { href: "/admin/exams", label: "Examinations", icon: "award" },
          { href: "/admin/notices", label: "Notices", icon: "megaphone" },
        ],
      },
      {
        title: "Services",
        items: [
          { href: "/admin/complaints", label: "Feedback & complaints", icon: "inbox" },
          { href: "/admin/analytics", label: "Analytics", icon: "chart" },
          { href: "/admin/audit", label: "Audit log", icon: "shield" },
          { href: "/admin/settings", label: "Settings", icon: "settings" },
        ],
      },
      { title: "Assistant", items: [{ href: "/assistant", label: "AI assistant", icon: "sparkles" }] },
    ];
  }

  if (role === "FACULTY") {
    return [
      {
        title: "Overview",
        items: [{ href: "/faculty", label: "Dashboard", icon: "grid" }],
      },
      {
        title: "Teaching",
        items: [
          { href: "/faculty/timetable", label: "My timetable", icon: "calendar" },
          { href: "/faculty/swaps", label: "Lecture swaps", icon: "refresh" },
          { href: "/faculty/attendance", label: "Attendance", icon: "clipboard" },
          { href: "/faculty/marks", label: "Marks & exams", icon: "award" },
          { href: "/faculty/assignments", label: "Assignments", icon: "file" },
          { href: "/faculty/notices", label: "Notices", icon: "megaphone" },
        ],
      },
      { title: "Assistant", items: [{ href: "/assistant", label: "AI assistant", icon: "sparkles" }] },
    ];
  }

  return [
    {
      title: "Overview",
      items: [{ href: "/student", label: "Dashboard", icon: "grid" }],
    },
    {
      title: "My academics",
      items: [
        { href: "/student/timetable", label: "Timetable", icon: "calendar" },
        { href: "/student/attendance", label: "Attendance", icon: "clipboard" },
        { href: "/student/results", label: "Results", icon: "award" },
        { href: "/student/assignments", label: "Assignments", icon: "file" },
      ],
    },
    {
      title: "Campus services",
      items: [
        { href: "/student/notices", label: "Notices", icon: "megaphone" },
        { href: "/student/library", label: "Library", icon: "book" },
        { href: "/student/complaints", label: "Feedback & complaints", icon: "inbox" },
      ],
    },
    { title: "Assistant", items: [{ href: "/assistant", label: "AI assistant", icon: "sparkles" }] },
  ];
}
